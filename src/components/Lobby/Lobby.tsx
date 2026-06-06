import './Lobby.css';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getGame } from '../../lib/gameSync';
import { Tile } from '../Tile/Tile';
import type { Player } from '../../game/types';
import type { SavedGame } from '../../store/gameStore';

type Mode = 'menu' | 'creating' | 'waiting' | 'joining';

type GameStatusKind = 'loading' | 'your-turn' | 'their-turn' | 'waiting' | 'finished' | 'not-found';

interface GameInfo {
  kind: GameStatusKind;
  p1Score:  number;    // Player 1 always, regardless of which player I am
  p2Score:  number;
  p1Name:   string;
  p2Name:   string;
  updatedAt: string;
  turnCount: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Same helper as App.tsx — 2 digits normally, 3 once score hits 100. */
function scoreDigits(n: number): string[] {
  const s = Math.min(Math.max(n, 0), 999);
  if (s >= 100) {
    return [String(Math.floor(s / 100)), String(Math.floor((s % 100) / 10)), String(s % 10)];
  }
  return [String(Math.floor(s / 10)), String(s % 10)];
}

function statusLabel(kind: GameStatusKind): string {
  switch (kind) {
    case 'loading':    return '…';
    case 'your-turn':  return 'Your turn';
    case 'their-turn': return 'Their turn';
    case 'waiting':    return 'Waiting for opponent';
    case 'finished':   return 'Game over';
    case 'not-found':  return 'Game not found';
  }
}

function statusClass(kind: GameStatusKind): string {
  const b = 'lobby-game-status';
  switch (kind) {
    case 'your-turn':  return `${b} lobby-game-status-yours`;
    case 'their-turn': return `${b} lobby-game-status-theirs`;
    case 'waiting':    return `${b} lobby-game-status-waiting`;
    case 'finished':   return `${b} lobby-game-status-finished`;
    case 'not-found':  return `${b} lobby-game-status-error`;
    default:           return `${b} lobby-game-status-theirs`;
  }
}

/** Compact relative time: "just now", "4m ago", "2h ago", "3d ago" */
function formatTimeSince(dateStr: string): string {
  if (!dateStr) return '';
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)   return 'just now';
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  return `${days}d ago`;
}

/**
 * Always returns P1/P2 in absolute terms so the display is consistent:
 * Player 1 (the creator) scores appear on the left regardless of which player
 * the viewer is.
 */
async function fetchGameInfo(game: SavedGame, localName: string): Promise<GameInfo> {
  const data = await getGame(game.gameId);
  if (!data) {
    return {
      kind: 'not-found',
      p1Score: 0, p2Score: 0,
      p1Name: 'Player 1', p2Name: 'Player 2',
      updatedAt: '', turnCount: 0,
    };
  }
  // Scores are always P1 / P2 — never swapped based on viewer role.
  const p1Score = data.state.player1Score;
  const p2Score = data.state.player2Score;

  // Prefer names from the server; fall back to local name for my own slot.
  const p1Name = data.state.player1Name
    || (game.role === 'player1' ? localName : '')
    || 'Player 1';
  const p2Name = data.state.player2Name
    || (game.role === 'player2' ? localName : '')
    || 'Player 2';

  let kind: GameStatusKind;
  if (data.state.gameOver)                             kind = 'finished';
  else if (!data.player2_joined)                       kind = 'waiting';
  else if (data.state.currentPlayer === game.role)     kind = 'your-turn';
  else                                                 kind = 'their-turn';

  return { kind, p1Score, p2Score, p1Name, p2Name, updatedAt: data.updated_at ?? '', turnCount: data.state.turnCount };
}

// ── Score tile block ──────────────────────────────────────────────────────────

interface ScoreBlockProps {
  score: number;
  owner: Player;
  name: string;
  align: 'left' | 'right';
}

