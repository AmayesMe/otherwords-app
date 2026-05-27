import './App.css';
import { Board } from './components/Board/Board';
import { Rack } from './components/Rack/Rack';
import { useGameStore } from './store/gameStore';
import { countScore } from './game/boardUtils';

export default function App() {
  const { board, currentPlayer } = useGameStore();
  const score = countScore(board);

  return (
    <div className="app">
      <header className="score-bar">
        <div className={`score-block score-left ${currentPlayer === 'player1' ? 'score-active' : ''}`}>
          <span className="player-label">Player 1</span>
          <span className="score-num">{score.player1}</span>
        </div>
        <span className="score-sep">vs</span>
        <div className={`score-block score-right ${currentPlayer === 'player2' ? 'score-active' : ''}`}>
          <span className="score-num">{score.player2}</span>
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
