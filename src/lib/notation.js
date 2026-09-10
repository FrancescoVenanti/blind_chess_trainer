// Turning what a player types into a legal move, and turning a legal move back
// into something worth reading aloud.

const PIECE_NAMES = { K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight', P: 'Pawn' };
const FILE_NAMES = { a: 'a', b: 'b', c: 'c', d: 'd', e: 'e', f: 'f', g: 'g', h: 'h' };

/** Strips decoration that players habitually leave off or add. */
function normalise(text) {
  return text
    .trim()
    .replace(/[!?]+$/g, '')
    .replace(/[+#]+$/g, '')
    .replace(/[–—]/g, '-') // en/em dashes from phone keyboards
    .replace(/\s+/g, '');
}

function castleForm(text) {
  const bare = text.toLowerCase().replace(/[-\s0]/g, (char) => (char === '0' ? 'o' : ''));
  if (bare === 'ooo') return 'O-O-O';
  if (bare === 'oo') return 'O-O';
  return null;
}

/**
 * Resolves a typed move against the legal moves in `game`.
 * Accepts SAN ("Nf3", "exd5", "O-O", "e8=Q"), long algebraic ("e2e4", "e2-e4")
 * and forgiving casing ("nf3", "NF3"), but refuses anything genuinely ambiguous
 * rather than guessing which piece the player meant.
 *
 * Returns `{ move }` on success or `{ error }` with a message worth showing.
 */
export function parseMove(game, input) {
  const raw = normalise(input ?? '');
  if (!raw) return { error: 'Type a move first.' };

  const legal = game.moves({ verbose: true });
  if (legal.length === 0) return { error: 'The game is over.' };

  const castle = castleForm(raw);
  if (castle) {
    const match = legal.find((move) => normalise(move.san) === castle);
    return match ? { move: match } : { error: `You cannot castle ${castle === 'O-O' ? 'kingside' : 'queenside'} here.` };
  }

  // 1. Exact SAN, case included: this is what settles "b4" (pawn) vs "Bb4".
  const exact = legal.find((move) => normalise(move.san) === raw);
  if (exact) return { move: exact };

  // 2. Long algebraic: e2e4, e2-e4, e7e8q
  const lan = raw.toLowerCase().replace(/[-=]/g, '');
  const lanMatch = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(lan);
  if (lanMatch) {
    const [, from, to, promotion] = lanMatch;
    const match = legal.find(
      (move) =>
        move.from === from &&
        move.to === to &&
        (promotion ? move.promotion === promotion : !move.promotion),
    );
    if (match) return { move: match };
    const occupant = game.get(from);
    if (!occupant) return { error: `There is nothing on ${from}.` };
    if (occupant.color !== game.turn()) return { error: `The piece on ${from} is not yours.` };
    return { error: `The ${PIECE_NAMES[occupant.type.toUpperCase()].toLowerCase()} on ${from} cannot reach ${to}.` };
  }

  // 3. Forgiving casing, but only when exactly one legal move can be meant.
  const loose = raw.toLowerCase();
  const candidates = legal.filter((move) => normalise(move.san).toLowerCase() === loose);
  if (candidates.length === 1) return { move: candidates[0] };
  if (candidates.length > 1) {
    return { error: `Ambiguous: could be ${candidates.map((move) => move.san).join(' or ')}.` };
  }

  // 4. Same again without the capture marker, for players who leave out the "x".
  const withoutX = loose.replace(/x/g, '');
  const relaxed = legal.filter(
    (move) => normalise(move.san).toLowerCase().replace(/x/g, '') === withoutX,
  );
  if (relaxed.length === 1) return { move: relaxed[0] };
  if (relaxed.length > 1) {
    return { error: `Ambiguous: could be ${relaxed.map((move) => move.san).join(' or ')}.` };
  }

  // 5. Piece and destination only, when the player left out the disambiguation
  // that SAN requires ("nc2" with knights on a1 and e1).
  const shorthand = /^([KQRBN])?([a-h][1-8])(?:=([QRBN]))?$/i.exec(loose.replace(/x/g, ''));
  if (shorthand) {
    const [, letter, destination, promotion] = shorthand;
    const type = letter ? letter.toLowerCase() : 'p';
    const reaching = legal.filter(
      (move) =>
        move.to === destination &&
        move.piece === type &&
        // No piece named on a promotion means a queen, not four-way ambiguity.
        (promotion ? move.promotion === promotion.toLowerCase() : !move.promotion || move.promotion === 'q'),
    );
    if (reaching.length === 1) return { move: reaching[0] };
    if (reaching.length > 1) {
      return {
        error: `Ambiguous: could be ${reaching.map((move) => move.san).join(' or ')}.`,
      };
    }
  }

  // 6. A pawn pushed to the last rank without naming a piece: assume a queen.
  const promotionGuess = legal.filter(
    (move) => move.promotion === 'q' && normalise(move.san).toLowerCase().replace(/x/g, '').replace('=q', '') === withoutX,
  );
  if (promotionGuess.length === 1) return { move: promotionGuess[0] };

  return { error: `"${input.trim()}" is not a legal move here.` };
}

/** "Nf3" -> "Knight f3", for reading a move out loud or showing a hint. */
export function describeSan(san) {
  if (!san) return '';
  const check = san.includes('#') ? ', checkmate' : san.includes('+') ? ', check' : '';
  const body = san.replace(/[+#!?]+$/g, '');

  if (body === 'O-O') return `Castles kingside${check}`;
  if (body === 'O-O-O') return `Castles queenside${check}`;

  const promotion = /=([QRBN])/.exec(body);
  const promotionText = promotion ? `, promoting to ${PIECE_NAMES[promotion[1]].toLowerCase()}` : '';
  const core = body.replace(/=[QRBN]/, '');

  const target = core.slice(-2);
  const takes = core.includes('x');
  const head = core.slice(0, core.length - 2).replace('x', '');

  if (!head || FILE_NAMES[head]) {
    // Pawn move: "e4", or a capture written as "exd5".
    const from = head ? `${FILE_NAMES[head]} ` : '';
    return `${from}${takes ? 'takes ' : ''}${target}${promotionText}${check}`.replace(/^ /, '');
  }

  const piece = PIECE_NAMES[head[0]] ?? head[0];
  const disambiguation = head.slice(1);
  const where = disambiguation ? ` ${disambiguation}` : '';
  return `${piece}${where} ${takes ? 'takes ' : ''}${target}${promotionText}${check}`;
}

/** Groups a SAN history into numbered pairs for display. */
export function toMovePairs(history) {
  const pairs = [];
  for (let i = 0; i < history.length; i += 2) {
    pairs.push({ number: i / 2 + 1, white: history[i], black: history[i + 1] ?? null });
  }
  return pairs;
}

export const PIECE_WORDS = PIECE_NAMES;
