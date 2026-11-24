import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  COLUMNS, DIFFICULTIES, availableMoves, bestMoveFor, canMove, canPickUp, cardName, deal, dealRow,
  dealsLeft, hasEmptyColumn, isValidState, moveCards, runStart, undoTo,
} from './spider.js';
import { CARD_BACKS, cardBackUrl, cardFaceUrl } from './cardArt.js';
import { runFireworks } from './fireworks.js';
import '../../css/solitaire/Solitaire.css';

/*
 * Lori-Net Spider Solitaire, in the style of the classic desktop game: green felt, ten columns,
 * the stock in the bottom-right corner dealing a row at a time, finished runs stacking up in the
 * bottom-left, a score box between them, a Game and Help menu, and fireworks when you win.
 *
 * Mouse: drag runs; double-click one to send it to its best spot. Touch: drag, or tap a card to
 * move it and everything below it to the best spot.
 */

const SETTINGS_KEY = 'lori-spider:settings';
const GAME_KEY = 'lori-spider:game';
const STATS_KEY = 'lori-spider:stats';
const DEFAULT_SETTINGS = { suits: 1, back: 'lori' };
const HISTORY_LIMIT = 500;
const DRAG_THRESHOLD = 5;
const DOUBLE_CLICK_MS = 400;
const HINT_MS = 1100;
const FALLBACK_SIZE = { w: 760, h: 560 };

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or full storage: the game still works, it just won't resume.
  }
}

function loadSettings() {
  const settings = { ...DEFAULT_SETTINGS, ...(readJson(SETTINGS_KEY) || {}) };
  if (!DIFFICULTIES[settings.suits]) settings.suits = 1;
  return settings;
}

function loadGame() {
  const saved = readJson(GAME_KEY);
  return isValidState(saved) && !saved.won ? saved : null;
}

const emptyStats = () => Object.fromEntries(
  Object.keys(DIFFICULTIES).map((k) => [k, { played: 0, won: 0, best: null }]),
);

function loadStats() {
  const saved = readJson(STATS_KEY) || {};
  const stats = emptyStats();
  Object.keys(stats).forEach((k) => {
    stats[k] = { ...stats[k], ...(saved[k] || {}) };
  });
  return stats;
}

const prefersReducedMotion = () => typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Card size, fan offsets and pile positions for a felt of `w` x `h` CSS px. */
export function computeLayout(w, h, game) {
  const gap = Math.max(3, Math.min(12, Math.round(w * 0.009)));
  let cardW = Math.floor((w - 2 * gap - (COLUMNS - 1) * gap) / COLUMNS);
  cardW = Math.min(cardW, 96, Math.floor(h * 0.2 * (71 / 96)));
  cardW = Math.max(cardW, 26);
  const cardH = Math.round((cardW * 96) / 71);
  const compact = cardW < 58;
  const totalW = COLUMNS * cardW + (COLUMNS - 1) * gap;
  const left = Math.max(gap, Math.floor((w - totalW) / 2));
  const colX = (i) => left + i * (cardW + gap);
  const topY = gap;
  const downOff = Math.round(cardH * (compact ? 0.12 : 0.09));
  const upMax = Math.round(cardH * (compact ? 0.34 : 0.24));
  const upMin = Math.round(cardH * (compact ? 0.28 : 0.13));
  // Room for the columns once the bottom row (stock, finished runs, score) is set aside.
  const avail = h - topY - (cardH + 2 * gap) - cardH;

  let maxBottom = topY + cardH;
  const columns = game.columns.map((col) => {
    const down = col.filter((c) => !c.faceUp).length;
    const up = col.length - down;
    let upOff = upMax;
    if (up > 1) {
      upOff = Math.max(upMin, Math.min(upMax, Math.floor((avail - down * downOff) / (up - 1))));
    }
    const ys = [];
    let y = topY;
    col.forEach((card) => {
      ys.push(y);
      y += card.faceUp ? upOff : downOff;
    });
    const bottom = (ys[ys.length - 1] ?? topY) + cardH;
    maxBottom = Math.max(maxBottom, bottom);
    return { ys, bottom };
  });

  const bottomY = Math.max(h - gap - cardH, maxBottom + 2 * gap);
  return {
    gap,
    cardW,
    cardH,
    compact,
    colX,
    topY,
    columns,
    bottomY,
    contentH: bottomY + cardH + gap,
    doneFan: Math.round(cardW * 0.3),
    stockFan: Math.round(cardW * 0.22),
    left,
    totalW,
  };
}

