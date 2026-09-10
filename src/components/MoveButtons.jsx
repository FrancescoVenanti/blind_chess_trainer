import { describeSan } from '../lib/notation.js';

// Grouped the way you would scan them: pawns first, then up through the pieces.
const GROUPS = [
  { key: 'P', label: 'Pawn' },
  { key: 'N', label: 'Knight' },
  { key: 'B', label: 'Bishop' },
  { key: 'R', label: 'Rook' },
  { key: 'Q', label: 'Queen' },
  { key: 'K', label: 'King' },
  { key: 'O', label: 'Castling' },
];

/** SAN says which piece moved: a leading capital, or a pawn if there is none. */
function pieceOf(san) {
  if (san.startsWith('O-O')) return 'O';
  return /^[KQRBN]/.test(san) ? san[0] : 'P';
}

/**
 * Every legal move as a button, for players who would rather pick than type.
 * The buttons still show real notation, so it stays a notation exercise —
 * you just do not have to spell the move yourself.
 */
export default function MoveButtons({ moves, onPlay, disabled }) {
  if (moves.length === 0) return null;

  const grouped = GROUPS.map((group) => ({
    ...group,
    moves: moves.filter((san) => pieceOf(san) === group.key).sort((a, b) => a.localeCompare(b)),
  })).filter((group) => group.moves.length > 0);

  return (
    <div className="movebuttons">
      <p className="movebuttons__count">
        {moves.length} legal move{moves.length === 1 ? '' : 's'}
      </p>
      {grouped.map((group) => (
        <div key={group.key} className="movebuttons__group">
          <h4 className="movebuttons__label">{group.label}</h4>
          <div className="movebuttons__grid">
            {group.moves.map((san) => (
              <button
                key={san}
                type="button"
                className="button button--move"
                onClick={() => onPlay(san)}
                disabled={disabled}
                aria-label={describeSan(san)}
              >
                {san}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
