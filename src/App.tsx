import './App.css';
import { useMemo } from 'react';
import { Board } from './components/Board/Board';
import { Rack } from './components/Rack/Rack';
import { LetterPicker } from './components/LetterPicker/LetterPicker';
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

  // Digit column: actual score on top, projected (half-size) centred beneath.
  // The projected row is always rendered (visibility toggled) to hold layout height.
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
    board,
    currentPlayer,
    player1Score,
    player2Score,
    currentTurnPlacements,
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

  return (
    <div className="app">
      <header className="score-bar">
        <ScoreGroup
          score={player1Score}
          projected={projectedScore?.player1 ?? null}
          owner="player1"
          label="Player 1"
          labelSide="left"
          isActive={currentPlayer === 'player1'}
        />
        <ScoreGroup
          score={player2Score}
          projected={projectedScore?.player2 ?? null}
          owner="player2"
          label="Player 2"
          labelSide="right"
          isActive={currentPlayer === 'player2'}
        />
      </header>

      <main className="board-area">
        <Board board={board} />
      </main>

      <footer className="rack-area">
        <Rack />
      </footer>

      <LetterPicker />
    </div>
  );
}
