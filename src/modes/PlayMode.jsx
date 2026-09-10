import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import Board from '../components/Board.jsx';
import { piecesFromGame } from '../lib/position.js';
import MoveList from '../components/MoveList.jsx';
import MoveInput from '../components/MoveInput.jsx';
import { Announcer, SegmentedControl, Toggle } from '../components/ui.jsx';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../lib/engine.js';
import { useEngine } from '../lib/useEngine.js';
import { describeSan, parseMove } from '../lib/notation.js';
import { speak, speakSan, speechSupported, stopSpeaking } from '../lib/speech.js';
import { loadStats, recordAnswer } from '../lib/storage.js';

const BLINDFOLD_LEVELS = [
  { value: 'pieces', label: 'Board + pieces', hint: 'Warm-up' },
  { value: 'board', label: 'Empty board', hint: 'Squares only' },
  { value: 'moves', label: 'Moves only', hint: 'Full blindfold' },
];

const PEEK_MS = 4000;

function statusOf(game, playerColor) {
  if (game.isCheckmate()) {
    const loser = game.turn() === 'w' ? 'white' : 'black';
    return {
      over: true,
      won: loser !== playerColor,
      text: loser === playerColor ? 'Checkmate — you lost.' : 'Checkmate — you won!',
    };
  }
  if (game.isStalemate()) return { over: true, won: false, text: 'Stalemate — a draw.' };
  if (game.isInsufficientMaterial()) return { over: true, won: false, text: 'Draw — not enough material.' };
  if (game.isThreefoldRepetition()) return { over: true, won: false, text: 'Draw by repetition.' };
  if (game.isDraw()) return { over: true, won: false, text: 'Draw by the fifty-move rule.' };
  if (game.isCheck()) return { over: false, won: false, text: 'Check!' };
  return { over: false, won: false, text: '' };
}

function snap(game, color) {
  const history = game.history({ verbose: true });
  const last = history[history.length - 1] ?? null;
  return {
    history: history.map((move) => move.san),
    lastMove: last ? { from: last.from, to: last.to, san: last.san } : null,
    pieces: piecesFromGame(game),
    turn: game.turn(),
    status: statusOf(game, color),
  };
}

