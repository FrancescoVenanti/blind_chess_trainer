// A small negamax engine: material + piece-square tables, alpha-beta with
// MVV-LVA ordering and a capture-only quiescence search. Strong enough to
// punish a hanging piece, light enough to stay instant on a phone.
//
// The search deliberately avoids chess.js's `moves({ verbose: true })`, which
// builds a SAN string and two FEN strings per move (~750us per node). It uses
// the library's internal move descriptors instead, and falls back to the
// public API if a future version stops exposing them.

const PIECE_VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

// Tables read from White's point of view, rank 8 first (index 0 === a8).
const PST = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 20, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20,
  ],
};

const KING_ENDGAME = [
  -50, -40, -30, -20, -20, -30, -40, -50,
  -30, -20, -10, 0, 0, -10, -20, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -30, 0, 0, 0, 0, -30, -30,
  -50, -30, -30, -30, -30, -30, -30, -50,
];

export const MATE_SCORE = 100000;

/** Below this much non-pawn material, kings should walk towards the centre. */
const ENDGAME_MATERIAL = 1300;

function pieceScore(type, isWhite, index) {
  // The tables are written for White, so mirror the rank for Black.
  const pstIndex = isWhite ? index : (7 - (index >> 3)) * 8 + (index & 7);
  return { pstIndex, base: PIECE_VALUE[type] + PST[type][pstIndex] };
}

function combine(score, kings, nonPawnMaterial, turn) {
  const endgame = nonPawnMaterial <= ENDGAME_MATERIAL;
  const table = endgame ? KING_ENDGAME : PST.k;
  for (const king of kings) {
    score += king.sign * table[king.pstIndex];
  }
  return turn === 'w' ? score : 0 - score; // 0 - score keeps a level position at +0
}

/**
 * Static evaluation in centipawns, from the side-to-move's point of view.
 * This is the reference implementation; the search uses the equivalent
 * `evaluateBoard` below, and a unit test keeps the two in agreement.
 */
export function evaluateFen(fen) {
  const [placement, turn] = fen.split(' ');
  let score = 0;
  let index = 0;
  let nonPawnMaterial = 0;
  const kings = [];

  for (let i = 0; i < placement.length; i += 1) {
    const char = placement[i];
    if (char === '/') continue;
    if (char >= '1' && char <= '8') {
      index += char.charCodeAt(0) - 48;
      continue;
    }
    const isWhite = char >= 'A' && char <= 'Z';
    const type = char.toLowerCase();
    const { pstIndex, base } = pieceScore(type, isWhite, index);
    if (type === 'k') {
      kings.push({ pstIndex, sign: isWhite ? 1 : -1 });
    } else {
      score += (isWhite ? 1 : -1) * base;
      if (type !== 'p') nonPawnMaterial += PIECE_VALUE[type];
    }
    index += 1;
  }
  return combine(score, kings, nonPawnMaterial, turn);
}

/** Same evaluation, reading chess.js's internal 0x88 board array directly. */
function evaluateBoard(board, turn) {
  let score = 0;
  let nonPawnMaterial = 0;
  const kings = [];

  for (let square = 0; square <= 119; square += 1) {
    if (square & 0x88) {
      square += 7; // skip the unused half of each 0x88 row
      continue;
    }
    const piece = board[square];
    if (!piece) continue;
    const index = (square >> 4) * 8 + (square & 7); // 0 === a8, matching the tables
    const isWhite = piece.color === 'w';
    const { pstIndex, base } = pieceScore(piece.type, isWhite, index);
    if (piece.type === 'k') {
      kings.push({ pstIndex, sign: isWhite ? 1 : -1 });
    } else {
      score += (isWhite ? 1 : -1) * base;
      if (piece.type !== 'p') nonPawnMaterial += PIECE_VALUE[piece.type];
    }
  }
  return combine(score, kings, nonPawnMaterial, turn);
}

const FILE_CHARS = 'abcdefgh';
const RANK_CHARS = '87654321';

