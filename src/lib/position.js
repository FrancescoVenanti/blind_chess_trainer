import { FILES, RANKS } from './squares.js';

const PIECE_NAMES = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };

/** 'n' -> 'knight', for labels and spoken descriptions. */
export function pieceName(type) {
  return PIECE_NAMES[type];
}

/** Converts a chess.js `board()` array into a square -> piece map. */
export function piecesFromGame(game) {
  const map = {};
  game.board().forEach((row, rankIndex) => {
    row.forEach((piece, fileIndex) => {
      if (piece) map[FILES[fileIndex] + RANKS[7 - rankIndex]] = piece;
    });
  });
  return map;
}
