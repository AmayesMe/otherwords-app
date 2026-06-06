/**
 * Lobby component tests
 *
 * Validates game-card rendering: P1-always-left score ordering, all five
 * card status states, time sub-line copy, and sort-by-activity.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mock localStorage BEFORE any store import ────────────────────────────────
const localStorageMock = vi.hoisted(() => {
  let store: Record<string, string> = {};
  const mock = {
    getItem:    (k: string) => store[k] ?? null,
    setItem:    (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear:      () => { store = {}; },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: mock, writable: true, configurable: true });
  return mock;
});

// ── Mock gameSync so getGame is injectable ───────────────────────────────────
vi.mock('../../lib/gameSync', () => ({
  createGame:       vi.fn().mockResolvedValue('TEST01'),
  joinGame:         vi.fn().mockResolvedValue({}),
  pushState:        vi.fn().mockResolvedValue(undefined),
  subscribeToGame:  vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
  getGame:          vi.fn().mockResolvedValue(null),
}));

// ── Mock dictionary ──────────────────────────────────────────────────────────
vi.mock('../../game/dictionary', () => ({
  loadDictionary: vi.fn().mockResolvedValue(undefined),
  isValidWord:    vi.fn().mockReturnValue(true),
}));

// ── Imports after mocks ──────────────────────────────────────────────────────
import { useGameStore } from '../../store/gameStore';
import { getGame } from '../../lib/gameSync';
import { Lobby } from './Lobby';

// ── Helpers ──────────────────────────────────────────────────────────────────

function isoAgo(ms: number) {
  return new Date(Date.now() - ms).toISOString();
}

function makeGameRow(overrides: Partial<{
  player1Score: number;
  player2Score: number;
  player1Name: string;
  player2Name: string;
  currentPlayer: string;
  gameOver: unknown;
  turnCount: number;
  player2_joined: boolean;
  updated_at: string;
}> = {}) {
  return {
    state: {
      player1Score:  overrides.player1Score  ?? 0,
      player2Score:  overrides.player2Score  ?? 0,
      player1Name:   overrides.player1Name   ?? 'Player 1',
      player2Name:   overrides.player2Name   ?? 'Player 2',
      currentPlayer: overrides.currentPlayer ?? 'player1',
      gameOver:      overrides.gameOver      ?? null,
      turnCount:     overrides.turnCount     ?? 0,
    },
    player2_joined: overrides.player2_joined ?? true,
    updated_at:     overrides.updated_at     ?? isoAgo(5 * 60_000),
  };
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorageMock.clear();
  vi.mocked(getGame).mockResolvedValue(null); // default: not found
  // Put the store back to a clean state with a local game running
  // (so screen === 'game' — we need to switch to lobby)
  useGameStore.getState().resetToLobby();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Lobby menu screen', () => {
  it('shows the title', () => {
    render(<Lobby />);
    expect(screen.getByText('Otherwords')).toBeInTheDocument();
  });

  it('shows New Game, Join Game, Play Local buttons', () => {
    render(<Lobby />);
    expect(screen.getByText('New Game')).toBeInTheDocument();
    expect(screen.getByText('Join Game')).toBeInTheDocument();
    expect(screen.getByText('Play Local')).toBeInTheDocument();
  });
});

// ── Card: P1 always left ─────────────────────────────────────────────────────

describe('Game card — P1 always on the left', () => {
  it('shows P1 name on the left even when the viewer is Player 2', async () => {
    // Viewer is player2; P1 is "Alice", P2 is "Me"
    vi.mocked(getGame).mockResolvedValue(
      makeGameRow({ player1Name: 'Alice', player2Name: 'Me', currentPlayer: 'player2' })
    );
    useGameStore.setState({
      savedGames: [{ gameId: 'GAME01', role: 'player2' }],
    });

    render(<Lobby />);

    // Both names must appear; Alice (P1) should come before Me (P2) in DOM order
    const alice = await screen.findByText('Alice');
    const me    = await screen.findByText('Me');
    expect(alice).toBeInTheDocument();
    expect(me).toBeInTheDocument();
    // DOM order: P1 block renders before P2 block
    expect(alice.compareDocumentPosition(me) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows P1 name on the left when viewer is Player 1', async () => {
    vi.mocked(getGame).mockResolvedValue(
      makeGameRow({ player1Name: 'Me', player2Name: 'Bob', currentPlayer: 'player2' })
    );
    useGameStore.setState({
      savedGames: [{ gameId: 'GAME02', role: 'player1' }],
    });

    render(<Lobby />);

    const me  = await screen.findByText('Me');
    const bob = await screen.findByText('Bob');
    expect(me.compareDocumentPosition(bob) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// ── Card: status states ───────────────────────────────────────────────────────

describe('Game card — status states', () => {
  it('shows "Your turn" when currentPlayer === viewer role', async () => {
    vi.mocked(getGame).mockResolvedValue(
      makeGameRow({ currentPlayer: 'player1', player2_joined: true, turnCount: 3 })
    );
    useGameStore.setState({ savedGames: [{ gameId: 'TURN1', role: 'player1' }] });
    render(<Lobby />);
    expect(await screen.findByText('Your turn')).toBeInTheDocument();
  });

  it('shows "Their turn" when currentPlayer !== viewer role', async () => {
    vi.mocked(getGame).mockResolvedValue(
      makeGameRow({ currentPlayer: 'player1', player2_joined: true })
    );
    useGameStore.setState({ savedGames: [{ gameId: 'TURN2', role: 'player2' }] });
    render(<Lobby />);
    expect(await screen.findByText('Their turn')).toBeInTheDocument();
  });

  it('shows "Waiting for opponent" when player2 hasn\'t joined', async () => {
    vi.mocked(getGame).mockResolvedValue(
      makeGameRow({ player2_joined: false })
    );
    useGameStore.setState({ savedGames: [{ gameId: 'WAIT1', role: 'player1' }] });
    render(<Lobby />);
    expect(await screen.findByText('Waiting for opponent')).toBeInTheDocument();
  });

  it('shows "Game over" when gameOver is set in state', async () => {
    vi.mocked(getGame).mockResolvedValue(
      makeGameRow({
        gameOver: { winner: 'player1', reason: 'rack-empty', player1Score: 80, player2Score: 60 },
      })
    );
    useGameStore.setState({ savedGames: [{ gameId: 'DONE1', role: 'player1' }] });
    render(<Lobby />);
    expect(await screen.findByText('Game over')).toBeInTheDocument();
  });

  it('shows "Game not found" when getGame returns null', async () => {
    vi.mocked(getGame).mockResolvedValue(null);
    useGameStore.setState({ savedGames: [{ gameId: 'GONE1', role: 'player1' }] });
    render(<Lobby />);
    expect(await screen.findByText('Game not found')).toBeInTheDocument();
  });
});

// ── Card: time sub-line ───────────────────────────────────────────────────────

describe('Game card — time sub-line', () => {
  it('shows "[Opponent] played X ago" on your-turn', async () => {
    vi.mocked(getGame).mockResolvedValue(
      makeGameRow({
        player1Name: 'Me', player2Name: 'Jessica',
        currentPlayer: 'player1',       // viewer is player1 — it's my turn
        player2_joined: true,
        turnCount: 4,
        updated_at: isoAgo(2 * 3_600_000), // 2h ago
      })
    );
    useGameStore.setState({ savedGames: [{ gameId: 'T001', role: 'player1' }] });
    render(<Lobby />);
    // Should say "Jessica played 2h ago" (or similar compact format)
    const timeEl = await screen.findByText(/jessica played/i);
    expect(timeEl).toBeInTheDocument();
    expect(timeEl.textContent).toMatch(/ago/i);
  });

  it('shows "You played X ago" on their-turn', async () => {
    vi.mocked(getGame).mockResolvedValue(
      makeGameRow({
        player1Name: 'Me', player2Name: 'Alex',
        currentPlayer: 'player2',       // it's player2's turn; viewer is player1 = their turn
        player2_joined: true,
        updated_at: isoAgo(15 * 60_000), // 15m ago
      })
    );
    useGameStore.setState({ savedGames: [{ gameId: 'T002', role: 'player1' }] });
    render(<Lobby />);
    const timeEl = await screen.findByText(/you played/i);
    expect(timeEl).toBeInTheDocument();
    expect(timeEl.textContent).toMatch(/ago/i);
  });

  it('shows no time on your-turn when turnCount is 0 (first move)', async () => {
    vi.mocked(getGame).mockResolvedValue(
      makeGameRow({ currentPlayer: 'player1', player2_joined: true, turnCount: 0 })
    );
    useGameStore.setState({ savedGames: [{ gameId: 'T003', role: 'player1' }] });
    render(<Lobby />);
    await screen.findByText('Your turn');
    expect(screen.queryByText(/played/i)).toBeNull();
  });
});

// ── Card: score tiles show correct digits ─────────────────────────────────────

describe('Game card — score digits', () => {
  it('shows P1 score digits (47) and P2 score digits (23)', async () => {
    vi.mocked(getGame).mockResolvedValue(
      makeGameRow({ player1Score: 47, player2Score: 23, currentPlayer: 'player1', player2_joined: true })
    );
    useGameStore.setState({ savedGames: [{ gameId: 'SC01', role: 'player1' }] });
    render(<Lobby />);
    // The Tile component renders digits as text content inside .tile-face elements
    // Wait for the card to load (status changes from loading)
    await screen.findByText('Your turn');
    // 4, 7, 2, 3 should all appear as tile face content
    const tiles = document.querySelectorAll('.lobby-game-score-row .tile-face');
    const faceTexts = Array.from(tiles).map(t => t.textContent?.trim()).filter(Boolean);
    // P1 score 47 → tiles '4','7';  P2 score 23 → tiles '2','3'
    // (front face only has the digit; back face repeats it — filter duplicates)
    expect(faceTexts).toContain('4');
    expect(faceTexts).toContain('7');
    expect(faceTexts).toContain('2');
    expect(faceTexts).toContain('3');
  });

  it('shows 3 digits for scores ≥ 100', async () => {
    vi.mocked(getGame).mockResolvedValue(
      makeGameRow({ player1Score: 102, player2Score: 99, player2_joined: true, currentPlayer: 'player1' })
    );
    useGameStore.setState({ savedGames: [{ gameId: 'SC02', role: 'player1' }] });
    render(<Lobby />);
    await screen.findByText('Your turn');
    // P1 score block should have 3 tile containers; P2 should have 2
    const scoreRow = document.querySelector('.lobby-game-score-row');
    const blocks   = scoreRow?.querySelectorAll('.lobby-game-score-block') ?? [];
    expect(blocks[0]?.querySelectorAll('.tile-container').length).toBe(3); // 102
    expect(blocks[1]?.querySelectorAll('.tile-container').length).toBe(2); // 99
  });
});

// ── Card: remove button ───────────────────────────────────────────────────────

describe('Game card — remove button', () => {
  it('removes the card from the list without resuming the game', async () => {
    vi.mocked(getGame).mockResolvedValue(
      makeGameRow({ currentPlayer: 'player1', player2_joined: true })
    );
    useGameStore.setState({ savedGames: [{ gameId: 'REM1', role: 'player1' }] });
    render(<Lobby />);

    await screen.findByText('Your turn');
    const screen_before = useGameStore.getState().screen;
    expect(screen_before).toBe('lobby');

    const removeBtn = screen.getByTitle('Remove');
    await userEvent.click(removeBtn);

    // Card should be gone
    expect(screen.queryByText('Your turn')).toBeNull();
    // Screen should still be lobby (not entered the game)
    expect(useGameStore.getState().screen).toBe('lobby');
  });
});

// ── Sort by most-recent activity ──────────────────────────────────────────────

describe('Game card — sorted by most recent activity', () => {
  it('shows the most recently updated game first', async () => {
    const mockGetGame = vi.mocked(getGame);
    mockGetGame.mockImplementation(async (gameId: string) => {
      if (gameId === 'OLD01') return makeGameRow({
        player1Name: 'OldGame', player2Name: 'P2',
        currentPlayer: 'player1', player2_joined: true,
        updated_at: isoAgo(5 * 3_600_000), // 5h ago — older
      });
      if (gameId === 'NEW01') return makeGameRow({
        player1Name: 'NewGame', player2Name: 'P2',
        currentPlayer: 'player1', player2_joined: true,
        updated_at: isoAgo(10 * 60_000),   // 10m ago — more recent
      });
      return null;
    });

    // Insert in OLD → NEW order; after sort NEW should appear first
    useGameStore.setState({
      savedGames: [
        { gameId: 'OLD01', role: 'player1' },
        { gameId: 'NEW01', role: 'player1' },
      ],
    });

    render(<Lobby />);

    // Wait for both cards to finish loading
    await waitFor(() => {
      expect(screen.queryAllByText('Your turn').length).toBe(2);
    });

    const names = screen.getAllByText(/Game/);  // 'OldGame' and 'NewGame'
    const newGameName = names.find(el => el.textContent === 'NewGame');
    const oldGameName = names.find(el => el.textContent === 'OldGame');
    expect(newGameName).toBeTruthy();
    expect(oldGameName).toBeTruthy();
    // NewGame should appear before OldGame in the DOM
    expect(
      newGameName!.compareDocumentPosition(oldGameName!) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
