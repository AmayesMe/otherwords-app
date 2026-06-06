import './App.css';
import { useMemo, useState, useEffect, useRef } from 'react';
import { Board } from './components/Board/Board';
import { Rack } from './components/Rack/Rack';
import { LetterPicker } from './components/LetterPicker/LetterPicker';
import { Lobby } from './components/Lobby/Lobby';
import { Tile } from './components/Tile/Tile';
import { TurnReplayOverlay } from './components/TurnReplay/TurnReplayOverlay';
import { GameOverScreen } from './components/GameOver/GameOverScreen';
import { AuthScreen } from './components/Auth/AuthScreen';
import { useGameStore } from './store/gameStore';
import { useAuth } from './hooks/useAuth';
import { getDisplayName, hasDisplayName } from './lib/auth';
import { countScore } from './game/boardUtils';
import { extractNewWords, findConfiscatedCells } from './game/wordUtils';
import type { Player } from './game/types';

// Two digits normally; three once a player reaches 100.
function scoreDigits(n: number): string[] {
  const s = Math.min(Math.max(n, 0), 999);
  if (s >= 100) {
    return [String(Math.floor(s / 100)), String(Math.floor((s % 100) / 10)), String(s % 10)];
  }
  return [String(Math.floor(s / 10)), String(s % 10)];
}

// ms: halfway point when digit content swaps (tile is edge-on / invisible)
const SCORE_FOLD_HALF  = 50;
// ms: full fold cycle + small gap before the next digit steps
const SCORE_FOLD_TOTAL = 115;

/** Which left-to-right digit indices visually change when score steps from→to. */
function getFlippingIndices(from: number, to: number): Set<number> {
  const a = scoreDigits(from);
  const b = scoreDigits(to);
  const result = new Set<number>();
  if (a.length !== b.length) {
    // All digits change when the digit count changes (e.g. 99 → 100)
    for (let i = 0; i < b.length; i++) result.add(i);
  } else {
    for (let i = 0; i < b.length; i++) {
      if (a[i] !== b[i]) result.add(i);
    }
  }
  return result;
}

interface DigitColProps {
  score: number;
  projected: number | null;
  owner: Player;
}

/**
 * Animated score column: counts up/down one digit at a time toward the target
 * score, flipping each changing digit tile like a physical split-flap display.
 */
