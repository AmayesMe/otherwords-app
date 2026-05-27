import type { BoardState } from './types';
import type { PlacedThisTurn } from '../store/gameStore';
import { CENTER_COL, CENTER_ROW, BOARD_WIDTH, BOARD_HEIGHT } from './config';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validatePlacement(
  board: BoardState,
  placements: Record<string, PlacedThisTurn>,
  isFirstTurn: boolean
): ValidationResult {
  const keys = Object.keys(placements);

  if (keys.length === 0) {
    return { valid: false, error: 'Place at least one tile before ending your turn.' };
  }

  const positions = keys.map(k => {
    const [col, row] = k.split(',').map(Number);
    return { col, row };
  });

  // First turn must cover the center star
  if (isFirstTurn && !positions.some(p => p.col === CENTER_COL && p.row === CENTER_ROW)) {
    return { valid: false, error: 'First word must cover the center star.' };
  }

  // All tiles must be in the same row or column
  const sameRow = positions.every(p => p.row === positions[0].row);
  const sameCol = positions.every(p => p.col === positions[0].col);
  if (!sameRow && !sameCol) {
    return { valid: false, error: 'All tiles must be placed in the same row or column.' };
  }

  // No gaps allowed — every cell between first and last tile must be filled
  if (sameRow) {
    const r = positions[0].row;
    const cols = positions.map(p => p.col).sort((a, b) => a - b);
    for (let c = cols[0]; c <= cols[cols.length - 1]; c++) {
      if (!board[r][c].tile) {
        return { valid: false, error: 'Word must have no gaps between tiles.' };
      }
    }
  } else {
    const c = positions[0].col;
    const rows = positions.map(p => p.row).sort((a, b) => a - b);
    for (let r = rows[0]; r <= rows[rows.length - 1]; r++) {
      if (!board[r][c].tile) {
        return { valid: false, error: 'Word must have no gaps between tiles.' };
      }
    }
  }

  // After the first turn, word must connect to tiles already on the board
  if (!isFirstTurn) {
    const placementSet = new Set(keys);
    const connected = positions.some(({ col, row }) =>
      [[col - 1, row], [col + 1, row], [col, row - 1], [col, row + 1]].some(([nc, nr]) => {
        if (nc < 0 || nr < 0 || nc >= BOARD_WIDTH || nr >= BOARD_HEIGHT) return false;
        return board[nr][nc].tile !== null && !placementSet.has(`${nc},${nr}`);
      })
    );
    if (!connected) {
      return { valid: false, error: 'Word must connect to tiles already on the board.' };
    }
  }

  return { valid: true };
}
