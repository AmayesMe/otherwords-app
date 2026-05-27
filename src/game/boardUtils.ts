import { BOARD_WIDTH, BOARD_HEIGHT, BONUS_SPACES, CENTER_COL, CENTER_ROW } from './config';
import type { BoardState, CellState } from './types';

export function createEmptyBoard(): BoardState {
  const bonusMap = new Map<string, 1 | 2 | 3>();
  for (const bs of BONUS_SPACES) {
    bonusMap.set(`${bs.col},${bs.row}`, bs.bonus);
  }
  return Array.from({ length: BOARD_HEIGHT }, (_, row) =>
    Array.from({ length: BOARD_WIDTH }, (_, col): CellState => ({
      tile: null,
      bonus: bonusMap.get(`${col},${row}`) ?? null,
      bonusUsed: false,
    }))
  );
}

export function isCenterCell(col: number, row: number): boolean {
  return col === CENTER_COL && row === CENTER_ROW;
}

export function countScore(board: BoardState): { player1: number; player2: number } {
  let player1 = 0;
  let player2 = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell.tile?.owner === 'player1') player1++;
      else if (cell.tile?.owner === 'player2') player2++;
    }
  }
  return { player1, player2 };
}
