import './Lobby.css';
import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getGame } from '../../lib/gameSync';
import type { Player } from '../../game/types';
import type { SavedGame } from '../../store/gameStore';

type Mode = 'menu' | 'creating' | 'waiting' | 'joining';

type GameStatusKind = 'loading' | 'your-turn' | 'their-turn' | 'waiting' | 'not-found';

function statusLabel(kind: GameStatusKind): string {
  switch (kind) {
    case 'loading':    return '…';
    case 'your-turn':  return 'Your turn';
    case 'their-turn': return 'Their turn';
    case 'waiting':    return 'Waiting for opponent';
    case 'not-found':  return 'Not found';
  }
}

function statusClass(kind: GameStatusKind): string {
  const base = 'lobby-game-status';
  switch (kind) {
    case 'your-turn':  return `${base} lobby-game-status-yours`;
    case 'their-turn': return `${base} lobby-game-status-theirs`;
    case 'waiting':    return `${base} lobby-game-status-waiting`;
    case 'not-found':  return `${base} lobby-game-status-error`;
    default:           return `${base} lobby-game-status-theirs`;
  }
}

async function fetchStatus(game: SavedGame): Promise<GameStatusKind> {
  const data = await getGame(game.gameId);
  if (!data) return 'not-found';
  if (!data.player2_joined) return 'waiting';
  return data.state.currentPlayer === game.role ? 'your-turn' : 'their-turn';
}

export function Lobby() {
  const {
    startLocalGame,
    createOnlineGame,
    joinOnlineGame,
    resumeGame,
    removeSavedGame,
    savedGames,
    isWaitingForOpponent,
    gameId: storeGameId,
  } = useGameStore();

  const [mode, setMode] = useState<Mode>('menu');
  const [gameCode, setGameCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, GameStatusKind>>({});

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus join input when that screen appears
  useEffect(() => {
    if (mode === 'joining') inputRef.current?.focus();
  }, [mode]);

  // Fetch game statuses whenever the menu is shown or the list changes
  useEffect(() => {
    if (mode !== 'menu' || savedGames.length === 0) return;
    setStatuses(Object.fromEntries(savedGames.map(g => [g.gameId, 'loading' as GameStatusKind])));
    savedGames.forEach(game => {
      fetchStatus(game).then(kind => {
        setStatuses(prev => ({ ...prev, [game.gameId]: kind }));
      });
    });
  }, [mode, savedGames]);

  // If the store enters waiting-for-opponent while on lobby (e.g. after resuming a
  // game that's still open), switch to the waiting screen automatically.
  useEffect(() => {
    if (isWaitingForOpponent && storeGameId && mode !== 'waiting') {
      setGameCode(storeGameId);
      setMode('waiting');
    }
  }, [isWaitingForOpponent, storeGameId, mode]);

  async function handleCreate() {
    setMode('creating');
    setIsLoading(true);
    setError(null);
    try {
      const code = await createOnlineGame();
      setGameCode(code);
      setMode('waiting');
    } catch (e) {
      setError((e as Error).message ?? 'Failed to create game. Check your connection.');
      setMode('menu');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleJoin() {
    if (joinCode.trim().length < 6) return;
    setIsLoading(true);
    setError(null);
    try {
      await joinOnlineGame(joinCode.trim());
      // store sets screen → 'playing', Lobby unmounts
    } catch (e) {
      setError((e as Error).message ?? 'Failed to join. Try again.');
      setIsLoading(false);
    }
  }

  function handleJoinKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleJoin();
  }

  async function handleResume(game: SavedGame) {
    setResumingId(game.gameId);
    setError(null);
    try {
      await resumeGame(game.gameId, game.role as Player);
      // If game is active → screen becomes 'playing' and Lobby unmounts.
      // If still waiting → isWaitingForOpponent effect above fires, sets mode 'waiting'.
    } catch (e) {
      setError((e as Error).message ?? 'Could not resume game.');
      setStatuses(prev => ({ ...prev, [game.gameId]: 'not-found' }));
    } finally {
      setResumingId(null);
    }
  }

  return (
    <div className="lobby">
      <div className="lobby-card">
        <h1 className="lobby-title">Otherwords</h1>

        {/* ── Main menu ─────────────────────────────────────────────── */}
        {mode === 'menu' && (
          <div className="lobby-section">

            {/* Active games list — only shown when the device has games */}
            {savedGames.length > 0 && (
              <>
                <p className="lobby-games-header">Your games</p>
                <div className="lobby-games-list">
                  {savedGames.map(game => {
                    const kind: GameStatusKind = statuses[game.gameId] ?? 'loading';
                    const isResuming = resumingId === game.gameId;
                    return (
                      <div key={game.gameId} className="lobby-game-row">
                        <span className="lobby-game-id">{game.gameId}</span>
                        <span className={statusClass(kind)}>{statusLabel(kind)}</span>
                        <button
                          className="lobby-game-resume"
                          onClick={() => handleResume(game)}
                          disabled={isResuming || kind === 'not-found'}
                        >
                          {isResuming ? '…' : 'Resume'}
                        </button>
                        <button
                          className="lobby-game-remove"
                          onClick={() => removeSavedGame(game.gameId)}
                          title="Remove from list"
                          aria-label="Remove game"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="lobby-divider" />
              </>
            )}

            {error && <p className="lobby-error">{error}</p>}
            <div className="lobby-actions">
              <button className="lobby-btn lobby-btn-primary" onClick={handleCreate}>
                New Game
              </button>
              <button className="lobby-btn lobby-btn-secondary" onClick={() => { setError(null); setMode('joining'); }}>
                Join Game
              </button>
              <button className="lobby-btn lobby-btn-ghost" onClick={startLocalGame}>
                Play Local
              </button>
            </div>
          </div>
        )}

        {/* ── Creating (spinner) ────────────────────────────────────── */}
        {mode === 'creating' && (
          <div className="lobby-section lobby-centered">
            <div className="lobby-spinner" />
            <p className="lobby-hint">Setting up your game…</p>
          </div>
        )}

        {/* ── Waiting for opponent ──────────────────────────────────── */}
        {mode === 'waiting' && (
          <div className="lobby-section lobby-centered">
            <p className="lobby-hint">Share this code with your opponent</p>
            <div className="lobby-code">{gameCode}</div>
            {isWaitingForOpponent
              ? <p className="lobby-hint">Waiting for opponent to join…</p>
              : <p className="lobby-hint lobby-hint-success">Opponent joined! Starting…</p>
            }
            <button
              className="lobby-btn lobby-btn-ghost lobby-btn-sm"
              onClick={() => useGameStore.getState().resetToLobby()}
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── Join flow ─────────────────────────────────────────────── */}
        {mode === 'joining' && (
          <div className="lobby-section lobby-centered">
            <p className="lobby-hint">Enter the 6-character game code</p>
            <input
              ref={inputRef}
              className="lobby-input"
              type="text"
              maxLength={6}
              placeholder="XXXXXX"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={handleJoinKeyDown}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
            {error && <p className="lobby-error">{error}</p>}
            <div className="lobby-actions lobby-actions-row">
              <button
                className="lobby-btn lobby-btn-secondary"
                onClick={() => { setMode('menu'); setError(null); setJoinCode(''); }}
              >
                Back
              </button>
              <button
                className="lobby-btn lobby-btn-primary"
                onClick={handleJoin}
                disabled={isLoading || joinCode.trim().length < 6}
              >
                {isLoading ? 'Joining…' : 'Join'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
