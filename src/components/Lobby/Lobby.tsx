import './Lobby.css';
import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';

type Mode = 'menu' | 'creating' | 'waiting' | 'joining';

export function Lobby() {
  const { startLocalGame, createOnlineGame, joinOnlineGame, isWaitingForOpponent } = useGameStore();

  const [mode, setMode] = useState<Mode>('menu');
  const [gameCode, setGameCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // When joining sub-screen appears, focus the input
  useEffect(() => {
    if (mode === 'joining') inputRef.current?.focus();
  }, [mode]);

  // Transition to game when opponent joins (store switches screen)
  // This component unmounts automatically when screen → 'playing'

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

  return (
    <div className="lobby">
      <div className="lobby-card">
        <h1 className="lobby-title">Otherwords</h1>

        {/* ── Main menu ─────────────────────────────────────────────── */}
        {mode === 'menu' && (
          <div className="lobby-section">
            <p className="lobby-subtitle">A two-player word territory game</p>
            {error && <p className="lobby-error">{error}</p>}
            <div className="lobby-actions">
              <button className="lobby-btn lobby-btn-primary" onClick={handleCreate}>
                Create Game
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
              ? <p className="lobby-hint">Waiting for Player 2 to join…</p>
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
