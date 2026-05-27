import './Board.css';
import { Cell } from '../Cell/Cell';
import { isCenterCell } from '../../game/boardUtils';
import type { BoardState } from '../../game/types';

interface BoardProps {
  board: BoardState;
  currentTurnCells?: Set<string>;
}

export function Board({ board, currentTurnCells = new Set() }: BoardProps) {
  return (
    <div className="board">
      {board.map((row, rowIndex) =>
        row.map((cell, colIndex) => (
          <Cell
            key={`${colIndex},${rowIndex}`}
            state={cell}
            col={colIndex}
            row={rowIndex}
            isCenter={isCenterCell(colIndex, rowIndex)}
            isCurrentTurnTile={currentTurnCells.has(`${colIndex},${rowIndex}`)}
          />
        ))
      )}
    </div>
  );
}
