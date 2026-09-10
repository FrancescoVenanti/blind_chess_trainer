import { useEffect, useState } from 'react';
import PlayMode from './modes/PlayMode.jsx';
import SquaresMode from './modes/SquaresMode.jsx';
import KnightMode from './modes/KnightMode.jsx';
import VisionMode from './modes/VisionMode.jsx';
import RecallMode from './modes/RecallMode.jsx';
import { speechSupported, stopSpeaking } from './lib/speech.js';
import { loadPreferences, savePreferences } from './lib/storage.js';

const MODES = [
  { id: 'play', label: 'Play', icon: '♞', blurb: 'A game against the engine, with as much of the board hidden as you dare.' },
  { id: 'squares', label: 'Squares', icon: '⬚', blurb: 'Name a square’s colour, or find it on a bare grid.' },
  { id: 'knight', label: 'Knight', icon: '♘', blurb: 'Route a knight across an empty board.' },
  { id: 'vision', label: 'Vision', icon: '◇', blurb: 'Diagonals, files and colours, from coordinates alone.' },
  { id: 'recall', label: 'Recall', icon: '☰', blurb: 'Follow an opening in your head, then place the pieces.' },
];

export default function App() {
  const [mode, setMode] = useState(() => loadPreferences().mode ?? 'play');
  const [speechEnabled, setSpeechEnabled] = useState(
    () => loadPreferences().speech ?? false,
  );

  useEffect(() => {
    savePreferences({ mode });
  }, [mode]);

  useEffect(() => {
    savePreferences({ speech: speechEnabled });
    if (!speechEnabled) stopSpeaking();
  }, [speechEnabled]);

  const active = MODES.find((entry) => entry.id === mode) ?? MODES[0];

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <h1 className="app__title">Blindfold Chess Trainer</h1>
          <p className="app__blurb">{active.blurb}</p>
        </div>
        {speechSupported() && (
          <button
            type="button"
            className={`button button--icon${speechEnabled ? ' is-on' : ''}`}
            onClick={() => setSpeechEnabled((on) => !on)}
            aria-pressed={speechEnabled}
            title={speechEnabled ? 'Spoken moves on' : 'Spoken moves off'}
          >
            <span aria-hidden="true">{speechEnabled ? '🔊' : '🔇'}</span>
            <span className="visually-hidden">
              {speechEnabled ? 'Turn spoken moves off' : 'Turn spoken moves on'}
            </span>
          </button>
        )}
      </header>

      <nav className="app__nav" aria-label="Training modes">
        {MODES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`navitem${entry.id === mode ? ' is-active' : ''}`}
            onClick={() => setMode(entry.id)}
            aria-current={entry.id === mode ? 'page' : undefined}
          >
            <span className="navitem__icon" aria-hidden="true">{entry.icon}</span>
            <span className="navitem__label">{entry.label}</span>
          </button>
        ))}
      </nav>

      <main className="app__main">
        {mode === 'play' && (
          <PlayMode speechEnabled={speechEnabled} onSpeechChange={setSpeechEnabled} />
        )}
        {mode === 'squares' && <SquaresMode speechEnabled={speechEnabled} />}
        {mode === 'knight' && <KnightMode />}
        {mode === 'vision' && <VisionMode speechEnabled={speechEnabled} />}
        {mode === 'recall' && <RecallMode speechEnabled={speechEnabled} />}
      </main>

      <footer className="app__footer">
        <p>
          Everything runs in this tab — no account, no server, and your stats stay on this device.
        </p>
      </footer>
    </div>
  );
}
