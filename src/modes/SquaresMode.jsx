import { useEffect, useMemo, useRef, useState } from 'react';
import Board from '../components/Board.jsx';
import { Announcer, Feedback, ModeIntro, SegmentedControl, StatBar } from '../components/ui.jsx';
import { randomSquare, squareColor } from '../lib/squares.js';
import { loadStats, recordAnswer, resetStats } from '../lib/storage.js';
import { speak } from '../lib/speech.js';

const DRILLS = [
  { value: 'colour', label: 'Light or dark?', hint: 'Name the shade' },
  { value: 'find', label: 'Find the square', hint: 'Tap it on the grid' },
];

/**
 * Knowing a square's colour without counting is the first real blindfold skill:
 * it is what stops you putting a bishop on a square it can never reach.
 */
export default function SquaresMode({ speechEnabled }) {
  const [drill, setDrill] = useState('colour');
  const [target, setTarget] = useState(() => randomSquare());
  const [feedback, setFeedback] = useState(null);
  const [stats, setStats] = useState(() => loadStats('squares-colour'));
  const askedAt = useRef(0);

  const key = `squares-${drill}`;

  // Switching drill is an event, not something to synchronise in an effect.
  const changeDrill = (next) => {
    setDrill(next);
    setStats(loadStats(`squares-${next}`));
    setFeedback(null);
    setTarget(randomSquare());
    askedAt.current = performance.now();
  };

  useEffect(() => {
    if (speechEnabled) speak(target.split('').join(' '), { enabled: true });
  }, [target, speechEnabled]);

  const next = () => {
    setTarget((current) => randomSquare([current]));
    askedAt.current = performance.now();
  };

  const answer = (correct, message) => {
    const elapsedMs = performance.now() - askedAt.current;
    setStats(recordAnswer(key, { correct, elapsedMs }));
    setFeedback({ tone: correct ? 'good' : 'bad', message });
    if (correct) {
      setTimeout(next, 550);
    }
  };

  const answerColour = (choice) => {
    const truth = squareColor(target);
    answer(
      choice === truth,
      choice === truth ? `Yes — ${target} is ${truth}.` : `No — ${target} is ${truth}.`,
    );
  };

  const answerSquare = (square) => {
    answer(
      square === target,
      square === target ? `Correct — ${target}.` : `That was ${square}. You want ${target}.`,
    );
  };

  const highlights = useMemo(() => {
    if (drill !== 'find' || feedback?.tone !== 'bad') return {};
    return { [target]: 'target' };
  }, [drill, feedback, target]);

  return (
    <div className="mode mode--drill">
      <div className="panel">
        <ModeIntro title="Square sense">
          Answer without picturing the whole board — a1 is dark, and the colour flips with every
          step in any direction.
        </ModeIntro>
        <SegmentedControl
          name="squares-drill"
          legend="Drill"
          options={DRILLS}
          value={drill}
          onChange={changeDrill}
        />
      </div>

      <div className="panel panel--quiz">
        <p className="quiz__prompt">
          {drill === 'colour' ? 'What colour is' : 'Where is'} <strong>{target}</strong>?
        </p>

        {drill === 'colour' ? (
          <div className="quiz__choices">
            <button type="button" className="button button--choice button--light" onClick={() => answerColour('light')}>
              Light
            </button>
            <button type="button" className="button button--choice button--dark" onClick={() => answerColour('dark')}>
              Dark
            </button>
          </div>
        ) : (
          <Board
            showCoordinates={false}
            onSquareClick={answerSquare}
            highlights={highlights}
            label="Empty board — tap the named square"
          />
        )}

        <Feedback tone={feedback?.tone}>{feedback?.message}</Feedback>
        {feedback?.tone === 'bad' && (
          <button type="button" className="button button--primary button--wide" onClick={() => { setFeedback(null); next(); }}>
            Next square
          </button>
        )}
      </div>

      <div className="panel">
        <StatBar stats={stats} onReset={() => setStats(resetStats(key))} />
      </div>
      <Announcer message={feedback?.message ?? `Square ${target}`} />
    </div>
  );
}