function algebraic(square) {
  return FILE_CHARS[square & 0xf] + RANK_CHARS[square >> 4];
}

const MVV_LVA = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };

function scoreMove(move) {
  let score = 0;
  if (move.captured) score += 1000 + MVV_LVA[move.captured] * 10 - MVV_LVA[move.piece];
  if (move.promotion) score += 900 + MVV_LVA[move.promotion];
  return score;
}

function byScoreDescending(a, b) {
  return scoreMove(b) - scoreMove(a);
}

/**
 * Wraps a chess.js instance with the cheapest move/make/undo/evaluate calls
 * that version offers. `fast` uses the internal descriptors; the fallback
 * sticks to documented methods so the app still works (just slower) if a
 * future chess.js hides its internals.
 */
export function createAdapter(game) {
  const fast =
    typeof game._moves === 'function' &&
    typeof game._makeMove === 'function' &&
    typeof game._undoMove === 'function' &&
    Array.isArray(game._board);

  if (fast) {
    return {
      fast: true,
      moves: () => game._moves({ legal: true }),
      make: (move) => game._makeMove(move),
      undo: () => game._undoMove(),
      evaluate: () => evaluateBoard(game._board, game._turn),
      toPublic: (move) => ({
        from: algebraic(move.from),
        to: algebraic(move.to),
        promotion: move.promotion,
      }),
    };
  }
  return {
    fast: false,
    moves: () => game.moves({ verbose: true }),
    make: (move) => game.move(move),
    undo: () => game.undo(),
    evaluate: () => evaluateFen(game.fen()),
    toPublic: (move) => ({ from: move.from, to: move.to, promotion: move.promotion }),
  };
}

const MAX_QUIESCENCE_PLY = 6;

/**
 * Capture-only search, so the main search never evaluates a position in the
 * middle of an exchange. Fail-soft: it returns the score it actually found
 * rather than the window bound, which keeps root scores comparable.
 */
