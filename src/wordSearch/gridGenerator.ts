import type { CellCoord, WordPlacement } from './types';

const DIRECTIONS_ALL = [
  { stepRow: 0,  stepCol: 1  }, // right
  { stepRow: 0,  stepCol: -1 }, // left
  { stepRow: 1,  stepCol: 0  }, // down
  { stepRow: -1, stepCol: 0  }, // up
  { stepRow: 1,  stepCol: 1  }, // down-right
  { stepRow: 1,  stepCol: -1 }, // down-left
  { stepRow: -1, stepCol: 1  }, // up-right
  { stepRow: -1, stepCol: -1 }, // up-left
];

// Forward-only: left→right, top→bottom, and both forward diagonals
const DIRECTIONS_FORWARD = DIRECTIONS_ALL.filter(
  d => d.stepRow > 0 || (d.stepRow === 0 && d.stepCol > 0),
);

const FILL_LETTERS = 'ABCDEFGHIKLMNOPRSTUW';

export const DEFAULT_GRID_SIZE = 15;
export const MIN_GRID_SIZE = 10;
export const MAX_GRID_SIZE = 20;

function canPlace(
  grid: string[][],
  word: string,
  startRow: number,
  startCol: number,
  stepRow: number,
  stepCol: number,
  gridSize: number,
): boolean {
  for (let i = 0; i < word.length; i++) {
    const r = startRow + i * stepRow;
    const c = startCol + i * stepCol;
    if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) return false;
    if (grid[r][c] !== '' && grid[r][c] !== word[i]) return false;
  }
  return true;
}

function doPlace(
  grid: string[][],
  word: string,
  startRow: number,
  startCol: number,
  stepRow: number,
  stepCol: number,
): CellCoord[] {
  const cells: CellCoord[] = [];
  for (let i = 0; i < word.length; i++) {
    const r = startRow + i * stepRow;
    const c = startCol + i * stepCol;
    grid[r][c] = word[i];
    cells.push({ row: r, col: c });
  }
  return cells;
}

function startRange(step: number, wordLen: number, gridSize: number): [number, number] {
  if (step > 0) return [0, gridSize - wordLen];
  if (step < 0) return [wordLen - 1, gridSize - 1];
  return [0, gridSize - 1];
}

function rand(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function generateGrid(
  uniqueWords: string[],
  allowBackward = false,
  gridSize = DEFAULT_GRID_SIZE,
): { grid: string[][]; placements: WordPlacement[] } {
  const DIRECTIONS = allowBackward ? DIRECTIONS_ALL : DIRECTIONS_FORWARD;
  const grid: string[][] = Array.from({ length: gridSize }, () =>
    Array(gridSize).fill(''),
  );
  const placements: WordPlacement[] = [];

  for (let wordIndex = 0; wordIndex < uniqueWords.length; wordIndex++) {
    const word = uniqueWords[wordIndex].toUpperCase();
    let placed = false;

    const dirs = [...DIRECTIONS].sort(() => Math.random() - 0.5);

    for (const dir of dirs) {
      if (placed) break;
      const [minR, maxR] = startRange(dir.stepRow, word.length, gridSize);
      const [minC, maxC] = startRange(dir.stepCol, word.length, gridSize);
      if (maxR < minR || maxC < minC) continue;

      for (let attempt = 0; attempt < 30 && !placed; attempt++) {
        const r = rand(minR, maxR);
        const c = rand(minC, maxC);
        if (canPlace(grid, word, r, c, dir.stepRow, dir.stepCol, gridSize)) {
          const cells = doPlace(grid, word, r, c, dir.stepRow, dir.stepCol);
          placements.push({ word, wordIndex, startRow: r, startCol: c,
            stepRow: dir.stepRow, stepCol: dir.stepCol, cells });
          placed = true;
        }
      }
    }
  }

  // Fill empty cells with random letters
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (grid[r][c] === '') {
        grid[r][c] = FILL_LETTERS[Math.floor(Math.random() * FILL_LETTERS.length)];
      }
    }
  }

  return { grid, placements };
}

/** Extract words from a clue that are long enough to hide in the grid.
 *  Preserves duplicates so every clue-word occurrence gets its own grid placement. */
export function getUniqueHiddenWords(clueWords: string[]): string[] {
  const result: string[] = [];
  for (const w of clueWords) {
    const upper = w.toUpperCase().replace(/[^A-Z]/g, '');
    if (upper.length >= 3) result.push(upper);
  }
  return result;
}

/** Compute the selected cells from a start and current pointer position. */
export function computeSelection(
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  gridSize: number,
  allowBackward = true,
): CellCoord[] {
  const dr = endRow - startRow;
  const dc = endCol - startCol;

  if (dr === 0 && dc === 0) return [{ row: startRow, col: startCol }];

  const angle = Math.atan2(dr, dc);
  const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  const stepRow = Math.round(Math.sin(snapped));
  const stepC   = Math.round(Math.cos(snapped));

  // When backward is disabled, reject directions that go up or purely left
  if (!allowBackward) {
    const isForward = stepRow > 0 || (stepRow === 0 && stepC > 0);
    if (!isForward) return [{ row: startRow, col: startCol }];
  }

  const len = stepRow === 0 ? Math.abs(dc)
            : stepC === 0   ? Math.abs(dr)
            : Math.max(Math.abs(dr), Math.abs(dc));

  const cells: CellCoord[] = [];
  for (let i = 0; i <= len; i++) {
    const r = startRow + i * stepRow;
    const c = startCol + i * stepC;
    if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
      cells.push({ row: r, col: c });
    }
  }
  return cells;
}

// Cell key using a multiplier larger than MAX_GRID_SIZE to guarantee uniqueness
export function cellKey(row: number, col: number): number {
  return row * (MAX_GRID_SIZE + 1) + col;
}
