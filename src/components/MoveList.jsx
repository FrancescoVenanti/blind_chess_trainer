import { useEffect, useRef } from 'react';
import { toMovePairs } from '../lib/notation.js';

/**
 * The move list is the whole board in "moves only" mode, so it stays scrolled
 * to the latest move and reads back as a proper list to a screen reader.
 */
export default function MoveList({ history, hidden = false, emptyText = 'No moves yet.' }) {
  const endRef = useRef(null);
  const pairs = toMovePairs(history);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [history.length]);

  if (hidden) {
    return (
      <div className="movelist movelist--hidden">
        <p>Moves hidden. {history.length} played — hold the position in your head.</p>
      </div>
    );
  }

  return (
    <div className="movelist">
      {pairs.length === 0 ? (
        <p className="movelist__empty">{emptyText}</p>
      ) : (
        <ol className="movelist__list">
          {pairs.map((pair) => (
            <li key={pair.number} className="movelist__pair">
              <span className="movelist__number">{pair.number}.</span>
              <span className="movelist__move">{pair.white}</span>
              <span className="movelist__move">{pair.black ?? ''}</span>
            </li>
          ))}
        </ol>
      )}
      <div ref={endRef} />
    </div>
  );
}
