import { accuracy, averageSeconds } from '../lib/storage.js';

/** A row of mutually exclusive options, sized for thumbs on a phone. */
export function SegmentedControl({ legend, options, value, onChange, name }) {
  return (
    <fieldset className="segmented">
      <legend className="segmented__legend">{legend}</legend>
      <div className="segmented__options" role="radiogroup" aria-label={legend}>
        {options.map((option) => (
          <label
            key={option.value}
            className={`segmented__option${value === option.value ? ' is-active' : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="segmented__label">{option.label}</span>
            {option.hint && <span className="segmented__hint">{option.hint}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Toggle({ label, checked, onChange, disabled = false, hint }) {
  return (
    <label className={`toggle${disabled ? ' is-disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle__track" aria-hidden="true"><span className="toggle__thumb" /></span>
      <span className="toggle__text">
        {label}
        {hint && <span className="toggle__hint">{hint}</span>}
      </span>
    </label>
  );
}

export function StatBar({ stats, onReset }) {
  const percent = accuracy(stats);
  const seconds = averageSeconds(stats);
  return (
    <div className="stats">
      <div className="stats__grid">
        <Stat label="Streak" value={stats.streak} />
        <Stat label="Best" value={stats.best} />
        <Stat label="Accuracy" value={percent === null ? '—' : `${percent}%`} />
        <Stat label="Avg time" value={seconds === null ? '—' : `${seconds}s`} />
      </div>
      {stats.attempts > 0 && (
        <button type="button" className="button button--quiet button--small" onClick={onReset}>
          Reset stats
        </button>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
    </div>
  );
}

/**
 * Screen-reader announcements. Drills are audio-first by nature, so anything
 * shown as feedback is mirrored here for anyone not looking at the screen.
 */
export function Announcer({ message }) {
  return (
    <p className="visually-hidden" role="status" aria-live="polite">
      {message}
    </p>
  );
}

export function Feedback({ tone, children }) {
  if (!children) return null;
  return (
    <p className={`feedback feedback--${tone}`} role="status" aria-live="polite">
      {children}
    </p>
  );
}

export function ModeIntro({ title, children }) {
  return (
    <div className="intro">
      <h2 className="intro__title">{title}</h2>
      <p className="intro__body">{children}</p>
    </div>
  );
}
