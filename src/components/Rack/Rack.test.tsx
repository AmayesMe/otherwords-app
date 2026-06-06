/**
 * Rack component tests
 *
 * Focuses on two-row layout (>7 tiles) and bag-closed display.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock localStorage before any imports ─────────────────────────────────────
const localStorageMock = vi.hoisted(() => {
  let store: Record<string, string> = {};
  const mock = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: mock, writable: true, configurable: true });
  return mock;
});

vi.mock('../../lib/gameSync', () => ({
  createGame: vi.fn().mockResolvedValue('TEST01'),
  joinGame: vi.fn().mockResolvedValue({}),
  pushState: vi.fn().mockResolvedValue(undefined),
  subscribeToGame: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
  getGame: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../game/dictionary', () => ({
  loadDictionary: vi.fn().mockResolvedValue(undefined),
  isValidWord: vi.fn().mockReturnValue(true),
}));

import { render, screen } from '@testing-library/react';
import { Rack } from './Rack';
import { useGameStore } from '../../store/gameStore';

type RackTile = { id: string; letter: string; isWild: boolean };

beforeEach(() => {
  localStorageMock.clear();
  useGameStore.getState().startLocalGame();
});

// ── Two-row layout ────────────────────────────────────────────────────────────

describe('Rack — two-row layout', () => {
  it('renders a single rack row when rack has ≤7 tiles', () => {
    // Fresh game starts with 7 tiles — no overflow row
    render(<Rack />);
    const overflowRows = document.querySelectorAll('.rack-overflow-row');
    expect(overflowRows).toHaveLength(0);
  });

  it('renders an overflow row when rack has 8+ tiles', () => {
    // Give player1 8 tiles
    const extraRack: RackTile[] = Array.from({ length: 8 }, (_, i) => ({
      id: `t${i}`, letter: 'A', isWild: false,
    }));
    useGameStore.setState({ player1Rack: extraRack });

    render(<Rack />);
    const overflowRows = document.querySelectorAll('.rack-overflow-row');
    expect(overflowRows).toHaveLength(1);
  });

  it('overflow row contains only the tiles beyond the first 7', () => {
    // 10 tiles: first 7 in primary row, last 3 in overflow
    const rack: RackTile[] = Array.from({ length: 10 }, (_, i) => ({
      id: `tile-${i}`, letter: String.fromCharCode(65 + (i % 26)), isWild: false,
    }));
    useGameStore.setState({ player1Rack: rack });

    render(<Rack />);

    const overflowRow = document.querySelector('.rack-overflow-row');
    expect(overflowRow).not.toBeNull();
    // The overflow row should have 3 slot divs (indices 7, 8, 9)
    const slots = overflowRow!.querySelectorAll('.rack-slot');
    expect(slots).toHaveLength(3);
  });
});

// ── Bag display ───────────────────────────────────────────────────────────────

describe('Rack — bag display', () => {
  it('shows a numeric count when bag is open', () => {
    // Set a known bag size
    useGameStore.setState({ tileBag: ['A', 'B', 'C', 'D', 'E'], bagClosed: false });

    render(<Rack />);
    // The count span should show "5"
    expect(screen.getByText('5')).toBeInTheDocument();
    // No bag-count-closed class on the wrapper
    const bagWidget = document.querySelector('.bag-count');
    expect(bagWidget).not.toHaveClass('bag-count-closed');
  });

  it('applies bag-count-closed class when bag is closed', () => {
    useGameStore.setState({ tileBag: [], bagClosed: true });

    render(<Rack />);
    const bagWidget = document.querySelector('.bag-count');
    expect(bagWidget).toHaveClass('bag-count-closed');
    // Lock SVG rendered instead of count number
    const lockSvg = document.querySelector('.bag-closed-icon');
    expect(lockSvg).not.toBeNull();
    // No numeric count
    expect(document.querySelector('.bag-count-num')).toBeNull();
  });
});
