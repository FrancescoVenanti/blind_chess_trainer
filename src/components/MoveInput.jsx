import { useEffect, useRef, useState } from 'react';

/**
 * Where a blindfold game actually happens. Phone keyboards love to capitalise
 * and autocorrect chess notation into nonsense, so all of that is switched off.
 */
export default function MoveInput({ onSubmit, disabled, placeholder = 'e4, Nf3, O-O…', error }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  function handleSubmit(event) {
    event.preventDefault();
    if (disabled) return;
    const accepted = onSubmit(value);
    if (accepted) setValue(''); // keep a rejected move so it can be corrected
  }

  return (
    <form className="moveinput" onSubmit={handleSubmit}>
      <label className="visually-hidden" htmlFor="move-input">
        Your move in chess notation
      </label>
      <input
        id="move-input"
        ref={inputRef}
        className={`moveinput__field${error ? ' has-error' : ''}`}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        enterKeyHint="go"
        inputMode="text"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'move-input-error' : undefined}
      />
      <button type="submit" className="button button--primary" disabled={disabled}>
        Play move
      </button>
      {error && (
        <p className="moveinput__error" id="move-input-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
