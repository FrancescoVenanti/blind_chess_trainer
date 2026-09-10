import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { createAdapter, evaluateFen, findBestMove, DIFFICULTIES, DIFFICULTY_ORDER } from '../src/lib/engine.js';

/** Plays the engine's choice and returns it in SAN, which is easier to assert on. */
function bestSan(fen, level = 'club') {
  const game = new Chess(fen);
  const result = findBestMove(game, DIFFICULTIES[level]);
  assert.ok(result, 'engine returned no move');
  const move = game.move(result.move);
  assert.ok(move, `engine returned an illegal move: ${JSON.stringify(result.move)}`);
  return move.san;
}

test('the fast adapter is available and matches the reference evaluation', () => {
  const game = new Chess();
  const api = createAdapter(game);
  assert.ok(api.fast, 'expected the internal chess.js move API');

  for (let i = 0; i < 300; i += 1) {
    assert.equal(api.evaluate(), evaluateFen(game.fen()), game.fen());
    const moves = game.moves();
    if (!moves.length) break;
    game.move(moves[Math.floor(Math.random() * moves.length)]);
  }
});

test('evaluation is symmetric between the colours', () => {
  assert.equal(evaluateFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1'), evaluateFen('4k3/8/8/8/8/8/8/4K3 b - - 0 1'));
  // A white extra rook is as good for White as a black extra rook is for Black.
  const white = evaluateFen('4k3/8/8/8/8/8/8/R3K3 w - - 0 1');
  const black = evaluateFen('r3k3/8/8/8/8/8/8/4K3 b - - 0 1');
  assert.equal(white, black);
  assert.ok(white > 400);
});

test('finds mate in one', () => {
  assert.equal(bestSan('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4'), 'Qxf7#');
  assert.equal(bestSan('6k1/5ppp/8/8/8/8/8/R3K3 w Q - 0 1'), 'Ra8#');
});

test('takes free material', () => {
  assert.equal(bestSan('4k3/8/8/3r4/4B3/8/8/4K3 w - - 0 1', 'casual'), 'Bxd5');
  assert.equal(bestSan('4k3/8/8/8/8/8/4q3/4K2R w K - 0 1', 'casual'), 'Kxe2');
});

test('moves a hanging queen out of the way', () => {
  assert.match(bestSan('rnb1kbnr/pppp1ppp/8/8/4q3/2N5/PPPPPPPP/R1BQKBNR b KQkq - 0 1'), /^Q/);
});

test('does not stalemate when it can still win', () => {
  assert.notEqual(bestSan('7k/8/6Q1/8/8/8/8/K7 w - - 0 1'), 'Qg7');
});

test('every difficulty returns a legal move inside its time budget', () => {
  const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
  for (const level of DIFFICULTY_ORDER) {
    const game = new Chess(fen);
    const started = performance.now();
    const result = findBestMove(game, DIFFICULTIES[level]);
    const elapsed = performance.now() - started;
    assert.ok(game.move(result.move), `${level} produced an illegal move`);
    assert.ok(result.depth >= 1, `${level} searched no depth at all`);
    assert.ok(
      elapsed < DIFFICULTIES[level].timeBudgetMs + 1000,
      `${level} took ${Math.round(elapsed)}ms against a ${DIFFICULTIES[level].timeBudgetMs}ms budget`,
    );
  }
});

test('refuses a poisoned pawn that only a deeper search rejects', () => {
  // Qxd5 wins a pawn and loses the queen to cxd5. One ply calls it winning.
  const poisoned = '4k3/8/2p5/3p4/8/8/3Q4/4K3 w - - 0 1';
  for (const level of ['casual', 'club', 'sharp']) {
    assert.notEqual(bestSan(poisoned, level), 'Qxd5', `${level} grabbed the poisoned pawn`);
  }
});

test('takes a defended rook when the exchange still wins material', () => {
  // Bxd5 invites cxd5, but bishop for rook is still a clear profit.
  assert.match(bestSan('4k3/8/2p5/3r4/8/8/6B1/4K3 w - - 0 1', 'club'), /xd5$/);
});

test('a full self-play game stays legal and terminates', () => {
  const game = new Chess();
  let plies = 0;
  while (!game.isGameOver() && plies < 120) {
    const result = findBestMove(game, DIFFICULTIES.gentle);
    assert.ok(result, 'engine gave up mid-game');
    assert.ok(game.move(result.move), `illegal move at ply ${plies}: ${JSON.stringify(result.move)}`);
    plies += 1;
  }
  assert.ok(plies > 0);
});

test('returns null only when there are no moves', () => {
  const mated = new Chess('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
  assert.ok(mated.isCheckmate());
  assert.equal(findBestMove(mated, DIFFICULTIES.gentle), null);
});
