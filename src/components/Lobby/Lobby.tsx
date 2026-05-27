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
  opponentName: string;
  turnCount: number;
}

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

async function fetchGameInfo(game: SavedGame): Promise<GameInfo> {
  const data = await getGame(game.gameId);
  if (!data) return { kind: 'not-found', myScore: 0, theirScore: 0, opponentName: '', turnCount: 0 };
  const isP1 = game.role === 'player1';
  const myScore    = isP1 ? data.state.player1Score : data.state.player2Score;
  const theirScore = isP1 ? data.state.player2Score : data.state.player1Score;
  const opponentName = isP1 ? (data.state.player2Name ?? '') : (data.state.player1Name ?? '');
  let kind: GameStatusKind;
  if (!data.player2_joined) kind = 'waiting';
  else if (data.state.currentPlayer === game.role) kind = 'your-turn';
  else kind = 'their-turn';
  return { kind, myScore, theirScore, opponentName, turnCount: data.state.turnCount };
}

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

  const [mode, setMode] = useState<Mode>('menu');
  const [gameCode, setGameCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gameInfos, setGameInfos] = useState<Record<string, GameInfo>>({});
  const [copied, setCopied] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus join input when that screen appears
  useEffect(() => {
    if (mode === 'joining') inputRef.current?.focus();
  }, [mode]);

  // Fetch statuses + scores whenever the menu is shown
  useEffect(() => {
    if (mode !== 'menu' || savedGames.length === 0) return;
    setGameInfos(
      Object.fromEntries(
        savedGames.map(g => [g.gameId, { kind: 'loading' as GameStatusKind, myScore: 0, theirScore: 0, opponentName: '', turnCount: 0 }])
      )
    );
    savedGames.forEach(game => {
      fetchGameInfo(game).then(info => {
        setGameInfos(prev => ({ ...prev, [game.gameId]: info }));
      });
    });
  }, [mode, savedGames]);

  // If store enters waiting-for-opponent (e.g. after resuming an unstarted game),
  // switch to the waiting screen automatically.
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

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(gameCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available — silent fail
    }
  }

  async function handleResume(game: SavedGame) {
    setResumingId(game.gameId);
    setError(null);
    try {
      await resumeGame(game.gameId, game.role as Player);
      // Active game → screen becomes 'playing', Lobby unmounts.
      // Unstarted game → isWaitingForOpponent effect fires, sets mode 'waiting'.
    } catch (e) {
      setError((e as Error).message ?? 'Could not resume game.');
      setGameInfos(prev => ({ ...prev, [game.gameId]: { ...prev[game.gameId], kind: 'not-found' } }));
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
                    const info = gameInfos[game.gameId];
                    const kind: GameStatusKind = info?.kind ?? 'loading';
                    const isResuming = resumingId === game.gameId;
                    const showScore  = info && info.turnCount > 0 && kind !== 'not-found';
                    const showVs     = info?.opponentName;
                    return (
                      <div key={game.gameId} className="lobby-game-row">
                        <div className="lobby-game-left">
                          <span className="lobby-game-id">{game.gameId}</span>
                          <div className="lobby-game-sub">
                            <span className={statusClass(kind)}>{statusLabel(kind)}</span>
                            {showScore && (
                              <>
                                <span className="lobby-game-sep">·</span>
                                <span className="lobby-game-score">{info.myScore}–{info.theirScore}</span>
                              </>
                            )}
                            {showVs && (
                              <>
                                <span className="lobby-game-sep">·</span>
                                <span className="lobby-game-vs">vs {info.opponentName}</span>
                              </>
                            )}
                          </div>
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
                            title="Remove from list"
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
                <button
                  className="lobby-btn lobby-btn-primary"
                  onClick={startPlayingNow}
                >
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
