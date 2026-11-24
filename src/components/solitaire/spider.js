/*
 * Spider solitaire rules and scoring, as pure functions over a plain game state. Every move
 * returns a new state, or null when it isn't legal, so the component keeps an undo stack of
 * snapshots and the rules are tested without rendering anything.
 *
 * Two decks, ten columns (54 cards dealt, the last card of each face up) and a 50-card stock dealt
 * a row of ten at a time. Build down regardless of suit, but only a run of one suit moves as a
 * unit; a full King-to-Ace run of one suit leaves the table. Clear all eight runs to win.
 *
 * Scoring follows the classic desktop game: start at 500, lose a point per move (dealing and
 * undoing count), gain 100 for each completed run.
 */

export const RANK_LABELS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUIT_NAMES = { c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' };
const RANK_NAMES = ['', 'Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'];

export const COLUMNS = 10;
export const START_SCORE = 500;
export const RUN_BONUS = 100;
export const DIFFICULTIES = {
  1: { suits: ['s'], label: 'Easy: One suit' },
  2: { suits: ['s', 'h'], label: 'Medium: Two suits' },
  4: { suits: ['s', 'h', 'c', 'd'], label: 'Difficult: Four suits' },
};

export const isRed = (card) => card.suit === 'd' || card.suit === 'h';
export const cardName = (card) => `${RANK_NAMES[card.rank]} of ${SUIT_NAMES[card.suit]}`;

/** Small seeded PRNG (mulberry32) so a deal can be replayed (Restart This Game, tests). */
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 104 cards: two decks' worth, spread over 1, 2 or 4 suits. */
export function newDeck(suitCount = 1) {
  const suits = (DIFFICULTIES[suitCount] || DIFFICULTIES[1]).suits;
  const copies = 8 / suits.length;
  const deck = [];
  suits.forEach((suit) => {
    for (let copy = 0; copy < copies; copy += 1) {
      for (let rank = 1; rank <= 13; rank += 1) {
        deck.push({ id: `${suit}${rank}-${copy}`, suit, rank, faceUp: false });
      }
    }
  });
  return deck;
}

export function shuffle(cards, rng = Math.random) {
  const out = cards.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function deal({ suits = 1, seed = Math.floor(Math.random() * 2 ** 31) } = {}) {
  const suitCount = DIFFICULTIES[suits] ? suits : 1;
  const deck = shuffle(newDeck(suitCount), makeRng(seed));
  const columns = Array.from({ length: COLUMNS }, () => []);
  // 54 cards: six in the first four columns, five in the rest.
  for (let i = 0; i < 54; i += 1) columns[i % COLUMNS].push(deck[i]);
  columns.forEach((col) => {
    col[col.length - 1] = { ...col[col.length - 1], faceUp: true };
  });
  return {
    seed,
    suits: suitCount,
    columns,
    stock: deck.slice(54),
    completed: [],
    score: START_SCORE,
    moves: 0,
    won: false,
  };
}

const top = (pile) => pile[pile.length - 1];

function clone(state) {
  return {
    ...state,
    columns: state.columns.map((c) => c.slice()),
    stock: state.stock.slice(),
    completed: state.completed.slice(),
  };
}

/** Index where the movable run at the end of a column starts (one suit, descending, face up). */
export function runStart(column) {
  if (!column.length || !top(column).faceUp) return column.length;
  let i = column.length - 1;
  while (i > 0) {
    const above = column[i - 1];
    const card = column[i];
    if (!above.faceUp || above.suit !== card.suit || above.rank !== card.rank + 1) break;
    i -= 1;
  }
  return i;
}

/** True when the cards from `index` to the end of the column can be picked up together. */
export function canPickUp(state, col, index) {
  const column = state.columns[col];
  return !!column && index >= 0 && index < column.length && index >= runStart(column);
}

export function canDrop(state, card, toCol) {
  const target = state.columns[toCol];
  if (!target) return false;
  const t = top(target);
  return !t || t.rank === card.rank + 1;
}

export function canMove(state, from, toCol) {
  if (from.col === toCol || !canPickUp(state, from.col, from.index)) return false;
  return canDrop(state, state.columns[from.col][from.index], toCol);
}

function flipTop(column) {
  const t = top(column);
  if (t && !t.faceUp) column[column.length - 1] = { ...t, faceUp: true };
}

/** Lift a finished King-to-Ace run of one suit off the end of a column, if there is one. */
function collectRun(state, col) {
  const column = state.columns[col];
  if (column.length < 13) return;
  const start = column.length - 13;
  const run = column.slice(start);
  const suit = run[0].suit;
  const complete = run.every((c, i) => c.faceUp && c.suit === suit && c.rank === 13 - i);
  if (!complete) return;
  column.splice(start);
  state.completed.push({ suit, id: run[0].id });
  state.score += RUN_BONUS;
  flipTop(column);
}

function finish(state) {
  if (state.completed.length === 8) state.won = true;
  return state;
}

export function moveCards(state, from, toCol) {
  if (state.won || !canMove(state, from, toCol)) return null;
  const next = clone(state);
  const run = next.columns[from.col].splice(from.index);
  next.columns[toCol].push(...run);
  flipTop(next.columns[from.col]);
  next.moves += 1;
  next.score -= 1;
  collectRun(next, toCol);
  return finish(next);
}

export const hasEmptyColumn = (state) => state.columns.some((c) => c.length === 0);
export const dealsLeft = (state) => Math.floor(state.stock.length / COLUMNS);

/** Deal a row of ten from the stock. Not allowed while any column is empty. */
export function dealRow(state) {
  if (state.won || state.stock.length < COLUMNS || hasEmptyColumn(state)) return null;
  const next = clone(state);
  for (let col = 0; col < COLUMNS; col += 1) {
    next.columns[col].push({ ...next.stock.pop(), faceUp: true });
  }
  next.moves += 1;
  next.score -= 1;
  for (let col = 0; col < COLUMNS; col += 1) collectRun(next, col);
  return finish(next);
}

/** Undo puts `previous` back, but the undo itself still counts as a move. */
export function undoTo(current, previous) {
  return { ...previous, moves: current.moves + 1, score: previous.score - 1 };
}

/**
 * Every useful move, best first: building on the same suit, then on any suit, then into an empty
 * column. Moves that just shuffle a run between equal spots are left out.
 */
export function availableMoves(state) {
  const moves = [];
  state.columns.forEach((column, col) => {
    const start = runStart(column);
    for (let index = start; index < column.length; index += 1) {
      const card = column[index];
      const revealsOrEmpties = index === 0 || !column[index - 1].faceUp;
      // Splitting a run off a card it already sits on in-suit gains nothing.
      const sitsInSuit = index > 0 && column[index - 1].faceUp
        && column[index - 1].suit === card.suit && column[index - 1].rank === card.rank + 1;
      if (sitsInSuit) continue;
      state.columns.forEach((target, toCol) => {
        if (toCol === col || !canMove(state, { col, index }, toCol)) return;
        const t = top(target);
        let rank;
        if (!t) {
          if (index === 0) return; // whole column into an empty one
          rank = 3;
        } else if (t.suit === card.suit) {
          rank = 0;
        } else {
          // Moving onto another suit only helps when it uncovers something.
          if (!revealsOrEmpties && column[index - 1].rank === card.rank + 1) return;
          rank = 1;
        }
        moves.push({ from: { col, index }, to: toCol, rank, size: column.length - index });
      });
    }
  });
  moves.sort((a, b) => a.rank - b.rank || b.size - a.size);
  return moves;
}

/**
 * Where a tap on a card should send its run: onto the same suit, then any suit, then an empty
 * column (unless the run is already the whole column).
 */
export function bestMoveFor(state, from) {
  if (!canPickUp(state, from.col, from.index)) return null;
  const card = state.columns[from.col][from.index];
  let anySuit = null;
  let empty = null;
  for (let step = 1; step < COLUMNS; step += 1) {
    const toCol = (from.col + step) % COLUMNS;
    if (!canMove(state, from, toCol)) continue;
    const t = top(state.columns[toCol]);
    if (!t) {
      if (empty === null && from.index > 0) empty = toCol;
    } else if (t.suit === card.suit) {
      return toCol;
    } else if (anySuit === null) {
      anySuit = toCol;
    }
  }
  return anySuit ?? empty;
}

/** A light sanity check for a state restored from storage. */
export function isValidState(state) {
  if (!state || typeof state !== 'object') return false;
  const { columns, stock, completed } = state;
  if (!Array.isArray(columns) || columns.length !== COLUMNS) return false;
  if (!Array.isArray(stock) || !Array.isArray(completed)) return false;
  const all = [...stock, ...columns.flat()];
  if (all.length + completed.length * 13 !== 104) return false;
  return new Set(all.map((c) => c?.id)).size === all.length;
}
