import './App.css';
import { useMemo } from 'react';
import { Board } from './components/Board/Board';
import { Rack } from './components/Rack/Rack';
import { LetterPicker } from './components/LetterPicker/LetterPicker';
import { Lobby } from './components/Lobby/Lobby';
import { Tile } from './components/Tile/Tile';
import { useGameStore } from './store/gameStore';
import { countScore } from './game/boardUtils';
import { extractNewWords, findConfiscatedCells } from './game/wordUtils';
import type { Player } from './game/types';

// Two digits normally; three digits once a player reaches 100.
function scoreDigits(n: number): string[] {
  const s = Math.min(Math.max(n, 0), 999);
  if (s >= 100) {
    return [String(Math.floor(s / 100)), String(Math.floor((s % 100) / 10)), String(s % 10)];
  }
  return [String(Math.floor(s / 10)), String(s % 10)];
}

interface ScoreGroupProps {
  score: number;
  projected: number | null;
  owner: Player;
  label: string;
  labelSide: 'left' | 'right';
  isActive: boolean;
}

function ScoreGroup({ score, projected, owner, label, labelSide, isActive }: ScoreGroupProps) {
  const actualDigits = scoreDigits(score);
  const projDigits   = scoreDigits(projected ?? 0);

  const nameTag = (
    <span className={`score-label ${isActive ? 'score-label-active' : ''}`}>{label}</span>
  );

  const digitCol = (
    <div className="score-digit-col">
      <div className="score-digits">
        {actualDigits.map((d, i) => <Tile key={`a${i}`} letter={d} owner={owner} />)}
      </div>
      <div
        className="score-digits score-digits-proj"
        style={{ visibility: projected !== null ? 'visible' : 'hidden' }}
      >
        {projDigits.map((d, i) => <Tile key={`p${i}`} letter={d} owner={owner} />)}
      </div>
    </div>
  );

  return (
    <div className="score-group">
      {labelSide === 'left' && nameTag}
      {digitCol}
      {labelSide === 'right' && nameTag}
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
    gameId,
    player1Name,
    player2Name,
    isWaitingForOpponent,
    isMyTurn,
    syncError,
    resetToLobby,
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

  // Show lobby when screen === 'lobby'
  if (screen === 'lobby') return <Lobby />;

  // Score bar labels: real names when available, otherwise context-aware fallbacks
  const p1Fallback = gameId ? (myRole === 'player1' ? 'You' : 'Opponent') : 'Player 1';
  const p2Fallback = gameId ? (myRole === 'player2' ? 'You' : 'Opponent') : 'Player 2';
  const p1Label = player1Name || p1Fallback;
  const p2Label = player2Name || p2Fallback;
  const myTurn = isMyTurn();

  return (
    <div className="app">
      <header className="score-bar">
        <ScoreGroup
          score={player1Score}
          projected={projectedScore?.player1 ?? null}
          owner="player1"
          label={p1Label}
          labelSide="left"
          isActive={currentPlayer === 'player1'}
        />
        <ScoreGroup
          score={player2Score}
          projected={projectedScore?.player2 ?? null}
          owner="player2"
          label={p2Label}
          labelSide="right"
          isActive={currentPlayer === 'player2'}
        />
      </header>

      {/* Waiting banners */}
      {gameId && isWaitingForOpponent && (
        <div className="waiting-banner">
          Waiting for opponent — code: <strong>{gameId}</strong>
        </div>
      )}
      {gameId && !isWaitingForOpponent && !myTurn && (
        <div className="waiting-banner">Waiting for opponent…</div>
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
    </div>
  );
}
