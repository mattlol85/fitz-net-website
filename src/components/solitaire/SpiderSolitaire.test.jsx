import React from 'react';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SpiderSolitaire, { computeLayout } from './SpiderSolitaire.jsx';
import { deal } from './spider.js';

// jsdom has no PointerEvent, so fireEvent.pointerDown would drop pointerType and pointerId.
if (typeof window.PointerEvent === 'undefined') {
  window.PointerEvent = class PointerEvent extends MouseEvent {
    constructor(type, init = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? '';
    }
  };
}

const GAME_KEY = 'lori-spider:game';
const up = (suit, rank, copy = 0) => ({ id: `${suit}${rank}-${copy}`, suit, rank, faceUp: true });
const down = (suit, rank, copy = 0) => ({ ...up(suit, rank, copy), faceUp: false });

function saveGame(game) {
  localStorage.setItem(GAME_KEY, JSON.stringify(game));
}

function savedGame() {
  return JSON.parse(localStorage.getItem(GAME_KEY));
}

/**
 * A valid 104-card position: the given columns (padded to ten with empty ones) and stock, a few face-down clubs added to the
 * stock to round the count up to whole runs, and the rest of the cards as finished runs.
 */
function position(given, { stock = [] } = {}) {
  const columns = [...given, ...Array.from({ length: 10 - given.length }, () => [])];
  const loose = columns.flat().length + stock.length;
  const filler = Array.from({ length: (13 - (loose % 13)) % 13 }, (_, i) => down('c', 1, 50 + i));
  const fullStock = [...filler, ...stock];
  const runs = Array.from({ length: (104 - loose - filler.length) / 13 }, (_, i) => ({ suit: 's', id: `s13-x${i}` }));
  return { seed: 9, suits: 1, columns, stock: fullStock, completed: runs, score: 500, moves: 0, won: false };
}

function tap(el, pointerType = 'touch') {
  fireEvent.pointerDown(el, { pointerId: 1, pointerType, button: 0, clientX: 5, clientY: 5 });
  fireEvent.pointerUp(el, { pointerId: 1, pointerType, button: 0, clientX: 5, clientY: 5 });
}

function renderGame() {
  return render(
    <MemoryRouter>
      <SpiderSolitaire />
    </MemoryRouter>,
  );
}

const card = (id) => document.querySelector(`[data-card="${id}"]`);

describe('SpiderSolitaire', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('should deal ten columns, the stock and a score box for a new game', () => {
    renderGame();
    expect(document.querySelectorAll('[data-pile="column"]')).toHaveLength(54);
    expect(document.querySelectorAll('[data-pile="stock"]')).toHaveLength(5);
    expect(screen.getByText('Score: 500')).toBeInTheDocument();
    expect(screen.getByText('Moves: 0')).toBeInTheDocument();
    expect(savedGame().columns).toHaveLength(10);
  });

  it('should deal a new row when the stock is tapped', () => {
    renderGame();
    tap(screen.getByAltText('Deal a new row (5 left)'));
    expect(document.querySelectorAll('[data-pile="column"]')).toHaveLength(64);
    expect(screen.getByText('Score: 499')).toBeInTheDocument();
    expect(screen.getByText('Moves: 1')).toBeInTheDocument();
  });

  it('should refuse to deal while a column is empty', () => {
    const stock = Array.from({ length: 10 }, (_, i) => down('s', 8, i));
    saveGame(position([[up('s', 5)], [], [up('s', 9)]], { stock }));
    const before = savedGame().stock.length;
    renderGame();
    tap(screen.getByAltText('Deal a new row (1 left)'));
    expect(screen.getByRole('dialog', { name: 'Spider Solitaire' })).toHaveTextContent('while any column is empty');
    expect(savedGame().stock).toHaveLength(before);
  });

  it('should move a tapped card onto the best column on a touch screen', () => {
    saveGame(position([[down('s', 2), up('s', 5)], [up('s', 6)]]));
    renderGame();
    tap(card('s5-0'));
    const game = savedGame();
    expect(game.columns[1].map((c) => c.id)).toEqual(['s6-0', 's5-0']);
    expect(game.columns[0][0].faceUp).toBe(true);
    expect(screen.getByText('Moves: 1')).toBeInTheDocument();
  });

  it('should leave a mouse single click alone and move on a double-click', () => {
    saveGame(position([[down('s', 2), up('s', 5)], [up('s', 6)]]));
    renderGame();
    tap(card('s5-0'), 'mouse');
    expect(savedGame().moves).toBe(0);
    tap(card('s5-0'), 'mouse');
    expect(savedGame().moves).toBe(1);
  });

  it('should undo a move from the Game menu', () => {
    saveGame(position([[down('s', 2), up('s', 5)], [up('s', 6)]]));
    renderGame();
    tap(card('s5-0'));
    fireEvent.click(screen.getByRole('button', { name: 'Game' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Undo/ }));
    const game = savedGame();
    expect(game.columns[0].map((c) => c.id)).toEqual(['s2-0', 's5-0']);
    expect(game.moves).toBe(2);
    expect(screen.getByText('Score: 499')).toBeInTheDocument();
  });

  it('should point out an available move', () => {
    saveGame(position([[down('s', 2), up('s', 5)], [up('s', 6)]]));
    renderGame();
    fireEvent.click(screen.getByRole('button', { name: 'Game' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Show An Available Move/ }));
    expect(card('s5-0')).toHaveClass('is-hint');
  });

  it('should start a game at the chosen difficulty', () => {
    renderGame();
    fireEvent.click(screen.getByRole('button', { name: 'Game' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Difficulty…' }));
    const dialog = screen.getByRole('dialog', { name: 'Difficulty' });
    fireEvent.click(within(dialog).getByLabelText('Difficult: Four suits'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }));
    expect(savedGame().suits).toBe(4);
    expect(JSON.parse(localStorage.getItem('lori-spider:settings')).suits).toBe(4);
  });

  it('should congratulate the player after the last run is finished', () => {
    // Reduced motion skips the fireworks and goes straight to the dialog.
    const original = window.matchMedia;
    window.matchMedia = vi.fn(() => ({ matches: true }));
    onTestFinished(() => {
      window.matchMedia = original;
    });
    const run = [];
    for (let r = 13; r >= 2; r -= 1) run.push(up('s', r));
    saveGame(position([run, [up('s', 1)], [], [], [], [], [], [], [], []]));
    renderGame();
    act(() => tap(card('s1-0')));
    expect(screen.getByText('Congratulations, you won! 🎉')).toBeInTheDocument();
    const stats = JSON.parse(localStorage.getItem('lori-spider:stats'));
    expect(stats[1]).toMatchObject({ played: 1, won: 1, best: 599 });
  });

  it('should resume a saved game', () => {
    const game = deal({ suits: 2, seed: 77 });
    saveGame({ ...game, moves: 12, score: 488 });
    renderGame();
    expect(screen.getByText('Score: 488')).toBeInTheDocument();
    expect(screen.getByText('Moves: 12')).toBeInTheDocument();
  });
});

describe('computeLayout', () => {
  it('should fit ten columns across a phone and switch to compact cards', () => {
    const layout = computeLayout(375, 600, deal({ seed: 1 }));
    expect(layout.colX(9) + layout.cardW).toBeLessThanOrEqual(375);
    expect(layout.compact).toBe(true);
  });

  it('should use full-size classic cards on a desktop', () => {
    const layout = computeLayout(1000, 640, deal({ seed: 1 }));
    expect(layout.compact).toBe(false);
    expect(layout.cardW).toBeGreaterThanOrEqual(80);
  });
});
