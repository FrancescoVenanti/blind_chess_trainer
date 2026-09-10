// Runs the search off the main thread so a two-second think never freezes the
// page (which on a phone would look like the app had crashed).

import { Chess } from 'chess.js';
import { findBestMove } from './engine.js';

self.onmessage = (event) => {
  const { id, fen, options } = event.data ?? {};
  try {
    const game = new Chess(fen);
    const result = findBestMove(game, options);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error?.message ?? 'Engine failed' });
  }
};
