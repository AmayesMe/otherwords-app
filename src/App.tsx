import './App.css';
import { useMemo } from 'react';
import { Board } from './components/Board/Board';
import { Rack } from './components/Rack/Rack';
import { useGameStore } from './store/gameStore';
import { countScore } from './game/boardUtils';
import { extractNewWords, findConfiscatedCells } from './game/wordUtils';

export default function App() {
  const {
    board,
    currentPlayer,
    player1Score,
    player2Score,
    currentTurnPlacements,
  } = useGameStore();

  // Projected score: what the board would look like if End Turn were pressed
  // right now (includes confiscation). Only computed while tiles are placed.
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

  return (
    <div className="app">
      <header className="score-bar">

        <div className={`score-block score-left ${currentPlayer === 'player1' ? 'score-active' : ''}`}>
          <span className="player-label">Player 1</span>
          <div className="score-num-group">
            <span className="score-num">{player1Score}</span>
            {projectedScore !== null && (
              <span className="score-chip score-chip-p1">{projectedScore.player1}</span>
            )}
          </div>
        </div>

        <span className="score-sep">vs</span>

        <div className={`score-block score-right ${currentPlayer === 'player2' ? 'score-active' : ''}`}>
          <div className="score-num-group">
            {projectedScore !== null && (
              <span className="score-chip score-chip-p2">{projectedScore.player2}</span>
            )}
            <span className="score-num">{player2Score}</span>
          </div>
          <span className="player-label">Player 2</span>
        </div>

      </header>

      <main className="board-area">
        <Board board={board} />
      </main>

      <footer className="rack-area">
        <Rack />
      </footer>
    </div>
  );
}