export default function PlayMode({ speechEnabled, onSpeechChange }) {
  const gameRef = useRef(new Chess());
  const tokenRef = useRef(0);
  const peekTimer = useRef(null);

  const [playerColor, setPlayerColor] = useState('white');
  const [difficulty, setDifficulty] = useState('casual');
  const [level, setLevel] = useState('board');
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [snapshot, setSnapshot] = useState(() => snap(new Chess(), 'white'));
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [peeking, setPeeking] = useState(false);
  const [peeks, setPeeks] = useState(0);
  const [record, setRecord] = useState(() => loadStats('play'));
  const [announcement, setAnnouncement] = useState('');

  const { requestMove, cancelPending } = useEngine();

  const engineColor = playerColor === 'white' ? 'b' : 'w';

  const playEngineMove = useCallback(
    async (token, color) => {
      const game = gameRef.current;
      if (game.isGameOver()) return;
      setThinking(true);
      try {
        const result = await requestMove(game.fen(), DIFFICULTIES[difficulty]);
        if (token !== tokenRef.current || !result) return; // position moved on
        const played = game.move(result.move);
        setSnapshot(snap(game, color));
        if (played) {
          setAnnouncement(`Opponent played ${describeSan(played.san)}`);
          speakSan(played.san, { enabled: speechEnabled });
        }
      } catch {
        setError('The engine could not find a move. Try undoing your last move.');
      } finally {
        if (token === tokenRef.current) setThinking(false);
      }
    },
    [difficulty, requestMove, speechEnabled],
  );

  const newGame = useCallback(
    (color = playerColor) => {
      tokenRef.current += 1;
      const token = tokenRef.current;
      cancelPending();
      stopSpeaking();
      clearTimeout(peekTimer.current);
      gameRef.current = new Chess();
      setPeeking(false);
      setPeeks(0);
      setError('');
      setHint('');
      setThinking(false);
      setSnapshot(snap(gameRef.current, color));
      setAnnouncement('New game. ' + (color === 'white' ? 'You are white, your move.' : 'You are black.'));
      if (color === 'black') playEngineMove(token, color);
    },
    [cancelPending, playEngineMove, playerColor],
  );

  useEffect(() => () => clearTimeout(peekTimer.current), []);

  // A finished game is worth exactly one entry in the record.
  const recordedRef = useRef(false);
  useEffect(() => {
    if (!snapshot.status.over) {
      recordedRef.current = false;
      return;
    }
    if (recordedRef.current) return;
    recordedRef.current = true;
    setRecord(recordAnswer('play', { correct: snapshot.status.won }));
    setAnnouncement(snapshot.status.text);
    speak(snapshot.status.text, { enabled: speechEnabled });
  }, [snapshot.status, speechEnabled]);

  const handleMove = (input) => {
    const game = gameRef.current;
    if (game.turn() === engineColor || thinking) {
      setError('Wait for your opponent.');
      return false;
    }
    const { move, error: parseError } = parseMove(game, input);
    if (parseError) {
      setError(parseError);
      return false;
    }
    setError('');
    setHint('');
    game.move(move);
    setSnapshot(snap(game, playerColor));
    setAnnouncement(`You played ${describeSan(move.san)}`);
    if (!game.isGameOver()) playEngineMove(tokenRef.current, playerColor);
    return true;
  };

  const undo = () => {
    const game = gameRef.current;
    if (game.history().length === 0) return;
    tokenRef.current += 1;
    cancelPending();
    setThinking(false);
    // Take back the pair, so it is the player's turn again.
    game.undo();
    if (game.history().length > 0 && game.turn() === engineColor) game.undo();
    setError('');
    setHint('');
    setSnapshot(snap(game, playerColor));
    setAnnouncement('Move taken back.');
  };

  // A peek left running would leak the position into whatever you switch to.
  const changeLevel = (next) => {
    clearTimeout(peekTimer.current);
    setPeeking(false);
    setLevel(next);
  };

  const peek = () => {
    clearTimeout(peekTimer.current);
    setPeeks((count) => count + 1);
    setPeeking(true);
    peekTimer.current = setTimeout(() => setPeeking(false), PEEK_MS);
  };

  const askForHint = async () => {
    const game = gameRef.current;
    if (game.isGameOver() || game.turn() === engineColor) return;
    setHint('Thinking…');
    const result = await requestMove(game.fen(), DIFFICULTIES.casual);
    if (!result) return setHint('');
    const preview = new Chess(game.fen());
    const move = preview.move(result.move);
    setHint(move ? `Try ${move.san} (${describeSan(move.san)})` : '');
  };

  const changeColor = (color) => {
    setPlayerColor(color);
    newGame(color);
  };

  const showPieces = level === 'pieces' || peeking;
  const showBoard = level !== 'moves' || peeking;
  const yourTurn = snapshot.turn !== engineColor && !snapshot.status.over;
  const lastMoveText = snapshot.lastMove ? snapshot.lastMove.san : null;

  const summary = useMemo(() => {
    const played = Math.ceil(snapshot.history.length / 2);
    const moveNumber = `Move ${played + (yourTurn ? 1 : 0)}`;
    if (!record.attempts) return moveNumber;
    return `${moveNumber} · ${record.correct}/${record.attempts} games won`;
  }, [snapshot.history.length, yourTurn, record]);

  return (
    <div className="mode">
      <div className="panel panel--controls">
        <SegmentedControl
          name="level"
          legend="How much can you see?"
          options={BLINDFOLD_LEVELS}
          value={level}
          onChange={changeLevel}
        />
        <SegmentedControl
          name="difficulty"
          legend="Opponent"
          options={DIFFICULTY_ORDER.map((key) => ({
            value: key,
            label: DIFFICULTIES[key].label,
            hint: DIFFICULTIES[key].hint,
          }))}
          value={difficulty}
          onChange={setDifficulty}
        />
        <SegmentedControl
          name="color"
          legend="You play"
          options={[
            { value: 'white', label: 'White' },
            { value: 'black', label: 'Black' },
          ]}
          value={playerColor}
          onChange={changeColor}
        />
        <div className="switches">
          <Toggle
            label="Read moves aloud"
            checked={speechEnabled}
            onChange={onSpeechChange}
            disabled={!speechSupported()}
            hint={speechSupported() ? undefined : 'Not available in this browser'}
          />
          {level === 'board' && (
            <Toggle label="Show coordinates" checked={showCoordinates} onChange={setShowCoordinates} />
          )}
        </div>
      </div>

      <div className="panel panel--game">
        <div className="game__status">
          <span className="game__summary">{summary}</span>
          {peeks > 0 && <span className="game__peeks">{peeks} peek{peeks === 1 ? '' : 's'}</span>}
        </div>

        {showBoard ? (
          <Board
            pieces={showPieces ? snapshot.pieces : null}
            orientation={playerColor}
            showCoordinates={level === 'pieces' ? true : showCoordinates}
            lastMove={showPieces ? snapshot.lastMove : null}
            label={showPieces ? 'Chess board with the current position' : 'Empty chess board'}
          />
        ) : (
          <div className="blindfold-panel">
            <p className="blindfold-panel__label">Last move</p>
            <p className="blindfold-panel__move">{lastMoveText ?? '—'}</p>
            <p className="blindfold-panel__spoken">
              {lastMoveText ? describeSan(lastMoveText) : 'The board is in your head now.'}
            </p>
          </div>
        )}

        {snapshot.status.text && (
          <p className={`game__result${snapshot.status.over ? ' game__result--final' : ''}`} role="status">
            {snapshot.status.text}
          </p>
        )}

        {thinking && <p className="game__thinking">Opponent is thinking…</p>}

        {snapshot.status.over ? (
          <button type="button" className="button button--primary button--wide" onClick={() => newGame()}>
            New game
          </button>
        ) : (
          <MoveInput onSubmit={handleMove} disabled={!yourTurn} error={error} />
        )}

        {hint && <p className="game__hint">{hint}</p>}

        <div className="game__actions">
          <button type="button" className="button" onClick={undo} disabled={snapshot.history.length === 0}>
            Take back
          </button>
          <button type="button" className="button" onClick={peek} disabled={level === 'pieces' || peeking}>
            Peek ({PEEK_MS / 1000}s)
          </button>
          <button type="button" className="button" onClick={askForHint} disabled={!yourTurn}>
            Hint
          </button>
          <button type="button" className="button button--quiet" onClick={() => newGame()}>
            Restart
          </button>
        </div>
      </div>

      <div className="panel panel--moves">
        <h3 className="panel__title">Moves</h3>
        <MoveList history={snapshot.history} emptyText="Play a move to begin." />
      </div>

      <Announcer message={announcement} />
    </div>
  );
}
