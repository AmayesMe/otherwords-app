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

export const GRID_SIZE = 15;

function canPlace(
  grid: string[][],
  word: string,
  startRow: number,
  startCol: number,
  stepRow: number,
  stepCol: number,
): boolean {
  for (let i = 0; i < word.length; i++) {
    const r = startRow + i * stepRow;
    const c = startCol + i * stepCol;
    if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return false;
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

function startRange(step: number, wordLen: number): [number, number] {
  if (step > 0) return [0, GRID_SIZE - wordLen];
  if (step < 0) return [wordLen - 1, GRID_SIZE - 1];
  return [0, GRID_SIZE - 1];
}

function rand(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function generateGrid(uniqueWords: string[], allowBackward = false): {
  grid: string[][];
  placements: WordPlacement[];
} {
  const DIRECTIONS = allowBackward ? DIRECTIONS_ALL : DIRECTIONS_FORWARD;
  const grid: string[][] = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill(''),
  );
  const placements: WordPlacement[] = [];

  for (let wordIndex = 0; wordIndex < uniqueWords.length; wordIndex++) {
    const word = uniqueWords[wordIndex].toUpperCase();
    let placed = false;

    // Shuffle direction order per word for variety
    const dirs = [...DIRECTIONS].sort(() => Math.random() - 0.5);

    for (const dir of dirs) {
      if (placed) break;
      const [minR, maxR] = startRange(dir.stepRow, word.length);
      const [minC, maxC] = startRange(dir.stepCol, word.length);
      if (maxR < minR || maxC < minC) continue;

      // Try up to 30 random positions per direction
      for (let attempt = 0; attempt < 30 && !placed; attempt++) {
        const r = rand(minR, maxR);
        const c = rand(minC, maxC);
        if (canPlace(grid, word, r, c, dir.stepRow, dir.stepCol)) {
          const cells = doPlace(grid, word, r, c, dir.stepRow, dir.stepCol);
          placements.push({
            word,
            wordIndex,
            startRow: r,
            startCol: c,
            stepRow: dir.stepRow,
            stepCol: dir.stepCol,
            cells,
          });
          placed = true;
        }
      }
    }
    // If a word couldn't be placed after all attempts, it's skipped (rare edge case)
  }

  // Fill empty cells with random letters
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] === '') {
        grid[r][c] = FILL_LETTERS[Math.floor(Math.random() * FILL_LETTERS.length)];
      }
    }
  }

  return { grid, placements };
}

/** Extract unique words from a clue that are long enough to hide in the grid. */
export function getUniqueHiddenWords(clueWords: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const w of clueWords) {
    const upper = w.toUpperCase().replace(/[^A-Z]/g, '');
    if (upper.length >= 3 && !seen.has(upper)) {
      seen.add(upper);
      result.push(upper);
    }
  }
  return result;
}

/** Compute the selected cells from a start and current pointer position. */
export function computeSelection(
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
): CellCoord[] {
  const dr = endRow - startRow;
  const dc = endCol - startCol;

  if (dr === 0 && dc === 0) return [{ row: startRow, col: startCol }];

  // Snap drag angle to the nearest of 8 directions
  const angle = Math.atan2(dr, dc);
  const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  const stepRow = Math.round(Math.sin(snapped));
  const stepC   = Math.round(Math.cos(snapped));

  // Length along the snapped axis
  const len = stepRow === 0 ? Math.abs(dc)
            : stepC === 0   ? Math.abs(dr)
            : Math.max(Math.abs(dr), Math.abs(dc));

  const cells: CellCoord[] = [];
  for (let i = 0; i <= len; i++) {
    const r = startRow + i * stepRow;
    const c = startCol + i * stepC;
    if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
      cells.push({ row: r, col: c });
    }
  }
  return cells;
}
