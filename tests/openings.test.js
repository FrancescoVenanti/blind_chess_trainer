import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { OPENINGS, randomOpening } from '../src/lib/openings.js';

test('every stored opening line is legal', () => {
  for (const opening of OPENINGS) {
    const game = new Chess();
    for (const san of opening.moves) {
      assert.doesNotThrow(() => game.move(san), `${opening.name}: ${san}`);
    }
    assert.ok(opening.moves.length >= 12, `${opening.name} is long enough for the 8-move drill`);
  }
});

test('lines are usable at every offered length', () => {
  for (const opening of OPENINGS) {
    for (const moves of [8, 12, 16]) {
      const game = new Chess();
      opening.moves.slice(0, moves).forEach((san) => game.move(san));
      assert.ok(!game.isGameOver(), `${opening.name} is still a game after ${moves} half-moves`);
    }
  }
});

test('randomOpening returns one of the stored lines', () => {
  for (let i = 0; i < 20; i += 1) assert.ok(OPENINGS.includes(randomOpening()));
});
