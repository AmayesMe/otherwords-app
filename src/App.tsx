import './App.css';
import { useMemo } from 'react';
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

interface DigitColProps {
  score: number;
  projected: number | null;
  owner: Player;
}

function DigitCol({ score, projected, owner }: DigitColProps) {
  const actual = scoreDigits(score);
  const proj   = scoreDigits(projected ?? 0);
  return (
    <div className="score-digit-col">
      <div className="score-digits">
        {actual.map((d, i) => <Tile key={`a${i}`} letter={d} owner={owner} />)}
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

        <DigitCol
          score={player1Score}
          projected={projectedScore?.player1 ?? null}
          owner="player1"
        />

        <DigitCol
          score={player2Score}
          projected={projectedScore?.player2 ?? null}
          owner="player2"
        />

        <span className={`score-label score-label-p2${currentPlayer === 'player2' ? ' score-label-active' : ''}`}>
          {p2Label}
        </span>
      </header>

      {/* Waiting banners */}
      {gameId && isWaitingForOpponent && (
        <div className="waiting-banner">
          Waiting for opponent — code: <strong>{gameId}</strong>
        </div>
      )}
      {gameId && !isWaitingForOpponent && !myTurn && replayMode !== 'banner' && (
        <div className="waiting-banner">Waiting for opponent…</div>
      )}

      {/* Opponent played banner — shown when they move while game screen is open */}
      {replayMode === 'banner' && pendingReplay && (
        <div className="opponent-banner">
          <span className="opponent-banner-text">
            {opponentLabel} played their turn
          </span>
          <button className="opponent-banner-btn" onClick={watchReplay}>
            Watch their play
          </button>
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
