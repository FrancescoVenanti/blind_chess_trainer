import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import Board from '../components/Board.jsx';
import { piecesFromGame } from '../lib/position.js';
import MoveList from '../components/MoveList.jsx';
import { Announcer, Feedback, ModeIntro, SegmentedControl, StatBar, Toggle } from '../components/ui.jsx';
import { describeSan, toMovePairs } from '../lib/notation.js';
import { randomOpening } from '../lib/openings.js';
import { ALL_SQUARES, isSquare, pick, shuffle } from '../lib/squares.js';
import { loadStats, recordAnswer, resetStats } from '../lib/storage.js';
import { speakSan } from '../lib/speech.js';

const LENGTHS = [
  { value: '4', label: '4 moves', hint: '8 half-moves' },
  { value: '6', label: '6 moves', hint: '12 half-moves' },
  { value: '8', label: '8 moves', hint: '16 half-moves' },
];

const PIECE_LABELS = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
const AUTO_ADVANCE_MS = 2600;

function describePiece(piece) {
  if (!piece) return 'nothing';
  return `${piece.color === 'w' ? 'White' : 'Black'} ${PIECE_LABELS[piece.type]}`;
}

/** Builds three questions about the position the player has just followed. */
function buildQuestions(game) {
  const pieces = piecesFromGame(game);
  const occupied = Object.keys(pieces);
  const empty = ALL_SQUARES.filter((square) => !pieces[square]);
  const questions = [];

  // 1. What stands on this square? Mostly occupied, sometimes deliberately not.
  const square = Math.random() < 0.75 ? pick(occupied) : pick(empty);
  const truth = describePiece(pieces[square]);
  const options = new Set([truth]);
  while (options.size < 4) {
    const other = Math.random() < 0.2 ? 'nothing' : describePiece(pieces[pick(occupied)]);
    options.add(other);
  }
  questions.push({
    prompt: `What is on ${square}?`,
    kind: 'choice',
    options: shuffle([...options]),
    answer: truth,
    explain: `${square} holds ${truth.toLowerCase()}.`,
  });

  // 2. Locate a piece there is only one of, so the answer is unambiguous.
  const unique = ['wq', 'bq', 'wk', 'bk'].filter((code) =>
    occupied.some((sq) => pieces[sq].color === code[0] && pieces[sq].type === code[1]),
  );
  const code = pick(unique);
  const home = occupied.find((sq) => pieces[sq].color === code[0] && pieces[sq].type === code[1]);
  questions.push({
    prompt: `Where is the ${code[0] === 'w' ? 'white' : 'black'} ${PIECE_LABELS[code[1]]}?`,
    kind: 'square',
    answer: home,
    explain: `It is on ${home}.`,
  });

  // 3. Counting material forces you to keep the whole position, not just a corner.
  const colour = Math.random() < 0.5 ? 'w' : 'b';
  const count = occupied.filter((sq) => pieces[sq].color === colour && pieces[sq].type === 'p').length;
  questions.push({
    prompt: `How many pawns does ${colour === 'w' ? 'White' : 'Black'} have?`,
    kind: 'choice',
    options: shuffle([...new Set([count, count - 1, count + 1, count - 2].filter((n) => n >= 0))]).map(String),
    answer: String(count),
    explain: `${colour === 'w' ? 'White' : 'Black'} has ${count} pawns.`,
  });

  return questions;
}

