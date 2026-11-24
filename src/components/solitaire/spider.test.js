import { describe, expect, it } from 'vitest';
import {
  RUN_BONUS, START_SCORE, availableMoves, bestMoveFor, canMove, canPickUp, deal, dealRow, dealsLeft,
  isValidState, makeRng, moveCards, newDeck, runStart, undoTo,
} from './spider.js';

const up = (suit, rank, copy = 0) => ({ id: `${suit}${rank}-${copy}`, suit, rank, faceUp: true });
const down = (suit, rank, copy = 0) => ({ ...up(suit, rank, copy), faceUp: false });

/** A state with the given columns (padded to ten) and nothing else. */
function table(columns, extra = {}) {
  const cols = columns.slice();
  while (cols.length < 10) cols.push([up('c', 13, 90 + cols.length)]);
  return { seed: 1, suits: 4, columns: cols, stock: [], completed: [], score: 500, moves: 0, won: false, ...extra };
}

describe('newDeck', () => {
  it('should build 104 cards for every difficulty', () => {
    for (const suits of [1, 2, 4]) {
      const deck = newDeck(suits);
      expect(deck).toHaveLength(104);
      expect(new Set(deck.map((c) => c.id)).size).toBe(104);
      expect(new Set(deck.map((c) => c.suit)).size).toBe(suits);
    }
  });
});

describe('deal', () => {
  it('should lay out 54 cards in ten columns with the last of each face up', () => {
    const game = deal({ suits: 2, seed: 42 });
    expect(game.columns.map((c) => c.length)).toEqual([6, 6, 6, 6, 5, 5, 5, 5, 5, 5]);
    game.columns.forEach((col) => {
      expect(col.at(-1).faceUp).toBe(true);
      expect(col.slice(0, -1).every((c) => !c.faceUp)).toBe(true);
    });
    expect(game.stock).toHaveLength(50);
    expect(dealsLeft(game)).toBe(5);
    expect(game.score).toBe(START_SCORE);
    expect(isValidState(game)).toBe(true);
  });

  it('should replay the same deal from the same seed', () => {
    expect(deal({ suits: 4, seed: 7 })).toEqual(deal({ suits: 4, seed: 7 }));
    expect(deal({ suits: 4, seed: 7 })).not.toEqual(deal({ suits: 4, seed: 8 }));
  });

  it('should fall back to one suit for an unknown difficulty', () => {
    expect(deal({ suits: 3, seed: 1 }).suits).toBe(1);
  });
});

