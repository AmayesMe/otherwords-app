import './Board.css';
import { Cell } from '../Cell/Cell';
import { isCenterCell } from '../../game/boardUtils';
import type { BoardState } from '../../game/types';

interface BoardProps {
  board: BoardState;
}

export function Board({ board }: BoardProps) {
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
          />
        ))
      )}
    </div>
  );
}