export default function RecallMode({ speechEnabled }) {
  const [length, setLength] = useState('4');
  const [phase, setPhase] = useState('idle'); // idle -> reveal -> quiz -> done
  const [line, setLine] = useState(null);
  const [revealed, setRevealed] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [entry, setEntry] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [inputError, setInputError] = useState('');
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState(() => loadStats('recall'));
  const timer = useRef(null);
  const askedAt = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const start = useCallback(() => {
    const opening = randomOpening();
    const plies = Number(length) * 2;
    const moves = opening.moves.slice(0, plies);
    const game = new Chess();
    moves.forEach((san) => game.move(san));
    setLine({ name: opening.name, moves, pieces: piecesFromGame(game), game });
    setRevealed(0);
    setQuestions([]);
    setResults([]);
    setCurrent(0);
    setEntry('');
    setFeedback(null);
    setInputError('');
    setPhase('reveal');
  }, [length]);

  // Stepping past the last move ends the reveal: the quiz is set up here, in
  // the event that caused it, rather than by an effect watching the counter.
  const advance = useCallback(() => {
    clearTimeout(timer.current);
    if (!line) return;
    const next = revealed + 1;
    if (next < line.moves.length) {
      setRevealed(next);
      return;
    }
    setQuestions(buildQuestions(line.game));
    askedAt.current = performance.now();
    setPhase('quiz');
  }, [line, revealed]);

  // Read each move out as it appears, and queue the next one when on auto.
  useEffect(() => {
    if (phase !== 'reveal' || !line) return undefined;
    speakSan(line.moves[revealed], { enabled: speechEnabled });
    if (!autoPlay) return undefined;
    timer.current = setTimeout(advance, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer.current);
  }, [phase, revealed, line, autoPlay, speechEnabled, advance]);

  const submitAnswer = (value) => {
    const question = questions[current];
    const given = String(value).trim();

    // A typo is not a wrong answer: say so and let them try again, rather than
    // marking it and locking the field until the next question.
    if (question.kind === 'square' && !isSquare(given.toLowerCase())) {
      setInputError(`"${given}" is not a square.`);
      return;
    }
    setInputError('');

    const correct =
      question.kind === 'square'
        ? given.toLowerCase() === question.answer
        : given === question.answer;

    // oxlint-disable-next-line react/purity -- this runs from a click/submit, not render
    const elapsedMs = performance.now() - askedAt.current;
    setResults([...results, correct]);
    setStats(recordAnswer('recall', { correct, elapsedMs }));
    setFeedback({
      tone: correct ? 'good' : 'bad',
      message: `${correct ? 'Correct. ' : 'Not quite. '}${question.explain}`,
    });
    setEntry('');

    setTimeout(() => {
      if (current + 1 >= questions.length) {
        setPhase('done');
      } else {
        setCurrent((n) => n + 1);
        setFeedback(null);
        askedAt.current = performance.now();
      }
    }, 1400);
  };

  const question = questions[current];
  const revealedMoves = line ? line.moves.slice(0, revealed) : [];

  return (
    <div className="mode mode--drill">
      <div className="panel">
        <ModeIntro title="Follow the game">
          Moves from a real opening, one at a time and nothing else. Play them out in your head,
          then answer three questions about where everything ended up.
        </ModeIntro>
        <SegmentedControl name="recall-length" legend="Line length" options={LENGTHS} value={length} onChange={setLength} />
        <div className="switches">
          <Toggle label="Advance automatically" checked={autoPlay} onChange={setAutoPlay} hint="Otherwise tap for each move" />
        </div>
      </div>

      {phase === 'idle' && (
        <div className="panel panel--quiz">
          <p className="quiz__question">Ready when you are.</p>
          <button type="button" className="button button--primary button--wide" onClick={start}>
            Start a line
          </button>
        </div>
      )}

      {phase === 'reveal' && line && revealed < line.moves.length && (
        <div className="panel panel--quiz">
          <p className="quiz__prompt">
            Move {Math.floor(revealed / 2) + 1} · {revealed + 1} of {line.moves.length}
          </p>
          <div className="blindfold-panel">
            <p className="blindfold-panel__move">{line.moves[revealed]}</p>
            <p className="blindfold-panel__spoken">{describeSan(line.moves[revealed])}</p>
          </div>
          <button
            type="button"
            className="button button--primary button--wide"
            onClick={advance}
          >
            {revealed + 1 === line.moves.length ? 'Done — ask me' : 'Next move'}
          </button>
          <p className="quiz__hint">Played so far: {toMovePairs(revealedMoves).length ? revealedMoves.length : 0} half-moves</p>
        </div>
      )}

      {phase === 'quiz' && question && (
        <div className="panel panel--quiz">
          <p className="quiz__prompt">Question {current + 1} of {questions.length}</p>
          <p className="quiz__question">{question.prompt}</p>

          {question.kind === 'choice' ? (
            <div className="quiz__choices quiz__choices--grid">
              {question.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="button button--choice"
                  onClick={() => submitAnswer(option)}
                  disabled={Boolean(feedback)}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <form
              className="moveinput"
              onSubmit={(event) => { event.preventDefault(); submitAnswer(entry); }}
            >
              <label className="visually-hidden" htmlFor="recall-answer">Square</label>
              <input
                id="recall-answer"
                className={`moveinput__field${inputError ? ' has-error' : ''}`}
                aria-invalid={Boolean(inputError)}
                value={entry}
                onChange={(event) => setEntry(event.target.value)}
                placeholder="e.g. d1"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck="false"
                enterKeyHint="go"
                disabled={Boolean(feedback)}
              />
              <button type="submit" className="button button--primary" disabled={Boolean(feedback)}>
                Answer
              </button>
              {inputError && (
                <p className="moveinput__error" role="alert">{inputError}</p>
              )}
            </form>
          )}
          <Feedback tone={feedback?.tone}>{feedback?.message}</Feedback>
        </div>
      )}

      {phase === 'done' && line && (
        <div className="panel panel--quiz">
          <p className="quiz__question">
            {results.filter(Boolean).length} of {results.length} right — that was the {line.name}.
          </p>
          <Board pieces={line.pieces} label="The position you were following" />
          <MoveList history={line.moves} />
          <button type="button" className="button button--primary button--wide" onClick={start}>
            Another line
          </button>
        </div>
      )}

      <div className="panel">
        <StatBar stats={stats} onReset={() => setStats(resetStats('recall'))} />
      </div>
      <Announcer
        message={
          phase === 'reveal' && line
            ? describeSan(line.moves[revealed] ?? '')
            : feedback?.message ?? question?.prompt ?? ''
        }
      />
    </div>
  );
}
