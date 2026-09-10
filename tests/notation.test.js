import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { describeSan, parseMove, toMovePairs } from '../src/lib/notation.js';

const opening = () => new Chess();

test('accepts plain SAN', () => {
  assert.equal(parseMove(opening(), 'e4').move.san, 'e4');
  assert.equal(parseMove(opening(), 'Nf3').move.san, 'Nf3');
});

test('forgives casing and stray whitespace', () => {
  assert.equal(parseMove(opening(), ' nf3 ').move.san, 'Nf3');
  assert.equal(parseMove(opening(), 'NF3').move.san, 'Nf3');
});

test('exact case still decides pawn b4 from bishop b4', () => {
  // Both the b2 pawn and the a3 bishop can reach b4, so casing is the only
  // thing separating them and must not be "helpfully" ignored.
  const game = new Chess('4k3/8/8/8/8/B7/1P6/4K3 w - - 0 1');
  assert.equal(parseMove(game, 'b4').move.san, 'b4');
  assert.equal(parseMove(game, 'Bb4').move.san, 'Bb4');
});

test('accepts long algebraic and dashes', () => {
  assert.equal(parseMove(opening(), 'e2e4').move.san, 'e4');
  assert.equal(parseMove(opening(), 'e2-e4').move.san, 'e4');
  assert.equal(parseMove(opening(), 'g1f3').move.san, 'Nf3');
});

test('accepts castling in every spelling', () => {
  const fen = 'rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
  for (const input of ['O-O', '0-0', 'o-o', 'oo']) {
    assert.equal(parseMove(new Chess(fen), input).move.san, 'O-O', input);
  }
});

test('tolerates a missing capture marker and check symbol', () => {
  const game = new Chess('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
  assert.equal(parseMove(game, 'ed5').move.san, 'exd5');
  assert.equal(parseMove(game, 'exd5+').move.san, 'exd5');
});

test('assumes a queen when a promotion names no piece', () => {
  const game = new Chess('8/4P3/8/8/8/8/8/K6k w - - 0 1');
  assert.equal(parseMove(game, 'e8').move.san, 'e8=Q');
  assert.equal(parseMove(game, 'e8=N').move.san, 'e8=N');
  assert.equal(parseMove(game, 'e7e8n').move.san, 'e8=N');
});

test('reports why a move was refused', () => {
  assert.match(parseMove(opening(), '').error, /Type a move/);
  assert.match(parseMove(opening(), 'e5').error, /not a legal move/);
  assert.match(parseMove(opening(), 'a1a8').error, /rook on a1 cannot reach a8/);
  assert.match(parseMove(opening(), 'e3e4').error, /nothing on e3/);
  assert.match(parseMove(opening(), 'e7e5').error, /not yours/);
  assert.match(parseMove(opening(), 'O-O').error, /cannot castle kingside/);
});

test('flags a genuinely ambiguous move instead of guessing', () => {
  // Knights on a1 and e1 both reach c2, so "Nc2" alone cannot say which.
  const game = new Chess('4k3/8/8/8/8/8/8/N3NK2 w - - 0 1');
  const result = parseMove(game, 'Nc2');
  assert.ok(result.error, 'should not silently pick a knight');
  assert.match(result.error, /Ambiguous: could be Nac2 or Nec2/);
  assert.equal(parseMove(game, 'Nac2').move.san, 'Nac2');
  assert.equal(parseMove(game, 'nec2').move.san, 'Nec2');
});

test('fills in disambiguation the player left out when only one piece fits', () => {
  const game = new Chess('4k3/8/8/8/8/8/8/N4K2 w - - 0 1');
  assert.equal(parseMove(game, 'nc2').move.san, 'Nc2');
});

test('describes moves the way you would say them', () => {
  assert.equal(describeSan('e4'), 'e4');
  assert.equal(describeSan('Nf3'), 'Knight f3');
  assert.equal(describeSan('exd5'), 'e takes d5');
  assert.equal(describeSan('Qxf7#'), 'Queen takes f7, checkmate');
  assert.equal(describeSan('Rae1'), 'Rook a e1');
  assert.equal(describeSan('O-O'), 'Castles kingside');
  assert.equal(describeSan('O-O-O+'), 'Castles queenside, check');
  assert.equal(describeSan('e8=Q+'), 'e8, promoting to queen, check');
  assert.equal(describeSan('Bb5+'), 'Bishop b5, check');
});

test('groups history into numbered pairs', () => {
  assert.deepEqual(toMovePairs(['e4', 'e5', 'Nf3']), [
    { number: 1, white: 'e4', black: 'e5' },
    { number: 2, white: 'Nf3', black: null },
  ]);
  assert.deepEqual(toMovePairs([]), []);
});