function ScoreBlock({ score, owner, name, align }: ScoreBlockProps) {
  const digits = scoreDigits(score);
  return (
    <div className={`lobby-game-score-block lobby-game-score-block-${align}`}>
      <div className="lobby-game-score-tiles">
        {digits.map((d, i) => <Tile key={i} letter={d} owner={owner} />)}
      </div>
      <span className="lobby-game-score-name">{name || '–'}</span>
    </div>
  );
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

  const [mode, setMode]             = useState<Mode>('menu');
  const [gameCode, setGameCode]     = useState('');
  const [joinCode, setJoinCode]     = useState('');
  const [isLoading, setIsLoading]   = useState(false);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [gameInfos, setGameInfos]   = useState<Record<string, GameInfo>>({});
  const [copied, setCopied]         = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === 'joining') inputRef.current?.focus();
  }, [mode]);

  // Fetch status + scores whenever the menu is shown.
  // Initial placeholder state uses loading kind so tiles show 00/00.
  useEffect(() => {
    if (mode !== 'menu' || savedGames.length === 0) return;
    setGameInfos(
      Object.fromEntries(
        savedGames.map(g => [g.gameId, {
          kind: 'loading' as GameStatusKind,
          p1Score: 0, p2Score: 0,
          p1Name: g.role === 'player1' ? (myName || 'You') : 'Player 1',
          p2Name: g.role === 'player2' ? (myName || 'You') : 'Player 2',
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

  // Sort games by most-recent activity once we have updatedAt data.
  // Games still loading stay in insertion order relative to each other.
  const sortedGames = useMemo(() => {
    return [...savedGames].sort((a, b) => {
      const tA = gameInfos[a.gameId]?.updatedAt;
      const tB = gameInfos[b.gameId]?.updatedAt;
      if (!tA && !tB) return 0;
      if (!tA) return 1;
      if (!tB) return -1;
      return new Date(tB).getTime() - new Date(tA).getTime();
    });
  }, [savedGames, gameInfos]);

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
            {sortedGames.length > 0 && (
              <>
                <p className="lobby-games-header">Your games</p>
                <div className="lobby-games-list">
                  {sortedGames.map(game => {
                    const info        = gameInfos[game.gameId];
                    const kind        = info?.kind ?? 'loading';
                    const isResuming  = resumingId === game.gameId;
                    const canTap      = kind !== 'not-found' && !isResuming;

                    // Opponent name from viewer's perspective (for time message)
                    const opponentName = game.role === 'player1' ? info?.p2Name : info?.p1Name;

                    // Time sub-line copy depends on whose turn it is
                    let timeStr: string | null = null;
                    if (info?.updatedAt) {
                      if (kind === 'your-turn' && info.turnCount > 0) {
                        timeStr = `${opponentName ?? 'Opponent'} played ${formatTimeSince(info.updatedAt)}`;
                      } else if (kind === 'their-turn') {
                        timeStr = `You played ${formatTimeSince(info.updatedAt)}`;
                      } else if (kind === 'finished') {
                        timeStr = formatTimeSince(info.updatedAt);
                      }
                    }

                    return (
                      <div
                        key={game.gameId}
                        className={`lobby-game-row${canTap ? ' lobby-game-row-tappable' : ''}${isResuming ? ' lobby-game-row-loading' : ''}`}
                        onClick={canTap ? () => handleResume(game) : undefined}
                        role={canTap ? 'button' : undefined}
                        tabIndex={canTap ? 0 : undefined}
                        onKeyDown={canTap ? e => { if (e.key === 'Enter' || e.key === ' ') handleResume(game); } : undefined}
                      >
                        {/* ── Score tiles: P1 always left, P2 always right ── */}
                        <div className="lobby-game-score-row">
                          <ScoreBlock
                            score={info?.p1Score ?? 0}
                            owner="player1"
                            name={info?.p1Name ?? ''}
                            align="left"
                          />
                          <span className="lobby-game-vs">vs</span>
                          <ScoreBlock
                            score={info?.p2Score ?? 0}
                            owner="player2"
                            name={info?.p2Name ?? ''}
                            align="right"
                          />
                        </div>

                        {/* ── Status + time ── */}
                        <div className="lobby-game-sub">
                          <span className={statusClass(kind)}>{statusLabel(kind)}</span>
                          {timeStr && (
                            <>
                              <span className="lobby-game-sep">·</span>
                              <span className="lobby-game-time">{timeStr}</span>
                            </>
                          )}
                        </div>

                        {/* ── Game code — small, tertiary ── */}
                        <span className="lobby-game-code-label">{game.gameId}</span>

                        {/* ── Remove button — stops propagation so card doesn't activate ── */}
                        <button
                          className="lobby-game-remove"
                          onClick={e => { e.stopPropagation(); removeSavedGame(game.gameId); }}
                          title="Remove"
                          aria-label="Remove"
                        >×</button>
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
