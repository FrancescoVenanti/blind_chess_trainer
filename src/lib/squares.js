// Pure helpers for reasoning about board geometry without a board in front of you.

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
export const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

export const ALL_SQUARES = RANKS.slice()
  .reverse()
  .flatMap((rank) => FILES.map((file) => file + rank));

export function fileIndex(square) {
  return square.charCodeAt(0) - 97; // 'a' -> 0
}

export function rankIndex(square) {
  return square.charCodeAt(1) - 49; // '1' -> 0
}

export function toSquare(file, rank) {
  return FILES[file] + RANKS[rank];
}

export function isSquare(value) {
  return typeof value === 'string' && /^[a-h][1-8]$/.test(value);
}

/** a1 is dark, so a square is light when file + rank indices sum to an odd number. */
export function squareColor(square) {
  return (fileIndex(square) + rankIndex(square)) % 2 === 1 ? 'light' : 'dark';
}

export function sameDiagonal(a, b) {
  const df = Math.abs(fileIndex(a) - fileIndex(b));
  const dr = Math.abs(rankIndex(a) - rankIndex(b));
  return df !== 0 && df === dr;
}

export function sameLine(a, b) {
  if (a === b) return false;
  return fileIndex(a) === fileIndex(b) || rankIndex(a) === rankIndex(b);
}

const KNIGHT_DELTAS = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];

export function knightMoves(square) {
  const f = fileIndex(square);
  const r = rankIndex(square);
  const result = [];
  for (const [df, dr] of KNIGHT_DELTAS) {
    const nf = f + df;
    const nr = r + dr;
    if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) result.push(toSquare(nf, nr));
  }
  return result;
}

export function isKnightMove(from, to) {
  const df = Math.abs(fileIndex(from) - fileIndex(to));
  const dr = Math.abs(rankIndex(from) - rankIndex(to));
  return (df === 1 && dr === 2) || (df === 2 && dr === 1);
}

/** Breadth-first search over an empty board. Returns the number of knight hops. */
export function knightDistance(from, to) {
  if (from === to) return 0;
  const seen = new Set([from]);
  let frontier = [from];
  let depth = 0;
  while (frontier.length) {
    depth += 1;
    const next = [];
    for (const square of frontier) {
      for (const hop of knightMoves(square)) {
        if (hop === to) return depth;
        if (seen.has(hop)) continue;
        seen.add(hop);
        next.push(hop);
      }
    }
    frontier = next;
  }
  return Infinity;
}

export function randomSquare(exclude = []) {
  const pool = ALL_SQUARES.filter((square) => !exclude.includes(square));
  return pool[Math.floor(Math.random() * pool.length)];
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