function useElementSize(ref) {
  const [size, setSize] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    };
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function Menu({ id, label, open, onOpen, onHover, items }) {
  return (
    <div className="sol-menu">
      <button
        type="button"
        className={`sol-menu__title${open ? ' is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => onOpen(open ? null : id)}
        onMouseEnter={() => onHover(id)}
      >
        {label}
      </button>
      {open && (
        <ul className="sol-menu__list" role="menu" aria-label={label}>
          {items.map((item, i) => (item === '-' ? (
            <li key={`sep-${i}`} className="sol-menu__sep" role="separator" />
          ) : (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                className="sol-menu__item"
                disabled={item.disabled}
                onClick={() => {
                  onOpen(null);
                  item.onSelect();
                }}
              >
                <span>{item.label}</span>
                {item.shortcut && <span className="sol-menu__shortcut">{item.shortcut}</span>}
              </button>
            </li>
          )))}
        </ul>
      )}
    </div>
  );
}

function Dialog({ title, onClose, children, actions, className = '' }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sol-dialog-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`sol-dialog ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sol-dialog__titlebar">
          <span>{title}</span>
          <button type="button" className="sol-dialog__close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="sol-dialog__body">{children}</div>
        {actions && <div className="sol-dialog__actions">{actions}</div>}
      </div>
    </div>
  );
}

function OkCancel({ onOk, onCancel, ok = 'OK', cancel = 'Cancel' }) {
  return (
    <>
      <button type="button" className="sol-btn sol-btn--primary" onClick={onOk}>{ok}</button>
      {onCancel && <button type="button" className="sol-btn" onClick={onCancel}>{cancel}</button>}
    </>
  );
}

function DifficultyDialog({ current, onSave, onClose }) {
  const [choice, setChoice] = useState(current);
  return (
    <Dialog title="Difficulty" onClose={onClose} actions={<OkCancel onOk={() => onSave(choice)} onCancel={onClose} />}>
      <p className="sol-about">Choose a difficulty. A new game will start.</p>
      <fieldset className="sol-group">
        <legend>Difficulty</legend>
        {Object.entries(DIFFICULTIES).map(([suits, { label }]) => (
          <label key={suits}>
            <input
              type="radio"
              name="difficulty"
              checked={choice === Number(suits)}
              onChange={() => setChoice(Number(suits))}
            />
            {' '}{label}
          </label>
        ))}
      </fieldset>
    </Dialog>
  );
}

function DeckDialog({ current, onSave, onClose }) {
  const [choice, setChoice] = useState(current);
  return (
    <Dialog title="Select Card Back" onClose={onClose} actions={<OkCancel onOk={() => onSave(choice)} onCancel={onClose} />}>
      <div className="sol-backs" role="radiogroup" aria-label="Card backs">
        {CARD_BACKS.map((back) => (
          <button
            key={back.id}
            type="button"
            role="radio"
            aria-checked={choice === back.id}
            aria-label={back.label}
            title={back.label}
            className={`sol-backs__item${choice === back.id ? ' is-selected' : ''}`}
            onClick={() => setChoice(back.id)}
            onDoubleClick={() => onSave(back.id)}
          >
            <img src={cardBackUrl(back.id)} alt="" draggable={false} />
          </button>
        ))}
      </div>
    </Dialog>
  );
}

function StatsDialog({ stats, onReset, onClose }) {
  return (
    <Dialog title="Statistics" onClose={onClose} actions={<OkCancel onOk={onClose} onCancel={onReset} cancel="Reset" />}>
      <table className="sol-help__table sol-stats">
        <thead>
          <tr><th>Level</th><th>Played</th><th>Won</th><th>Win %</th><th>Best</th></tr>
        </thead>
        <tbody>
          {Object.entries(DIFFICULTIES).map(([suits, { label }]) => {
            const s = stats[suits];
            const pct = s.played ? Math.round((s.won / s.played) * 100) : 0;
            return (
              <tr key={suits}>
                <td>{label.split(':')[0]}</td>
                <td>{s.played}</td>
                <td>{s.won}</td>
                <td>{pct}%</td>
                <td>{s.best ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Dialog>
  );
}

function HelpDialog({ onClose }) {
  return (
    <Dialog title="How to play Spider Solitaire" onClose={onClose} className="sol-dialog--wide" actions={<OkCancel onOk={onClose} />}>
      <div className="sol-help">
        <p>
          Clear the table by building eight runs from King down to Ace in a single suit. A finished
          run leaves the table on its own.
        </p>
        <ul>
          <li>Put any card on a card one higher, whatever its suit: a 6 goes on any 7.</li>
          <li>Several cards move together only when they&rsquo;re a run of one suit (♠ 9-8-7).</li>
          <li>Any card or run can go into an empty column.</li>
          <li>Click the stock in the bottom-right corner to deal a card onto every column. You can&rsquo;t deal while a column is empty.</li>
          <li>Stuck? <strong>Game › Show An Available Move</strong> (or M) points one out.</li>
          <li>On a phone, drag cards or just tap one to move it (and the cards below it) to the best spot.</li>
        </ul>
        <h3>Scoring</h3>
        <table className="sol-help__table">
          <tbody>
            <tr><td>Starting score</td><td>500</td></tr>
            <tr><td>Each move, deal or undo</td><td>−1</td></tr>
            <tr><td>Each finished King-to-Ace run</td><td>+100</td></tr>
          </tbody>
        </table>
        <p>
          <strong>Easy</strong> uses only spades, <strong>Medium</strong> spades and hearts,
          <strong> Difficult</strong> all four suits.
        </p>
      </div>
    </Dialog>
  );
}

const QUICK_ICONS = {
  undo: <path d="M8 4 3 9l5 5M3.5 9H12a5 5 0 0 1 0 10h-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  hint: (
    <>
      <path d="M10 2.5a5.5 5.5 0 0 0-3.2 10c.6.5.9 1.1.9 1.8v.7h4.6v-.7c0-.7.3-1.3.9-1.8A5.5 5.5 0 0 0 10 2.5z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 17.5h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </>
  ),
  newGame: (
    <>
      <rect x="2.5" y="4.5" width="9" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <rect x="8.5" y="2.5" width="9" height="12" rx="1.5" fill="currentColor" opacity=".35" stroke="currentColor" strokeWidth="1.7" />
    </>
  ),
};

function SpiderSolitaire() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(loadSettings);
  const [stats, setStats] = useState(loadStats);
  const [play, setPlay] = useState(() => ({ game: loadGame() || deal({ suits: loadSettings().suits }), history: [] }));
  const [drag, setDrag] = useState(null);
  const [menu, setMenu] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [celebrating, setCelebrating] = useState(false);
  const [hint, setHint] = useState(null);
  const [shake, setShake] = useState(null);
  const { game, history } = play;

  const feltRef = useRef(null);
  const tableRef = useRef(null);
  const canvasRef = useRef(null);
  const pressRef = useRef(null);
  const lastClickRef = useRef(null);
  const hintIndexRef = useRef(0);
  const stopFireworksRef = useRef(null);
  const countedRef = useRef(null);

  const measured = useElementSize(feltRef);
  const size = measured && measured.w > 0 && measured.h > 0 ? measured : FALLBACK_SIZE;
  const layout = useMemo(() => computeLayout(size.w, size.h, game), [size.w, size.h, game]);
  const variant = layout.compact ? 'compact' : 'classic';

  // ----- state changes --------------------------------------------------------------------------

  const apply = useCallback((fn) => {
    setPlay((p) => {
      if (p.game.won) return p;
      const next = fn(p.game);
      if (!next || next === p.game) return p;
      return { game: next, history: [...p.history.slice(-HISTORY_LIMIT + 1), p.game] };
    });
    setHint(null);
  }, []);

  const undo = useCallback(() => {
    setPlay((p) => {
      if (!p.history.length || p.game.won) return p;
      return { game: undoTo(p.game, p.history[p.history.length - 1]), history: p.history.slice(0, -1) };
    });
    setHint(null);
  }, []);

  const startGame = useCallback((next) => {
    stopFireworksRef.current?.();
    setCelebrating(false);
    setDrag(null);
    setDialog(null);
    setHint(null);
    setPlay({ game: next, history: [] });
  }, []);

  const newGame = useCallback((suits = settings.suits) => startGame(deal({ suits })), [settings.suits, startGame]);
  const restartGame = useCallback(
    () => startGame(deal({ suits: game.suits, seed: game.seed })),
    [game.suits, game.seed, startGame],
  );

  const tryDeal = useCallback(() => {
    if (game.won || !game.stock.length) return;
    if (hasEmptyColumn(game)) {
      setDialog('no-deal');
      return;
    }
    apply(dealRow);
  }, [game, apply]);

  const showHint = useCallback(() => {
    if (game.won) return;
    const moves = availableMoves(game);
    if (!moves.length) {
      setDialog(game.stock.length ? 'no-moves-deal' : 'no-moves');
      return;
    }
    setHint(moves[hintIndexRef.current % moves.length]);
    hintIndexRef.current += 1;
  }, [game]);

  useEffect(() => {
    if (!hint) return undefined;
    const id = setTimeout(() => setHint(null), HINT_MS);
    return () => clearTimeout(id);
  }, [hint]);

  // A new position starts the hint list again from the best move.
  useEffect(() => {
    hintIndexRef.current = 0;
  }, [game]);

  useEffect(() => writeJson(SETTINGS_KEY, settings), [settings]);
  useEffect(() => writeJson(STATS_KEY, stats), [stats]);
  useEffect(() => writeJson(GAME_KEY, game), [game]);

  // Statistics: a game counts as played from its first move, and as won when the table clears.
  useEffect(() => {
    const key = `${game.seed}:${game.suits}`;
    if (game.moves > 0 && history.length === 1 && countedRef.current !== key) {
      countedRef.current = key;
      setStats((s) => ({ ...s, [game.suits]: { ...s[game.suits], played: s[game.suits].played + 1 } }));
    }
  }, [game.moves, game.seed, game.suits, history.length]);

  useEffect(() => {
    if (!game.won) return;
    setStats((s) => {
      const cur = s[game.suits];
      const best = cur.best === null ? game.score : Math.max(cur.best, game.score);
      return { ...s, [game.suits]: { ...cur, won: cur.won + 1, best } };
    });
    if (prefersReducedMotion()) setDialog('won');
    else setCelebrating(true);
    // Only the switch to won matters; score and suits are read as of that moment.
  }, [game.won]);

  useEffect(() => {
    if (!celebrating || !canvasRef.current) return undefined;
    const stop = runFireworks(canvasRef.current, {
      onDone: () => {
        setCelebrating(false);
        setDialog('won');
      },
    });
    stopFireworksRef.current = stop;
    return () => {
      stop();
      stopFireworksRef.current = null;
    };
  }, [celebrating]);

  const endCelebration = useCallback(() => {
    stopFireworksRef.current?.();
    setCelebrating(false);
    setDialog('won');
  }, []);

  // Keyboard: F2 new game, Ctrl+Z undo, D deal, M hint, F1 help.
  useEffect(() => {
    const onKey = (e) => {
      if (dialog) return;
      if (e.target.closest?.('input, textarea, select')) return;
      const key = e.key.toLowerCase();
      const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
      if (e.key === 'F2') {
        e.preventDefault();
        newGame();
      } else if (e.key === 'F1') {
        e.preventDefault();
        setDialog('help');
      } else if ((e.ctrlKey || e.metaKey) && key === 'z') {
        e.preventDefault();
        undo();
      } else if (plain && key === 'd') {
        tryDeal();
      } else if (plain && key === 'm') {
        showHint();
      } else if (e.key === 'Escape') {
        setMenu(null);
        if (celebrating) endCelebration();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, newGame, undo, tryDeal, showHint, celebrating, endCelebration]);

  // Clicking anywhere outside an open menu closes it.
  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => {
      if (!e.target.closest?.('.sol-menubar')) setMenu(null);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menu]);

  // ----- geometry -------------------------------------------------------------------------------

  const columnRects = useMemo(() => layout.columns.map((col, index) => ({
    col: index,
    x: layout.colX(index),
    y: layout.topY,
    w: layout.cardW,
    h: Math.max(layout.cardH, col.bottom - layout.topY),
  })), [layout]);

  const findDropTarget = useCallback((from, dx, dy, px, py) => {
    const origin = { x: layout.colX(from.col), y: layout.columns[from.col].ys[from.index] };
    const card = { x: origin.x + dx, y: origin.y + dy, w: layout.cardW, h: layout.cardH };
    const legal = columnRects.filter((r) => canMove(game, from, r.col));
    const under = legal.find((r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h);
    if (under) return under.col;
    let best = null;
    let bestArea = 0;
    for (const r of legal) {
      const ix = Math.min(card.x + card.w, r.x + r.w) - Math.max(card.x, r.x);
      const iy = Math.min(card.y + card.h, r.y + r.h) - Math.max(card.y, r.y);
      const area = ix > 0 && iy > 0 ? ix * iy : 0;
      if (area > bestArea) {
        bestArea = area;
        best = r.col;
      }
    }
    return best;
  }, [game, layout, columnRects]);

  // ----- pointer input --------------------------------------------------------------------------

  const sourceFromElement = (el) => {
    const hit = el?.closest?.('[data-pile]');
    if (!hit) return null;
    if (hit.dataset.pile === 'stock') return { type: 'stock' };
    return { type: 'column', col: Number(hit.dataset.col), index: Number(hit.dataset.index) };
  };

  const pointInTable = (e) => {
    const rect = tableRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const nudge = (id) => {
    setShake(id);
    setTimeout(() => setShake((s) => (s === id ? null : s)), 320);
  };

  const moveToBest = (from, cardId) => {
    const to = bestMoveFor(game, from);
    if (to === null) nudge(cardId);
    else apply((g) => moveCards(g, from, to));
  };

  const handleTap = (src, pointerType, cardId) => {
    if (src.type === 'stock') {
      tryDeal();
      return;
    }
    const from = { col: src.col, index: src.index };
    if (pointerType !== 'mouse') {
      moveToBest(from, cardId);
      return;
    }
    const last = lastClickRef.current;
    const now = Date.now();
    if (last && last.col === from.col && last.index === from.index && now - last.at < DOUBLE_CLICK_MS) {
      lastClickRef.current = null;
      moveToBest(from, cardId);
    } else {
      lastClickRef.current = { ...from, at: now };
    }
  };

  const onPointerDown = (e) => {
    if (celebrating) {
      endCelebration();
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (pressRef.current) return;
    const src = sourceFromElement(e.target);
    if (!src) return;
    const movable = src.type === 'column' && canPickUp(game, src.col, src.index);
    pressRef.current = {
      src,
      pointerId: e.pointerId,
      pointerType: e.pointerType || 'mouse',
      x: e.clientX,
      y: e.clientY,
      ids: movable ? game.columns[src.col].slice(src.index).map((c) => c.id) : null,
      cardId: e.target.closest('[data-card]')?.dataset.card,
      dragging: false,
    };
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // Synthetic events in tests have no active pointer to capture.
    }
  };

  const onPointerMove = (e) => {
    const press = pressRef.current;
    if (!press || press.pointerId !== e.pointerId) return;
    const dx = e.clientX - press.x;
    const dy = e.clientY - press.y;
    if (!press.dragging) {
      if (!press.ids || Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      press.dragging = true;
      setHint(null);
    }
    const p = pointInTable(e);
    setDrag({ ids: press.ids, dx, dy, target: findDropTarget(press.src, dx, dy, p.x, p.y) });
  };

  const finishPress = (e, cancelled) => {
    const press = pressRef.current;
    if (!press || press.pointerId !== e.pointerId) return;
    pressRef.current = null;
    if (cancelled) {
      setDrag(null);
      return;
    }
    if (press.dragging) {
      const p = pointInTable(e);
      const target = findDropTarget(press.src, e.clientX - press.x, e.clientY - press.y, p.x, p.y);
      if (target !== null) apply((g) => moveCards(g, press.src, target));
      setDrag(null);
      return;
    }
    handleTap(press.src, press.pointerType, press.cardId);
  };

  // ----- rendering ------------------------------------------------------------------------------

  const { cardW, cardH, colX, columns, bottomY, doneFan, stockFan, gap } = layout;
  const dragIds = drag ? new Set(drag.ids) : null;
  const backUrl = cardBackUrl(settings.back);
  const cards = [];

  game.columns.forEach((column, col) => {
    const movableFrom = runStart(column);
    column.forEach((card, index) => {
      const lifted = dragIds?.has(card.id);
      const classes = ['sol-card'];
      if (card.faceUp) classes.push('is-up');
      if (card.faceUp && index >= movableFrom) classes.push('is-movable');
      if (lifted) classes.push('is-dragging');
      if (hint && hint.from.col === col && index >= hint.from.index) classes.push('is-hint');
      if (shake === card.id) classes.push('is-shaking');
      cards.push(
        <img
          key={card.id}
          src={card.faceUp ? cardFaceUrl(card, variant) : backUrl}
          alt={card.faceUp ? cardName(card) : 'Face-down card'}
          draggable={false}
          data-card={card.id}
          data-pile="column"
          data-col={col}
          data-index={index}
          className={classes.join(' ')}
          style={{
            left: colX(col),
            top: columns[col].ys[index],
            width: cardW,
            height: cardH,
            zIndex: lifted ? 1000 + index : 10 + index,
            transform: lifted ? `translate(${drag.dx}px, ${drag.dy}px)` : undefined,
          }}
        />,
      );
    });
  });

  // Finished runs fan out from the bottom-left corner, King showing.
  game.completed.forEach((run, i) => {
    const king = { suit: run.suit, rank: 13 };
    cards.push(
      <img
        key={`done-${run.id}`}
        src={cardFaceUrl(king, variant)}
        alt={`Finished run of ${cardName(king).replace('King of ', '')}`}
        draggable={false}
        className="sol-card is-up sol-card--done"
        style={{ left: colX(0) + i * doneFan, top: bottomY, width: cardW, height: cardH, zIndex: 5 + i }}
      />,
    );
  });

  // The stock: one face-down card per deal left, fanned leftwards from the bottom-right corner.
  const deals = dealsLeft(game);
  for (let k = 0; k < deals; k += 1) {
    cards.push(
      <img
        key={`stock-${k}`}
        src={backUrl}
        alt={k === deals - 1 ? `Deal a new row (${deals} left)` : ''}
        draggable={false}
        data-pile="stock"
        className="sol-card sol-card--stock"
        style={{
          left: colX(COLUMNS - 1) - (deals - 1 - k) * stockFan,
          top: bottomY,
          width: cardW,
          height: cardH,
          zIndex: 5 + k,
        }}
      />,
    );
  }

  let highlight = null;
  const targetCol = drag ? drag.target : hint?.to;
  if (targetCol !== null && targetCol !== undefined) {
    const r = columnRects[targetCol];
    highlight = <div className="sol-target" style={{ left: r.x, top: r.y, width: r.w, height: r.h }} />;
  }

  // The score box sits between the finished runs and the stock.
  const leftEdge = colX(0) + Math.max(0, game.completed.length - 1) * doneFan + cardW + gap;
  const rightEdge = colX(COLUMNS - 1) - Math.max(0, deals - 1) * stockFan - gap;
  const boxW = Math.max(70, Math.min(cardW * 2.4, rightEdge - leftEdge));
  const centred = layout.left + layout.totalW / 2 - boxW / 2;
  const boxLeft = Math.max(leftEdge, Math.min(centred, rightEdge - boxW));

  const noHistory = !history.length || game.won;
  const gameItems = [
    { label: 'New Game', shortcut: 'F2', onSelect: () => newGame() },
    { label: 'Restart This Game', onSelect: restartGame },
    '-',
    { label: 'Undo', shortcut: 'Ctrl+Z', onSelect: undo, disabled: noHistory },
    { label: 'Deal New Row', shortcut: 'D', onSelect: tryDeal, disabled: !game.stock.length || game.won },
    { label: 'Show An Available Move', shortcut: 'M', onSelect: showHint, disabled: game.won },
    '-',
    { label: 'Difficulty…', onSelect: () => setDialog('difficulty') },
    { label: 'Card Back…', onSelect: () => setDialog('deck') },
    { label: 'Statistics…', onSelect: () => setDialog('stats') },
    '-',
    { label: 'Exit', onSelect: () => navigate('/') },
  ];
  const helpItems = [
    { label: 'How to Play', shortcut: 'F1', onSelect: () => setDialog('help') },
    { label: 'About Spider Solitaire…', onSelect: () => setDialog('about') },
  ];
  const closeDialog = () => setDialog(null);
  const hoverMenu = (id) => menu && setMenu(id);

  return (
    <div className="solitaire">
      <section className="sol-window" aria-label="Spider Solitaire">
        <header className="sol-titlebar">
          <span className="sol-titlebar__icon" aria-hidden="true">
            <img src={cardFaceUrl({ suit: 's', rank: 1 }, 'compact')} alt="" />
          </span>
          <h1 className="sol-titlebar__text">Spider Solitaire</h1>
        </header>

        <nav className="sol-menubar" aria-label="Spider Solitaire menu">
          <Menu id="game" label="Game" open={menu === 'game'} onOpen={setMenu} onHover={hoverMenu} items={gameItems} />
          <Menu id="help" label="Help" open={menu === 'help'} onOpen={setMenu} onHover={hoverMenu} items={helpItems} />
          <div className="sol-menubar__quick">
            <button type="button" className="sol-quick" onClick={undo} disabled={noHistory} aria-label="Undo">
              <svg viewBox="0 0 20 20" aria-hidden="true">{QUICK_ICONS.undo}</svg>
            </button>
            <button type="button" className="sol-quick" onClick={showHint} disabled={game.won} aria-label="Show an available move">
              <svg viewBox="0 0 20 20" aria-hidden="true">{QUICK_ICONS.hint}</svg>
            </button>
            <button type="button" className="sol-quick" onClick={() => newGame()} aria-label="New game">
              <svg viewBox="0 0 20 20" aria-hidden="true">{QUICK_ICONS.newGame}</svg>
            </button>
          </div>
        </nav>

        <div
          ref={feltRef}
          className={`sol-felt${drag ? ' is-dragging' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => finishPress(e, false)}
          onPointerCancel={(e) => finishPress(e, true)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div ref={tableRef} className="sol-table" style={{ height: layout.contentH }}>
            {game.columns.map((_, i) => (
              <div
                key={`slot-${i}`}
                className="sol-slot sol-slot--tableau"
                style={{ left: colX(i), top: layout.topY, width: cardW, height: cardH }}
                aria-hidden="true"
              />
            ))}
            <div
              className="sol-slot sol-slot--done"
              style={{ left: colX(0), top: bottomY, width: cardW, height: cardH }}
              aria-hidden="true"
            />
            {highlight}
            {cards}
            <div
              className="sol-scorebox"
              style={{
                left: boxLeft,
                top: bottomY + cardH * 0.18,
                width: boxW,
                minHeight: cardH * 0.64,
                fontSize: Math.max(11, Math.min(15, Math.round(cardW * 0.19))),
              }}
            >
              <div>Score: {game.score}</div>
              <div>Moves: {game.moves}</div>
            </div>
          </div>
          <canvas
            ref={canvasRef}
            className={`sol-cascade${celebrating ? ' is-shown is-active' : ''}`}
            style={{ height: layout.contentH }}
            aria-hidden={!celebrating}
            aria-label={celebrating ? 'You won! Tap to skip.' : undefined}
          />
        </div>
      </section>

      {dialog === 'difficulty' && (
        <DifficultyDialog
          current={settings.suits}
          onClose={closeDialog}
          onSave={(suits) => {
            setSettings((s) => ({ ...s, suits }));
            newGame(suits);
          }}
        />
      )}
      {dialog === 'deck' && (
        <DeckDialog
          current={settings.back}
          onClose={closeDialog}
          onSave={(back) => {
            setSettings((s) => ({ ...s, back }));
            closeDialog();
          }}
        />
      )}
      {dialog === 'stats' && <StatsDialog stats={stats} onClose={closeDialog} onReset={() => setStats(emptyStats())} />}
      {dialog === 'help' && <HelpDialog onClose={closeDialog} />}
      {dialog === 'about' && (
        <Dialog title="About Spider Solitaire" onClose={closeDialog} actions={<OkCancel onOk={closeDialog} />}>
          <p className="sol-about">
            Spider Solitaire for Lori-Net, made with love. The cards and backs are drawn fresh for this
            site. Your game is saved on this device, so you can leave and pick up where you left off.
          </p>
        </Dialog>
      )}
      {dialog === 'no-deal' && (
        <Dialog title="Spider Solitaire" onClose={closeDialog} actions={<OkCancel onOk={closeDialog} />}>
          <p className="sol-about">You can&rsquo;t deal a new row while any column is empty. Fill every column first.</p>
        </Dialog>
      )}
      {dialog === 'no-moves-deal' && (
        <Dialog
          title="Spider Solitaire"
          onClose={closeDialog}
          actions={(
            <OkCancel
              ok="Deal"
              onOk={() => {
                closeDialog();
                tryDeal();
              }}
              onCancel={closeDialog}
            />
          )}
        >
          <p className="sol-about">There are no more moves on the table. Deal a new row?</p>
        </Dialog>
      )}
      {dialog === 'no-moves' && (
        <Dialog
          title="Spider Solitaire"
          onClose={closeDialog}
          actions={<OkCancel ok="New Game" onOk={() => newGame()} onCancel={closeDialog} cancel="Keep looking" />}
        >
          <p className="sol-about">There are no more moves available.</p>
        </Dialog>
      )}
      {dialog === 'won' && (
        <Dialog
          title="Spider Solitaire"
          onClose={closeDialog}
          actions={<OkCancel ok="Yes" onOk={() => newGame()} onCancel={closeDialog} cancel="No" />}
        >
          <div className="sol-won">
            <p className="sol-won__title">Congratulations, you won! 🎉</p>
            <p>Score: {game.score} in {game.moves} moves.</p>
            <p>Would you like to start another game?</p>
          </div>
        </Dialog>
      )}
    </div>
  );
}

export default SpiderSolitaire;
