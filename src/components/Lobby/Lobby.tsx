import './Lobby.css';
import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getGame } from '../../lib/gameSync';
import type { Player } from '../../game/types';
import type { SavedGame } from '../../store/gameStore';

type Mode = 'menu' | 'creating' | 'waiting' | 'joining';

type GameStatusKind = 'loading' | 'your-turn' | 'their-turn' | 'waiting' | 'not-found';

interface GameInfo {
  kind: GameStatusKind;
  myScore: number;
  theirScore: number;
  myName: string;
  theirName: string;
  updatedAt: string;
  turnCount: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusLabel(kind: GameStatusKind): string {
  switch (kind) {
    case 'loading':    return '…';
    case 'your-turn':  return 'Your turn';
    case 'their-turn': return 'Their turn';
    case 'waiting':    return 'Waiting for opponent';
    case 'not-found':  return 'Game not found';
  }
}

function statusClass(kind: GameStatusKind): string {
  const b = 'lobby-game-status';
  switch (kind) {
    case 'your-turn':  return `${b} lobby-game-status-yours`;
    case 'their-turn': return `${b} lobby-game-status-theirs`;
    case 'waiting':    return `${b} lobby-game-status-waiting`;
    case 'not-found':  return `${b} lobby-game-status-error`;
    default:           return `${b} lobby-game-status-theirs`;
  }
}

function formatTimeSince(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins} minute${mins  === 1 ? '' : 's'} ago`;
  if (hours < 24) {
    const rem = mins % 60;
    return rem === 0
      ? `${hours} hour${hours === 1 ? '' : 's'} ago`
      : `${hours} hour${hours === 1 ? '' : 's'} and ${rem} minute${rem === 1 ? '' : 's'} ago`;
  }
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

async function fetchGameInfo(game: SavedGame, localName: string): Promise<GameInfo> {
  const data = await getGame(game.gameId);
  if (!data) {
    return { kind: 'not-found', myScore: 0, theirScore: 0, myName: localName || 'You', theirName: 'Opponent', updatedAt: '', turnCount: 0 };
  }
  const isP1      = game.role === 'player1';
  const myScore    = isP1 ? data.state.player1Score : data.state.player2Score;
  const theirScore = isP1 ? data.state.player2Score : data.state.player1Score;
  const myName     = (isP1 ? data.state.player1Name : data.state.player2Name) || localName || 'You';
  const theirName  = (isP1 ? data.state.player2Name : data.state.player1Name) || 'Opponent';
  let kind: GameStatusKind;
  if (!data.player2_joined)                              kind = 'waiting';
  else if (data.state.currentPlayer === game.role)       kind = 'your-turn';
  else                                                   kind = 'their-turn';
  return { kind, myScore, theirScore, myName, theirName, updatedAt: data.updated_at ?? '', turnCount: data.state.turnCount };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Lobby() {
  const {
    startLocalGame,
    createOnlineGame,
    joinOnlineGame,
    resumeGame,
    removeSavedGame,
    setPlayerName,
    startPlayingNow,
    savedGames,
    myName,
    isWaitingForOpponent,
    gameId: storeGameId,
  } = useGameStore();

  const [mode, setMode]         = useState<Mode>('menu');
  const [gameCode, setGameCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading]   = useState(false);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [gameInfos, setGameInfos]   = useState<Record<string, GameInfo>>({});
  const [copied, setCopied]         = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === 'joining') inputRef.current?.focus();
  }, [mode]);

  // Fetch statuses + scores whenever the menu is shown
  useEffect(() => {
    if (mode !== 'menu' || savedGames.length === 0) return;
    setGameInfos(
      Object.fromEntries(
        savedGames.map(g => [g.gameId, {
          kind: 'loading' as GameStatusKind,
          myScore: 0, theirScore: 0,
          myName: myName || 'You', theirName: 'Opponent',
          updatedAt: '', turnCount: 0,
        }])
      )
    );
    savedGames.forEach(game => {
      fetchGameInfo(game, myName).then(info => {
        setGameInfos(prev => ({ ...prev, [game.gameId]: info }));
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, savedGames]);

  // Auto-switch to waiting screen when store enters waiting-for-opponent
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
    } catch (e) {
      setError((e as Error).message ?? 'Could not resume game.');
      setGameInfos(prev => ({ ...prev, [game.gameId]: { ...prev[game.gameId], kind: 'not-found' } }));
    } finally {
      setResumingId(null);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(gameCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  }

  return (
    <div className="lobby">
      <div className="lobby-card">
        <h1 className="lobby-title">Otherwords</h1>

        {/* ── Main menu ─────────────────────────────────────────────── */}
        {mode === 'menu' && (
          <div className="lobby-section">

            {/* Name field */}
            <div className="lobby-name-field">
              <input
                className="lobby-name-input"
                value={myName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="Your name"
                maxLength={15}
                spellCheck={false}
                autoComplete="off"
              />
            </div>

            {/* Active games */}
            {savedGames.length > 0 && (
              <>
                <p className="lobby-games-header">Your games</p>
                <div className="lobby-games-list">
                  {savedGames.map(game => {
                    const info       = gameInfos[game.gameId];
                    const kind       = info?.kind ?? 'loading';
                    const isResuming = resumingId === game.gameId;
                    const showTime   = kind === 'your-turn' && info?.turnCount > 0 && info?.updatedAt;
                    return (
                      <div key={game.gameId} className="lobby-game-row">
                        <div className="lobby-game-left">
                          {/* Player names + individual scores */}
                          <div className="lobby-game-matchup">
                            <span className="lobby-game-player">
                              <span className="lobby-game-player-name">{info?.myName ?? '…'}</span>
                              <span className="lobby-game-player-score">{info?.myScore ?? 0}</span>
                            </span>
                            <span className="lobby-game-vs">vs</span>
                            <span className="lobby-game-player">
                              <span className="lobby-game-player-score">{info?.theirScore ?? 0}</span>
                              <span className="lobby-game-player-name">{info?.theirName ?? '…'}</span>
                            </span>
                          </div>

                          {/* Status + time */}
                          <div className="lobby-game-sub">
                            <span className={statusClass(kind)}>{statusLabel(kind)}</span>
                            {showTime && (
                              <>
                                <span className="lobby-game-sep">·</span>
                                <span className="lobby-game-time">
                                  {info.theirName} played {formatTimeSince(info.updatedAt)}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Game code — small, tertiary */}
                          <span className="lobby-game-code-label">{game.gameId}</span>
                        </div>

                        <div className="lobby-game-actions">
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
                            title="Remove"
                            aria-label="Remove"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="lobby-divider" />
              </>
            )}

            {error && <p className="lobby-error">{error}</p>}
            <div className="lobby-actions">
              <button className="lobby-btn lobby-btn-primary" onClick={handleCreate}>New Game</button>
              <button className="lobby-btn lobby-btn-secondary" onClick={() => { setError(null); setMode('joining'); }}>Join Game</button>
              <button className="lobby-btn lobby-btn-ghost" onClick={startLocalGame}>Play Local</button>
            </div>
          </div>
        )}

        {/* ── Creating ──────────────────────────────────────────────── */}
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
            <div className="lobby-code-wrap">
              <div className="lobby-code">{gameCode}</div>
              <button
                className={`lobby-code-copy${copied ? ' lobby-code-copy-done' : ''}`}
                onClick={handleCopy}
                aria-label="Copy code"
                title="Copy code"
              >
                {copied ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                )}
              </button>
            </div>
            {isWaitingForOpponent ? (
              <>
                <p className="lobby-hint">Waiting for opponent to join…</p>
                <button className="lobby-btn lobby-btn-primary" onClick={startPlayingNow}>
                  Start Playing
                </button>
                <p className="lobby-hint-sm">Your opponent can still join using the code above</p>
              </>
            ) : (
              <p className="lobby-hint lobby-hint-success">Opponent joined! Starting…</p>
            )}
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
              <button className="lobby-btn lobby-btn-secondary" onClick={() => { setMode('menu'); setError(null); setJoinCode(''); }}>
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
