import { useEffect, useRef, useState } from 'react';
import { Announcer, Feedback, ModeIntro, StatBar } from '../components/ui.jsx';
import {
  isKnightMove,
  knightMoves,
  pick,
  randomSquare,
  sameDiagonal,
  sameLine,
  squareColor,
} from '../lib/squares.js';
import { loadStats, recordAnswer, resetStats } from '../lib/storage.js';
import { speak } from '../lib/speech.js';

/**
 * Yes/no geometry. These are the relationships you have to see instantly to
 * follow a game you cannot look at: what defends what, and what can never
 * touch what.
 */
const QUESTIONS = [
  {
    id: 'diagonal',
    build: (a, b) => ({
      text: `Are ${a} and ${b} on the same diagonal?`,
      answer: sameDiagonal(a, b),
      why: sameDiagonal(a, b)
        ? `Yes — the file and rank gaps are equal, so a bishop runs straight from ${a} to ${b}.`
        : `No — the file and rank gaps differ, so no bishop connects ${a} and ${b}.`,
    }),
  },
  {
    id: 'line',
    build: (a, b) => ({
      text: `Do ${a} and ${b} share a rank or file?`,
      answer: sameLine(a, b),
      why: sameLine(a, b)
        ? `Yes — a rook slides from ${a} to ${b}.`
        : `No — ${a} and ${b} differ in both file and rank.`,
    }),
  },
  {
    id: 'colour',
    build: (a, b) => ({
      text: `Are ${a} and ${b} the same colour?`,
      answer: squareColor(a) === squareColor(b),
      why: `${a} is ${squareColor(a)}, ${b} is ${squareColor(b)}.`,
    }),
  },
  {
    id: 'knight',
    build: (a, b) => ({
      text: `Can a knight go from ${a} to ${b} in one move?`,
      answer: isKnightMove(a, b),
      why: isKnightMove(a, b)
        ? `Yes — that is a knight's leap.`
        : `No. From ${a} a knight reaches ${knightMoves(a).join(', ')}.`,
    }),
  },
  {
    id: 'bishop',
    build: (a, b) => ({
      text: `A bishop starts on ${a}. Could it ever reach ${b}?`,
      answer: squareColor(a) === squareColor(b),
      why:
        squareColor(a) === squareColor(b)
          ? `Yes — both are ${squareColor(a)} squares, and a bishop never leaves its colour.`
          : `No — ${a} is ${squareColor(a)} and ${b} is ${squareColor(b)}. A bishop never changes colour.`,
    }),
  },
];

/** Half the questions should be "yes", or the drill rewards guessing "no". */
function newQuestion() {
  const template = pick(QUESTIONS);
  const wantYes = Math.random() < 0.5;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const a = randomSquare();
    // Bias towards squares that can produce the answer we are aiming for.
    const b =
      wantYes && template.id === 'knight'
        ? pick(knightMoves(a))
        : randomSquare([a]);
    const question = template.build(a, b);
    if (question.answer === wantYes) return { ...question, id: template.id, a, b };
  }
  const a = randomSquare();
  const b = randomSquare([a]);
  return { ...template.build(a, b), id: template.id, a, b };
}

export default function VisionMode({ speechEnabled }) {
  const [question, setQuestion] = useState(newQuestion);
  const [feedback, setFeedback] = useState(null);
  const [stats, setStats] = useState(() => loadStats('vision'));
  const askedAt = useRef(0);

  useEffect(() => {
    askedAt.current = performance.now();
    if (speechEnabled) speak(question.text, { enabled: true });
  }, [question, speechEnabled]);

  const answer = (guess) => {
    if (feedback) return;
    const correct = guess === question.answer;
    setStats(recordAnswer('vision', { correct, elapsedMs: performance.now() - askedAt.current }));
    setFeedback({ tone: correct ? 'good' : 'bad', message: question.why });
    if (correct) setTimeout(() => { setFeedback(null); setQuestion(newQuestion()); }, 900);
  };

  const next = () => {
    setFeedback(null);
    setQuestion(newQuestion());
  };

  return (
    <div className="mode mode--drill">
      <div className="panel">
        <ModeIntro title="Board vision">
          No board this time. Answer from the coordinates alone — this is the arithmetic that
          blindfold play runs on.
        </ModeIntro>
      </div>

      <div className="panel panel--quiz">
        <p className="quiz__question">{question.text}</p>
        <div className="quiz__choices">
          <button type="button" className="button button--choice button--yes" onClick={() => answer(true)} disabled={Boolean(feedback)}>
            Yes
          </button>
          <button type="button" className="button button--choice button--no" onClick={() => answer(false)} disabled={Boolean(feedback)}>
            No
          </button>
        </div>
        <Feedback tone={feedback?.tone}>{feedback?.message}</Feedback>
        {feedback?.tone === 'bad' && (
          <button type="button" className="button button--primary button--wide" onClick={next}>
            Next question
          </button>
        )}
      </div>

      <div className="panel">
        <StatBar stats={stats} onReset={() => setStats(resetStats('vision'))} />
      </div>
      <Announcer message={feedback?.message ?? question.text} />
    </div>
  );
}
