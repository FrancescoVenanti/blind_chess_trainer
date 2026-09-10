import { FILES, RANKS, squareColor } from '../lib/squares.js';
import PieceIcon from './Pieces.jsx';
import { pieceName } from '../lib/position.js';

function describeSquare(square, piece) {
  const shade = squareColor(square);
  if (!piece) return `${square}, empty ${shade} square`;
  return `${square}, ${piece.color === 'w' ? 'white' : 'black'} ${pieceName(piece.type)}`;
}

/**
 * The board, which in this app spends most of its time with nothing on it.
 *
 * `pieces` is a map of square -> { type, color }; pass null for the empty grid
 * that the blindfold modes rely on.
 */
export default function Board({
  pieces = null,
  orientation = 'white',
  showCoordinates = true,
  highlights = {},
  lastMove = null,
  onSquareClick = null,
  disabledSquares = [],
  label = 'Chess board',
}) {
  const files = orientation === 'white' ? FILES : [...FILES].reverse();
  const ranks = orientation === 'white' ? [...RANKS].reverse() : RANKS;
  const interactive = typeof onSquareClick === 'function';

  return (
    <div className="board-wrap">
      <div
        className={`board${showCoordinates ? ' board--coords' : ''}`}
        role={interactive ? 'grid' : 'img'}
        aria-label={interactive ? undefined : label}
      >
        {ranks.map((rank) =>
          files.map((file) => {
            const square = file + rank;
            const piece = pieces?.[square] ?? null;
            const classes = ['square', `square--${squareColor(square)}`];
            if (highlights[square]) classes.push(`square--${highlights[square]}`);
            if (lastMove && (square === lastMove.from || square === lastMove.to)) {
              classes.push('square--last');
            }
            const content = (
              <>
                {showCoordinates && file === files[0] && (
                  <span className="square__rank" aria-hidden="true">{rank}</span>
                )}
                {showCoordinates && rank === ranks[ranks.length - 1] && (
                  <span className="square__file" aria-hidden="true">{file}</span>
                )}
                {piece && <PieceIcon type={piece.type} color={piece.color} />}
              </>
            );

            return interactive ? (
              <button
                key={square}
                type="button"
                data-square={square}
                className={classes.join(' ')}
                onClick={() => onSquareClick(square)}
                disabled={disabledSquares.includes(square)}
                aria-label={describeSquare(square, piece)}
              >
                {content}
              </button>
            ) : (
              <div key={square} data-square={square} className={classes.join(' ')}>
                {content}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
