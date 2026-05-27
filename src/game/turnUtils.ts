import type { BoardState } from './types';
import type { PlacedThisTurn } from '../store/gameStore';
import { CENTER_COL, CENTER_ROW, BOARD_WIDTH, BOARD_HEIGHT } from './config';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// BFS connectivity check — returns true if all tiles in the set are reachable from any one of them
function isConnected(tileSet: Set<string>): boolean {
  if (tileSet.size <= 1) return true;
  const visited = new Set<string>();
  const start = tileSet.values().next().value!;
  const queue = [start];
  visited.add(start);
  while (queue.length > 0) {
    const key = queue.shift()!;
    const [col, row] = key.split(',').map(Number);
    for (const [nc, nr] of [[col - 1, row], [col + 1, row], [col, row - 1], [col, row + 1]]) {
      const nkey = `${nc},${nr}`;
      if (tileSet.has(nkey) && !visited.has(nkey)) {
        visited.add(nkey);
        queue.push(nkey);
      }
    }
  }
  return visited.size === tileSet.size;
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

  // Build the full tile set as it looks right now (board already contains placed tiles)
  const tileSet = new Set<string>();
  for (let r = 0; r < BOARD_HEIGHT; r++) {
    for (let c = 0; c < BOARD_WIDTH; c++) {
      if (board[r][c].tile) tileSet.add(`${c},${r}`);
    }
  }

  // After first turn: at least one placed tile must touch a pre-existing tile
  if (!isFirstTurn) {
    const placementSet = new Set(keys);
    const connectsToExisting = keys.some(key => {
      const [col, row] = key.split(',').map(Number);
      return [[col - 1, row], [col + 1, row], [col, row - 1], [col, row + 1]].some(([nc, nr]) => {
        return tileSet.has(`${nc},${nr}`) && !placementSet.has(`${nc},${nr}`);
      });
    });
    if (!connectsToExisting) {
      return { valid: false, error: 'Word must connect to tiles already on the board.' };
    }
  }

  // All tiles on the board must form one connected group — no isolated islands
  if (!isConnected(tileSet)) {
    return { valid: false, error: 'All tiles must be connected — no isolated words.' };
  }

  return { valid: true };
}
