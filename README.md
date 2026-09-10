# Blindfold Chess Trainer

A browser app for learning to play chess without seeing the pieces. Play a full
game against a built-in engine with as much of the board hidden as you can
handle, and drill the underlying skills — square colours, knight routes, board
geometry and move recall — in between.

Everything runs in the tab: no account, no server, no network calls. Progress is
kept in `localStorage`, so it stays on the device.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Unit tests (engine, notation, geometry, opening data) |
| `npm run lint` | oxlint |
| `npm run check` | lint, then tests, then build |

## The modes

**Play** — a real game against the engine, with three levels of difficulty for
your *eyes* rather than the opponent:

- **Board + pieces** — everything visible. A warm-up for the notation itself.
- **Empty board** — the grid and its coordinates, nothing on it. You still get
  the geometry for free, but you have to place every piece yourself.
- **Moves only** — no board at all. Just the last move, in large type, and the
  move list.

You type moves in algebraic notation. It accepts what people actually type:
`Nf3`, `nf3`, `e2e4`, `e2-e4`, `exd5`, `ed5`, `0-0`, `oo`, `e8` for a queening
pawn. Where two pieces could be meant, it says so rather than guessing.

There is a **Peek** button that shows the position for four seconds and counts
how often you used it, a **Hint**, and **Take back**. Turning on *Read moves
aloud* has the browser speak each move, which is much closer to a real
blindfold game than reading them.

Four opponent strengths, from *Gentle* (one ply, plays loosely) to *Sharp*
(four plies, plays the best move it finds).

**Squares** — name a square's colour, or find a named square on a bare grid.
This is the foundation: knowing instantly that f3 is light is what stops you
putting a bishop somewhere it can never go.

**Knight** — route a knight between two squares, either by naming the number of
hops or by typing the whole path. The knight is the first piece people lose
track of, because its move is the only one you cannot read off a line.

**Vision** — yes/no questions from coordinates alone, with no board on screen at
all. Same diagonal? Same rank or file? Could a bishop on c1 ever reach h6?

**Recall** — follow a real opening line one move at a time, then answer three
questions about the position you ended up with: what stands on a given square,
where a piece ended up, and how many pawns each side has.

Every drill tracks streak, best streak, accuracy and average answer time.

## How it works

```
src/
  lib/
    engine.js        search and evaluation
    engine.worker.js runs the search off the main thread
    useEngine.js     React hook over the worker, with a main-thread fallback
    notation.js      parsing typed moves, and describing moves in words
    squares.js       board geometry (colours, diagonals, knight distance)
    position.js      chess.js board -> square/piece map
    openings.js      the opening lines used by Recall
    speech.js        speech synthesis, degrading to silence
    storage.js       localStorage stats, degrading to session-only
  components/        Board, MoveList, MoveInput and small shared UI
  modes/             one file per mode
```

### The engine

Negamax with alpha-beta, iterative deepening under a time budget, MVV-LVA move
ordering and a capture-only quiescence search that also searches check evasions
so it does not miss mates at the horizon. Evaluation is material plus
piece-square tables, with the king's table swapped for a centralising one once
the heavy pieces come off.

[chess.js](https://github.com/jhlywa/chess.js) provides move generation and
legality. The search deliberately avoids `moves({ verbose: true })`, which
builds a SAN string and two FEN strings for every move — around 750µs per node,
or roughly a thousand nodes a second. Going through the library's internal move
descriptors instead gets that to about 35,000 nodes a second, which is the
difference between a four-ply search taking two minutes and taking two seconds.
`createAdapter` falls back to the public API if a future chess.js stops
exposing those internals, so the app keeps working — just slower.

The easier levels do not simply search less: they pick at random among replies
within a few tenths of a pawn of the best one, so they vary their play instead
of repeating the same line. That needs comparable scores for every root move,
so those levels search each root move with a full window; the hardest level,
which only ever plays the best move, keeps the window narrow and spends the
savings on another ply.

### Accessibility

The whole app is usable without seeing it, which for this subject is the point.
Move announcements and drill feedback go through `aria-live` regions, the board
exposes every square with its coordinate and contents as a label, controls are
at least 44px, focus is always visible, and the layout works from 320px up.
Both colour schemes are supported, and `prefers-reduced-motion` is honoured.

## Tests

33 unit tests over the parts worth pinning down: the engine's tactics and time
budgets, the fast evaluation agreeing with the reference one across random
games, the move parser (including the cases where it must refuse to guess),
board geometry, and the legality of every stored opening line.

```bash
npm test
```