function AnimatedDigitCol({ score, projected, owner }: DigitColProps) {
  const [displayed, setDisplayed] = useState(score);
  const [flipping,  setFlipping]  = useState<Set<number>>(new Set());

  const displayedRef = useRef(score);
  const targetRef    = useRef(score);
  const animatingRef = useRef(false);
  const timersRef    = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Update target whenever score prop changes; kick off animation if idle
  useEffect(() => {
    targetRef.current = score;
    if (!animatingRef.current) tick();
  }, [score]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cancel all pending timers on unmount
  useEffect(() => () => { timersRef.current.forEach(clearTimeout); }, []);

  function tick() {
    const current = displayedRef.current;
    const target  = targetRef.current;
    if (current === target) { animatingRef.current = false; return; }

    animatingRef.current = true;
    const next = current < target ? current + 1 : current - 1;
    setFlipping(getFlippingIndices(current, next));

    // Mid-flip: tile is edge-on — swap digit content invisibly
    const t1 = setTimeout(() => {
      displayedRef.current = next;
      setDisplayed(next);
    }, SCORE_FOLD_HALF);

    // End of fold: clear animation class, then step again if needed
    const t2 = setTimeout(() => {
      setFlipping(new Set());
      tick();
    }, SCORE_FOLD_TOTAL);

    timersRef.current.push(t1, t2);
  }

  const actual = scoreDigits(displayed);
  const proj   = scoreDigits(projected ?? 0);

  return (
    <div className="score-digit-col">
      <div className="score-digits">
        {actual.map((d, i) => (
          <Tile key={`a${i}`} letter={d} owner={owner} isScoreFlipping={flipping.has(i)} />
        ))}
      </div>
      <div
        className="score-digits score-digits-proj"
        style={{ visibility: projected !== null ? 'visible' : 'hidden' }}
      >
        {proj.map((d, i) => <Tile key={`p${i}`} letter={d} owner={owner} />)}
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading: authLoading } = useAuth();

  const {
    screen,
    board,
    currentPlayer,
    player1Score,
    player2Score,
    player1Rack,
    player2Rack,
    currentTurnPlacements,
    myRole,
    myName,
    gameId,
    player1Name,
    player2Name,
    isWaitingForOpponent,
    isMyTurn,
    syncError,
    resetToLobby,
    resign,
    pendingReplay,
    replayMode,
    watchReplay,
    dismissReplay,
    replayScore,
    gameOver,
  } = useGameStore();

  const [showResignConfirm, setShowResignConfirm] = useState(false);

  // Sync authenticated user's display name into the game store
  useEffect(() => {
    if (user) {
      const name = getDisplayName(user);
      if (name && name !== myName) {
        useGameStore.setState({ myName: name });
      }
    }
  }, [user, myName]);

  const projectedScore = useMemo(() => {
    if (Object.keys(currentTurnPlacements).length === 0) return null;
    const newWords = extractNewWords(board, currentTurnPlacements);
    const confiscated = findConfiscatedCells(board, currentTurnPlacements, newWords);
    const projBoard = board.map(r => r.map(c => ({ ...c })));
    for (const { col, row } of confiscated) {
      const cell = projBoard[row][col];
      if (cell.tile && cell.tile.owner !== currentPlayer) {
        projBoard[row][col] = { ...cell, tile: { ...cell.tile, owner: currentPlayer } };
      }
    }
    return countScore(projBoard);
  }, [board, currentTurnPlacements, currentPlayer]);

  // ── Auth gate ────────────────────────────────────────────────────────────
  // Show nothing while the session resolves (avoids auth-screen flash on load)
  if (authLoading) return <div className="auth-loading" />;

  // Not signed in → auth screen
  if (!user) return <AuthScreen />;

  // Signed in but no display name yet (e.g. after Google OAuth) → name prompt
  if (!hasDisplayName(user)) return <AuthScreen initialView="set-name" />;

  // ─────────────────────────────────────────────────────────────────────────

  if (screen === 'lobby') return <Lobby />;

  // Use real names; fall back to local myName for own slot, then neutral "Player N".
  // Never show "You" or "Opponent" — use the actual names people set.
  const p1Label = player1Name || (myRole === 'player1' ? myName : '') || 'Player 1';
  const p2Label = player2Name || (myRole === 'player2' ? myName : '') || 'Player 2';
  const myTurn  = isMyTurn();

  // Opponent's display name (used in replay banner/overlay)
  const opponentLabel = myRole === 'player1' ? p2Label : myRole === 'player2' ? p1Label : p2Label;

  // Opponent tile count — only shown in online mode (local = pass-and-play, both visible)
  const opponentTileCount = (gameId && myRole)
    ? (myRole === 'player1' ? player2Rack : player1Rack).filter(s => s !== null).length
    : null;

  // During replay, show the animated score rather than the held (pre-turn) store score
  const watching = replayMode === 'watching';
  const displayP1Score = watching && replayScore != null ? replayScore.player1 : player1Score;
  const displayP2Score = watching && replayScore != null ? replayScore.player2 : player2Score;

  return (
    <div className="app">
      {/*
        Single DOM structure used for both portrait and landscape.

        Portrait (.app flex-column):
          .landscape-panel → display:contents (invisible wrapper, children
          flow directly into .app's column flex context as if it doesn't exist)
          Order: score-bar → banners → [board-area] → rack-area

        Landscape (.app flex-row, min-aspect-ratio 4/3):
          .landscape-panel → display:flex column (left column)
          .board-area → right column, height 100dvh, board is hero
          The rack-area inside landscape-panel replaces portrait's rack-area.
      */}

      {/* ── Left panel — transparent in portrait, column in landscape ────────── */}
      <div className="landscape-panel">

        {/* Score bar */}
        <header className="score-bar">
          <span className={`score-label score-label-p1${currentPlayer === 'player1' ? ' score-label-active' : ''}`}>
            <span className="score-label-name">{p1Label}</span>
            {opponentTileCount !== null && myRole === 'player2' && (
              <span className="score-tile-count">{opponentTileCount} tiles</span>
            )}
          </span>

          <AnimatedDigitCol
            score={displayP1Score}
            projected={watching ? null : (projectedScore?.player1 ?? null)}
            owner="player1"
          />

          <AnimatedDigitCol
            score={displayP2Score}
            projected={watching ? null : (projectedScore?.player2 ?? null)}
            owner="player2"
          />

          <span className={`score-label score-label-p2${currentPlayer === 'player2' ? ' score-label-active' : ''}`}>
            <span className="score-label-name">{p2Label}</span>
            {opponentTileCount !== null && myRole === 'player1' && (
              <span className="score-tile-count">{opponentTileCount} tiles</span>
            )}
          </span>
        </header>

        {/* Turn-status banner */}
        {gameId && (
          <div
            className="waiting-banner"
            style={{ visibility: (replayMode === 'banner' || replayMode === 'watching') ? 'hidden' : 'visible' }}
          >
            {isWaitingForOpponent
              ? <>Waiting for opponent — code: <strong>{gameId}</strong></>
              : myTurn
              ? 'Your turn'
              : 'Waiting for opponent…'
            }
          </div>
        )}

        {/* Opponent-played banner */}
        {replayMode === 'banner' && pendingReplay && (
          <div className="opponent-banner">
            <span className="opponent-banner-text">
              {opponentLabel} played their turn
            </span>
            <div className="opponent-banner-actions">
              <button className="opponent-banner-btn" onClick={watchReplay}>Watch their play</button>
              <button className="opponent-banner-skip" onClick={dismissReplay}>Play now</button>
            </div>
          </div>
        )}

        {syncError && (
          <div className="sync-error">{syncError}</div>
        )}

        {/* Rack — in landscape this is in the left panel; in portrait this
            flows between the board and nothing (but .rack-area-portrait below
            is what actually shows in portrait — this one is hidden by CSS) */}
        <footer className="rack-area rack-area-panel">
          <Rack />
        </footer>

      </div>{/* end .landscape-panel */}

      {/* ── Board — always present; right column in landscape ────────────────── */}
      <main className="board-area">
        <Board board={board} />
      </main>

      {/* ── Portrait rack — shown only in portrait, hidden in landscape ───────── */}
      <footer className="rack-area rack-area-portrait">
        <Rack />
      </footer>

      <LetterPicker />

      {/* Back/resign button */}
      {showResignConfirm ? (
        <div className="resign-confirm">
          <span className="resign-confirm-text">{gameId ? 'Resign?' : 'Leave game?'}</span>
          <button
            className="resign-confirm-yes"
            onClick={() => { setShowResignConfirm(false); gameId ? resign() : resetToLobby(); }}
          >
            {gameId ? 'Resign' : 'Leave'}
          </button>
          <button className="resign-confirm-cancel" onClick={() => setShowResignConfirm(false)}>Cancel</button>
        </div>
      ) : (
        <button
          className="back-btn"
          onClick={() => setShowResignConfirm(true)}
          title={gameId ? 'Resign / leave game' : 'Leave game'}
        >✕</button>
      )}

      {/* Replay overlay */}
      {replayMode === 'watching' && pendingReplay && (
        <TurnReplayOverlay
          replay={pendingReplay}
          opponentName={opponentLabel}
          onDone={dismissReplay}
        />
      )}

      {/* Game over screen */}
      {gameOver && <GameOverScreen gameOver={gameOver} />}
    </div>
  );
}
