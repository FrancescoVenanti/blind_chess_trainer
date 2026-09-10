import { useRef, useState } from 'react';
import Board from '../components/Board.jsx';
import { Announcer, Feedback, ModeIntro, SegmentedControl, StatBar } from '../components/ui.jsx';
import { isKnightMove, isSquare, knightDistance, randomSquare } from '../lib/squares.js';
import { loadStats, recordAnswer, resetStats } from '../lib/storage.js';

const DRILLS = [
  { value: 'count', label: 'How many hops?', hint: 'Answer with a number' },
  { value: 'path', label: 'Name the route', hint: 'Type each square' },
];

/** Picks a pair far enough apart to be worth thinking about. */
function newPuzzle() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const from = randomSquare();
    const to = randomSquare([from]);
    const distance = knightDistance(from, to);
    if (distance >= 2 && distance <= 4) return { from, to, distance };
  }
  const from = 'b1';
  return { from, to: 'g8', distance: knightDistance(from, 'g8') };
}

/**
 * The knight is the piece blindfold players lose track of first, because its
 * move is the only one you cannot read off a rank, file or diagonal.
 */
export default function KnightMode() {
  const [drill, setDrill] = useState('count');
  const [puzzle, setPuzzle] = useState(newPuzzle);
  const [path, setPath] = useState([]);
  const [entry, setEntry] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [stats, setStats] = useState(() => loadStats('knight-count'));
  const askedAt = useRef(0);

  const key = `knight-${drill}`;

  const reset = () => {
    setPuzzle(newPuzzle());
    setPath([]);
    setEntry('');
    setFeedback(null);
    askedAt.current = performance.now();
  };

  // Switching drill is an event, not something to synchronise in an effect.
  const changeDrill = (next) => {
    setDrill(next);
    setStats(loadStats(`knight-${next}`));
    reset();
  };

  const score = (correct, message) => {
    setStats(recordAnswer(key, { correct, elapsedMs: performance.now() - askedAt.current }));
    setFeedback({ tone: correct ? 'good' : 'bad', message });
  };

  const answerCount = (event) => {
    event.preventDefault();
    const guess = Number(entry);
    if (!Number.isInteger(guess) || guess < 1) {
      setFeedback({ tone: 'bad', message: 'Answer with a whole number of moves.' });
      return;
    }
    const right = guess === puzzle.distance;
    score(
      right,
      right
        ? `Right — ${puzzle.from} to ${puzzle.to} in ${puzzle.distance}.`
        : `It takes ${puzzle.distance}, not ${guess}.`,
    );
    setEntry('');
  };

  const answerPath = (event) => {
    event.preventDefault();
    const square = entry.trim().toLowerCase();
    if (!isSquare(square)) {
      setFeedback({ tone: 'bad', message: `"${entry.trim()}" is not a square.` });
      return;
    }
    const previous = path[path.length - 1] ?? puzzle.from;
    if (!isKnightMove(previous, square)) {
      setFeedback({ tone: 'bad', message: `A knight on ${previous} cannot reach ${square}.` });
      return;
    }
    const next = [...path, square];
    setPath(next);
    setEntry('');
    if (square !== puzzle.to) {
      setFeedback({
        tone: 'neutral',
        message: `${square}. ${knightDistance(square, puzzle.to)} to go.`,
      });
      return;
    }
    const optimal = next.length === puzzle.distance;
    score(
      optimal,
      optimal
        ? `Perfect — ${puzzle.distance} moves, the shortest route.`
        : `You got there in ${next.length}; the shortest is ${puzzle.distance}.`,
    );
  };

  const highlights = { [puzzle.from]: 'from', [puzzle.to]: 'target' };
  path.forEach((square) => {
    if (square !== puzzle.to) highlights[square] = 'step';
  });
  const solved = feedback?.tone === 'good' || (feedback?.tone === 'bad' && drill === 'count');

  return (
    <div className="mode mode--drill">
      <div className="panel">
        <ModeIntro title="Knight routes">
          Work out the journey in your head first. A knight always changes square colour, so an
          even number of hops lands on the colour it started on.
        </ModeIntro>
        <SegmentedControl name="knight-drill" legend="Drill" options={DRILLS} value={drill} onChange={changeDrill} />
      </div>

      <div className="panel panel--quiz">
        <p className="quiz__prompt">
          Knight on <strong>{puzzle.from}</strong> → <strong>{puzzle.to}</strong>
        </p>

        {drill === 'path' && path.length > 0 && (
          <p className="quiz__path">{[puzzle.from, ...path].join(' → ')}</p>
        )}

        <form className="moveinput" onSubmit={drill === 'count' ? answerCount : answerPath}>
          <label className="visually-hidden" htmlFor="knight-answer">
            {drill === 'count' ? 'Number of knight moves' : 'Next square on the route'}
          </label>
          <input
            id="knight-answer"
            className="moveinput__field"
            value={entry}
            onChange={(event) => setEntry(event.target.value)}
            placeholder={drill === 'count' ? 'e.g. 3' : 'e.g. d4'}
            inputMode={drill === 'count' ? 'numeric' : 'text'}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck="false"
            enterKeyHint="go"
            disabled={solved}
          />
          <button type="submit" className="button button--primary" disabled={solved}>
            {drill === 'count' ? 'Check' : 'Add'}
          </button>
        </form>

        <Feedback tone={feedback?.tone}>{feedback?.message}</Feedback>

        <div className="game__actions">
          <button type="button" className="button button--primary" onClick={reset}>
            {solved ? 'Next puzzle' : 'Skip'}
          </button>
          {drill === 'path' && path.length > 0 && !solved && (
            <button type="button" className="button" onClick={() => { setPath([]); setFeedback(null); }}>
              Start over
            </button>
          )}
        </div>

        <Board showCoordinates highlights={highlights} label="Empty board showing start and target squares" />
      </div>

      <div className="panel">
        <StatBar stats={stats} onReset={() => setStats(resetStats(key))} />
      </div>
      <Announcer message={feedback?.message ?? `Knight on ${puzzle.from} to ${puzzle.to}`} />
    </div>
  );
}