function quiescence(game, api, alpha, beta, ply, counter, deadline) {
  counter.nodes += 1;
  if ((counter.nodes & 1023) === 0 && performance.now() > deadline) counter.aborted = true;
  if (counter.aborted) return 0;

  const inCheck = game.isCheck();
  let candidates;
  let best;

  if (inCheck) {
    // Never stand pat in check: search every evasion, so mates are still seen.
    candidates = api.moves();
    if (candidates.length === 0) return -MATE_SCORE + ply;
    if (ply >= MAX_QUIESCENCE_PLY) return api.evaluate();
    best = -Infinity;
  } else {
    best = api.evaluate(); // standing pat: assume we can decline every capture
    if (best >= beta) return best;
    if (best > alpha) alpha = best;
    if (ply >= MAX_QUIESCENCE_PLY) return best;
    candidates = api.moves().filter((move) => move.captured || move.promotion);
    if (candidates.length === 0) return best;
  }

  candidates.sort(byScoreDescending);
  for (const move of candidates) {
    api.make(move);
    const score = -quiescence(game, api, -beta, -alpha, ply + 1, counter, deadline);
    api.undo();
    if (counter.aborted) return 0;
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function negamax(game, api, depth, alpha, beta, ply, counter, deadline) {
  counter.nodes += 1;
  if ((counter.nodes & 1023) === 0 && performance.now() > deadline) counter.aborted = true;
  if (counter.aborted) return 0;
  if (depth <= 0) return quiescence(game, api, alpha, beta, ply, counter, deadline);

  const moves = api.moves();
  if (moves.length === 0) {
    return game.isCheck() ? -MATE_SCORE + ply : 0; // checkmate or stalemate
  }
  moves.sort(byScoreDescending);

  let best = -Infinity;
  for (const move of moves) {
    api.make(move);
    const score = -negamax(game, api, depth - 1, -beta, -alpha, ply + 1, counter, deadline);
    api.undo();
    if (counter.aborted) return 0;
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * Iterative-deepening root search. Returns `{ move, score, depth, nodes }`
 * where `move` is a plain `{ from, to, promotion }` playable via `game.move()`.
 *
 * `randomness` keeps every reply within that many centipawns of the best one
 * in the running, so the easier levels vary their play instead of grinding out
 * the same line every game.
 */
export function findBestMove(game, options = {}) {
  const { depth = 3, timeBudgetMs = 1200, randomness = 0 } = options;
  const api = createAdapter(game);
  const rootMoves = api.moves();
  if (rootMoves.length === 0) return null;

  // Scores are only comparable to each other when each root move was searched
  // with a full window, which the randomised levels need to build their pool.
  const exactScores = randomness > 0;
  const counter = { nodes: 0, aborted: false };
  const start = performance.now();
  const deadline = start + timeBudgetMs;
  rootMoves.sort(byScoreDescending);
  let scored = rootMoves.map((move) => ({ move, score: 0 }));
  let completedDepth = 0;
  let lastPlyMs = 0;
  let branching = 4;
  let deeperBest = null;

  for (let currentDepth = 1; currentDepth <= depth; currentDepth += 1) {
    // Don't start an iteration the clock can't pay for: estimate its cost from
    // how much the last ply cost relative to the one before it.
    const elapsed = performance.now() - start;
    if (currentDepth > 1 && elapsed + lastPlyMs * branching > timeBudgetMs) break;

    const plyStart = performance.now();
    const results = [];
    let alpha = -Infinity;
    for (const { move } of scored) {
      api.make(move);
      // With `randomness` on we need an exact score for every root move, so
      // each gets a full window; that costs the pruning between siblings.
      // The top level plays only the best move, so there it keeps the window
      // narrow and buys another ply of depth instead.
      const score = -negamax(
        game,
        api,
        currentDepth - 1,
        -Infinity,
        exactScores ? Infinity : -alpha,
        1,
        counter,
        deadline,
      );
      api.undo();
      if (counter.aborted) break;
      results.push({ move, score });
      if (score > alpha) alpha = score;
    }
    if (counter.aborted || results.length < scored.length) {
      // Root moves are searched best-first, so even a cut-short iteration has
      // trustworthy scores for the moves that mattered. Keep its winner.
      if (results.length > 0) {
        results.sort((a, b) => b.score - a.score);
        deeperBest = results[0];
      }
      break;
    }

    const plyMs = performance.now() - plyStart;
    if (lastPlyMs > 0) branching = Math.min(8, Math.max(2, plyMs / lastPlyMs));
    lastPlyMs = plyMs;

    results.sort((a, b) => b.score - a.score);
    scored = results;
    completedDepth = currentDepth;
    if (scored[0].score >= MATE_SCORE - 100) break; // forced mate found
  }

  let chosen = deeperBest ?? scored[0];
  if (randomness > 0 && completedDepth > 0) {
    // Only scores from a fully completed iteration are comparable to each other.
    const pool = scored.filter((entry) => scored[0].score - entry.score <= randomness);
    chosen = pool[Math.floor(Math.random() * pool.length)];
  }
  return {
    move: api.toPublic(chosen.move),
    score: chosen.score,
    depth: completedDepth,
    nodes: counter.nodes,
  };
}

export const DIFFICULTIES = {
  gentle: { key: 'gentle', label: 'Gentle', hint: 'Sees one move ahead', depth: 1, timeBudgetMs: 300, randomness: 80 },
  casual: { key: 'casual', label: 'Casual', hint: 'Takes what you hang', depth: 2, timeBudgetMs: 800, randomness: 40 },
  club: { key: 'club', label: 'Club', hint: 'Punishes loose pieces', depth: 3, timeBudgetMs: 1800, randomness: 15 },
  sharp: { key: 'sharp', label: 'Sharp', hint: 'Plays the best it finds', depth: 4, timeBudgetMs: 6000, randomness: 0 },
};

export const DIFFICULTY_ORDER = ['gentle', 'casual', 'club', 'sharp'];
