import './App.css';
import { useMemo, useState, useEffect, useRef } from 'react';
import { Board } from './components/Board/Board';
import { Rack } from './components/Rack/Rack';
import { LetterPicker } from './components/LetterPicker/LetterPicker';
import { Lobby } from './components/Lobby/Lobby';
import { Tile } from './components/Tile/Tile';
import { TurnReplayOverlay } from './components/TurnReplay/TurnReplayOverlay';
import { useGameStore } from './store/gameStore';
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
  const {
    screen,
    board,
    currentPlayer,
    player1Score,
    player2Score,
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
    pendingReplay,
    replayMode,
    watchReplay,
    dismissReplay,
    replayScore,
  } = useGameStore();

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

  if (screen === 'lobby') return <Lobby />;

  // Use real names; fall back to local myName for own slot, then neutral "Player N".
  // Never show "You" or "Opponent" — use the actual names people set.
  const p1Label = player1Name || (myRole === 'player1' ? myName : '') || 'Player 1';
  const p2Label = player2Name || (myRole === 'player2' ? myName : '') || 'Player 2';
  const myTurn  = isMyTurn();

  // Opponent's display name (used in replay banner/overlay)
  const opponentLabel = myRole === 'player1' ? p2Label : myRole === 'player2' ? p1Label : p2Label;

  // During replay, show the animated score rather than the held (pre-turn) store score
  const watching = replayMode === 'watching';
  const displayP1Score = watching && replayScore != null ? replayScore.player1 : player1Score;
  const displayP2Score = watching && replayScore != null ? replayScore.player2 : player2Score;

  return (
    <div className="app">
      {/*
        Score bar: 4-column grid
          [P1 label] [P1 tiles] [P2 tiles] [P2 label]
        The two tile columns are always the inner columns, so they stay
        centred regardless of how long either name is.
      */}
      <header className="score-bar">
        <span className={`score-label score-label-p1${currentPlayer === 'player1' ? ' score-label-active' : ''}`}>
          {p1Label}
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
          {p2Label}
        </span>
      </header>

      {/* Turn-status banner — always rendered when online so layout never shifts.
          Hidden during opponent-banner / replay-overlay; otherwise shows
          "Waiting for opponent", "Your turn", or the join-code message. */}
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

      {/* Opponent played banner — shown when they move while game screen is open */}
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

      <main className="board-area">
        <Board board={board} />
      </main>

      <footer className="rack-area">
        <Rack />
      </footer>

      <LetterPicker />

      {gameId && (
        <button className="back-btn" onClick={resetToLobby} title="Leave game">✕</button>
      )}

      {/* Replay overlay — full-screen animated board shown during replay */}
      {replayMode === 'watching' && pendingReplay && (
        <TurnReplayOverlay
          replay={pendingReplay}
          opponentName={opponentLabel}
          onDone={dismissReplay}
        />
      )}
    </div>
  );
}
