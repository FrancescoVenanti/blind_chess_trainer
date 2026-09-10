import { FILES, RANKS } from './squares.js';

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
