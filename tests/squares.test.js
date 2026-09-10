import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_SQUARES,
  isKnightMove,
  isSquare,
  knightDistance,
  knightMoves,
  sameDiagonal,
  sameLine,
  squareColor,
} from '../src/lib/squares.js';

test('the board has 64 unique squares', () => {
  assert.equal(ALL_SQUARES.length, 64);
  assert.equal(new Set(ALL_SQUARES).size, 64);
});

test('square colours match a real board', () => {
  assert.equal(squareColor('a1'), 'dark');
  assert.equal(squareColor('h1'), 'light');
  assert.equal(squareColor('a8'), 'light');
  assert.equal(squareColor('h8'), 'dark');
  assert.equal(squareColor('e4'), 'light');
  assert.equal(squareColor('d4'), 'dark');
});

test('adjacent squares always differ in colour', () => {
  for (const square of ALL_SQUARES) {
    const file = square.charCodeAt(0);
    const right = String.fromCharCode(file + 1) + square[1];
    if (isSquare(right)) assert.notEqual(squareColor(square), squareColor(right));
  }
});

test('diagonals and lines', () => {
  assert.ok(sameDiagonal('c1', 'h6'));
  assert.ok(sameDiagonal('a1', 'h8'));
  assert.ok(!sameDiagonal('a1', 'h7'));
  assert.ok(!sameDiagonal('e4', 'e4'), 'a square is not diagonal to itself');
  assert.ok(sameLine('d1', 'd8'));
  assert.ok(sameLine('a4', 'h4'));
  assert.ok(!sameLine('a4', 'b5'));
  assert.ok(!sameLine('e4', 'e4'));
});

test('knight moves stay on the board and change square colour', () => {
  assert.deepEqual(knightMoves('a1').sort(), ['b3', 'c2']);
  assert.equal(knightMoves('e4').length, 8);
  for (const square of ALL_SQUARES) {
    for (const hop of knightMoves(square)) {
      assert.ok(isKnightMove(square, hop));
      assert.notEqual(squareColor(square), squareColor(hop));
    }
  }
});

test('knight distance is symmetric and reaches every square', () => {
  assert.equal(knightDistance('e4', 'e4'), 0);
  assert.equal(knightDistance('b1', 'c3'), 1);
  assert.equal(knightDistance('a1', 'b2'), 4); // the famous awkward one
  assert.equal(knightDistance('a1', 'h8'), 6);
  for (const square of ALL_SQUARES) {
    const distance = knightDistance('d4', square);
    assert.ok(Number.isFinite(distance) && distance <= 6);
    assert.equal(distance, knightDistance(square, 'd4'));
  }
});

test('isSquare rejects nonsense', () => {
  assert.ok(isSquare('a1'));
  assert.ok(!isSquare('i1'));
  assert.ok(!isSquare('a9'));
  assert.ok(!isSquare('A1'));
  assert.ok(!isSquare(''));
  assert.ok(!isSquare(null));
});
