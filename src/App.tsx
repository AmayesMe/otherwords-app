import { useState } from 'react';
import './App.css';
import { Board } from './components/Board/Board';
import { Rack } from './components/Rack/Rack';
import { createEmptyBoard } from './game/boardUtils';
import { countScore } from './game/boardUtils';
import type { BoardState, RackTile } from './game/types';

function createDemoBoard(): BoardState {
  const board = createEmptyBoard();
  // STIR across the center (row 6, cols 4–7)
  ['S', 'T', 'I', 'R'].forEach((l, i) => {
    board[6][4 + i].tile = { letter: l, owner: 'player1', isWild: false };
  });
  // HA down (col 5, rows 4–5), using the T of STIR at row 6
  ['H', 'A'].forEach((l, i) => {
    board[4 + i][5].tile = { letter: l, owner: 'player2', isWild: false };
  });
  return board;
}

const DEMO_RACK: RackTile[] = [
  { id: '1', letter: 'E', isWild: false },
  { id: '2', letter: 'N', isWild: false },
  { id: '3', letter: 'T', isWild: false },
  { id: '4', letter: 'A', isWild: false },
  { id: '5', letter: 'L', isWild: false },
  { id: '6', letter: 'O', isWild: false },
  { id: '7', letter: '', isWild: true  },
];

export default function App() {
  const [board] = useState<BoardState>(createDemoBoard);
  const score = countScore(board);

  return (
    <div className="app">
      <header className="score-bar">
        <div className="score-block score-left">
          <span className="player-label">Player 1</span>
          <span className="score-num">{score.player1}</span>
        </div>
        <span className="score-sep">vs</span>
        <div className="score-block score-right">
          <span className="score-num">{score.player2}</span>
          <span className="player-label">Player 2</span>
        </div>
      </header>

      <main className="board-area">
        <Board board={board} />
      </main>

      <footer className="rack-area">
        <Rack tiles={DEMO_RACK} player="player1" />
      </footer>
    </div>
  );
}