describe('makeRng', () => {
  it('should return numbers in [0, 1)', () => {
    const rng = makeRng(123);
    for (let i = 0; i < 100; i += 1) {
      const n = rng();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});

describe('runStart and canPickUp', () => {
  it('should only lift a face-up run of one suit', () => {
    const col = [down('s', 9), up('h', 8), up('s', 7), up('s', 6), up('s', 5)];
    expect(runStart(col)).toBe(2);
    const state = table([col]);
    expect(canPickUp(state, 0, 2)).toBe(true);
    expect(canPickUp(state, 0, 4)).toBe(true);
    expect(canPickUp(state, 0, 1)).toBe(false);
    expect(canPickUp(state, 0, 0)).toBe(false);
  });

  it('should handle an empty column', () => {
    expect(runStart([])).toBe(0);
    expect(canPickUp(table([[]]), 0, 0)).toBe(false);
  });
});

describe('moveCards', () => {
  it('should build down on any suit, cost a point and turn over the card left behind', () => {
    const state = table([[down('d', 2), up('h', 5)], [up('s', 6)]]);
    const next = moveCards(state, { col: 0, index: 1 }, 1);
    expect(next.columns[1].map((c) => c.id)).toEqual(['s6-0', 'h5-0']);
    expect(next.columns[0]).toEqual([up('d', 2)]);
    expect(next.score).toBe(499);
    expect(next.moves).toBe(1);
    expect(state.columns[0]).toHaveLength(2); // the original is untouched
  });

  it('should refuse a card that is not one lower', () => {
    const state = table([[up('h', 4)], [up('s', 6)]]);
    expect(canMove(state, { col: 0, index: 0 }, 1)).toBe(false);
    expect(moveCards(state, { col: 0, index: 0 }, 1)).toBeNull();
  });

  it('should let any card or run into an empty column', () => {
    const state = table([[up('h', 9), up('h', 8)], []]);
    const next = moveCards(state, { col: 0, index: 0 }, 1);
    expect(next.columns[1]).toHaveLength(2);
    expect(next.columns[0]).toHaveLength(0);
  });

  it('should refuse to move a mixed-suit stack together', () => {
    const state = table([[up('h', 8), up('s', 7)], [up('c', 9)]]);
    expect(moveCards(state, { col: 0, index: 0 }, 1)).toBeNull();
  });

  it('should clear a finished King-to-Ace run, score 100 and flip the card beneath', () => {
    const run = [];
    for (let r = 13; r >= 2; r -= 1) run.push(up('s', r));
    const state = table([[down('h', 3), ...run], [up('s', 1)]]);
    const next = moveCards(state, { col: 1, index: 0 }, 0);
    expect(next.completed).toEqual([{ suit: 's', id: 's13-0' }]);
    expect(next.columns[0]).toEqual([up('h', 3)]);
    expect(next.score).toBe(500 - 1 + RUN_BONUS);
  });

  it('should win once the eighth run is finished', () => {
    const run = [];
    for (let r = 13; r >= 2; r -= 1) run.push(up('s', r));
    const completed = Array.from({ length: 7 }, (_, i) => ({ suit: 's', id: `s13-${i + 1}` }));
    const columns = [run, [up('s', 1)], [], [], [], [], [], [], [], []];
    const state = { ...table([]), columns, completed };
    const next = moveCards(state, { col: 1, index: 0 }, 0);
    expect(next.won).toBe(true);
    expect(moveCards(next, { col: 0, index: 0 }, 1)).toBeNull();
  });
});

describe('dealRow', () => {
  it('should put a face-up card on every column', () => {
    const game = deal({ suits: 1, seed: 3 });
    const next = dealRow(game);
    expect(next.stock).toHaveLength(40);
    next.columns.forEach((col, i) => {
      expect(col).toHaveLength(game.columns[i].length + 1);
      expect(col.at(-1).faceUp).toBe(true);
    });
    expect(next.score).toBe(499);
    expect(next.moves).toBe(1);
  });

  it('should refuse to deal while a column is empty or the stock is out', () => {
    const game = deal({ suits: 1, seed: 3 });
    const gap = { ...game, columns: game.columns.map((c, i) => (i === 4 ? [] : c)) };
    expect(dealRow(gap)).toBeNull();
    expect(dealRow({ ...game, stock: [] })).toBeNull();
  });
});

describe('undoTo', () => {
  it('should restore the earlier position but count the undo as a move', () => {
    const game = deal({ suits: 1, seed: 3 });
    const after = dealRow(game);
    const undone = undoTo(after, game);
    expect(undone.columns).toEqual(game.columns);
    expect(undone.moves).toBe(2);
    expect(undone.score).toBe(499);
  });
});

describe('bestMoveFor', () => {
  it('should prefer the same suit, then any suit, then an empty column', () => {
    const state = table([[down('d', 1), up('s', 5)], [up('h', 6)], [up('s', 6)], []]);
    expect(bestMoveFor(state, { col: 0, index: 1 })).toBe(2);
    const noSameSuit = table([[down('d', 1), up('s', 5)], [up('h', 6)], []]);
    expect(bestMoveFor(noSameSuit, { col: 0, index: 1 })).toBe(1);
    const onlyEmpty = table([[down('d', 1), up('s', 5)], []]);
    expect(bestMoveFor(onlyEmpty, { col: 0, index: 1 })).toBe(1);
  });

  it('should not move a whole column into an empty one', () => {
    const state = table([[up('s', 5)], []]);
    expect(bestMoveFor(state, { col: 0, index: 0 })).toBeNull();
  });

  it('should return null for a card that cannot be picked up', () => {
    const state = table([[up('h', 8), up('s', 7)], [up('c', 9)]]);
    expect(bestMoveFor(state, { col: 0, index: 0 })).toBeNull();
  });
});

describe('availableMoves', () => {
  it('should list same-suit builds before other moves', () => {
    const state = table([[down('d', 1), up('s', 5)], [up('h', 6)], [up('s', 6)]]);
    const moves = availableMoves(state);
    expect(moves[0]).toMatchObject({ from: { col: 0, index: 1 }, to: 2, rank: 0 });
    expect(moves.some((m) => m.to === 1)).toBe(true);
  });

  it('should skip moving a card off the same suit onto an equal spot', () => {
    const state = table([[up('s', 5), up('s', 4)], [up('s', 5, 1)]]);
    expect(availableMoves(state).some((m) => m.from.col === 0 && m.from.index === 1)).toBe(false);
  });
});

describe('isValidState', () => {
  it('should reject junk and accept a fresh deal', () => {
    expect(isValidState(null)).toBe(false);
    expect(isValidState({ columns: [] })).toBe(false);
    expect(isValidState(deal({ seed: 5 }))).toBe(true);
    const broken = deal({ seed: 5 });
    broken.stock.pop();
    expect(isValidState(broken)).toBe(false);
  });
});
