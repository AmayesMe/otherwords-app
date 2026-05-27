import type { BoardState } from './types';
import type { PlacedThisTurn } from '../store/gameStore';
import { BOARD_WIDTH, BOARD_HEIGHT } from './config';

export interface BoardWord {
  letters: string;  // lowercase; '?' for unassigned wild tiles
  containsWild: boolean;
  cells: Array<{ col: number; row: number }>;
  // Span metadata (used for confiscation detection)
  direction: 'h' | 'v';
  cross: number;   // row index (h) or col index (v)
  start: number;   // col (h) or row (v) of first tile — inclusive
  end: number;     // col (h) or row (v) of last  tile — inclusive
}

/**
 * Finds every horizontal and vertical run of 2+ tiles on the board that
 * includes at least one tile placed this turn. Only newly-touched words are
 * returned — pre-existing words that weren't modified are left alone.
 */
export function extractNewWords(
  board: BoardState,
  placements: Record<string, PlacedThisTurn>
): BoardWord[] {
  const placementSet = new Set(Object.keys(placements));
  const words: BoardWord[] = [];

  // ── Horizontal ──────────────────────────────────────────────────────────
  for (let row = 0; row < BOARD_HEIGHT; row++) {
    let letters = '';
    let hasNewTile = false;
    let containsWild = false;
    let cells: Array<{ col: number; row: number }> = [];
    let runStart = -1;

    for (let col = 0; col <= BOARD_WIDTH; col++) {
      const cell = col < BOARD_WIDTH ? board[row][col] : null;
      if (cell?.tile) {
        if (runStart === -1) runStart = col;
        if (cell.tile.isWild) {
          if (cell.tile.wildLetter) {
            letters += cell.tile.wildLetter.toLowerCase();
          } else {
            letters += '?';
            containsWild = true;
          }
        } else {
          letters += cell.tile.letter.toLowerCase();
        }
        if (placementSet.has(`${col},${row}`)) hasNewTile = true;
        cells.push({ col, row });
      } else {
        if (letters.length >= 2 && hasNewTile) {
          words.push({ letters, containsWild, cells, direction: 'h', cross: row, start: runStart, end: col - 1 });
        }
        letters = ''; hasNewTile = false; containsWild = false; cells = []; runStart = -1;
      }
    }
  }

  // ── Vertical ────────────────────────────────────────────────────────────
  for (let col = 0; col < BOARD_WIDTH; col++) {
    let letters = '';
    let hasNewTile = false;
    let containsWild = false;
    let cells: Array<{ col: number; row: number }> = [];
    let runStart = -1;

    for (let row = 0; row <= BOARD_HEIGHT; row++) {
      const cell = row < BOARD_HEIGHT ? board[row][col] : null;
      if (cell?.tile) {
        if (runStart === -1) runStart = row;
        if (cell.tile.isWild) {
          if (cell.tile.wildLetter) {
            letters += cell.tile.wildLetter.toLowerCase();
          } else {
            letters += '?';
            containsWild = true;
          }
        } else {
          letters += cell.tile.letter.toLowerCase();
        }
        if (placementSet.has(`${col},${row}`)) hasNewTile = true;
        cells.push({ col, row });
      } else {
        if (letters.length >= 2 && hasNewTile) {
          words.push({ letters, containsWild, cells, direction: 'v', cross: col, start: runStart, end: row - 1 });
        }
        letters = ''; hasNewTile = false; containsWild = false; cells = []; runStart = -1;
      }
    }
  }

  return words;
}

/**
 * Returns the cells that should be confiscated (flipped to the current
 * player's color) based on the extension/confiscation rule.
 *
 * Confiscation triggers when a word in the after-board is LONGER than any
 * pre-existing word in the same row/column — i.e., at least one letter was
 * added to either end of an existing word. Crossing through a word in the
 * perpendicular direction does NOT trigger confiscation. Neither does a
 * pure letter-replacement (same span, different letter).
 */
export function findConfiscatedCells(
  board: BoardState,
  placements: Record<string, PlacedThisTurn>,
  newWords: BoardWord[]
): Array<{ col: number; row: number }> {
  // ── Reconstruct the before-board by reverting this turn's placements ────
  const before = board.map(r => r.map(c => ({ ...c })));
  for (const [key, p] of Object.entries(placements)) {
    const [col, row] = key.split(',').map(Number);
    before[row][col] = { ...before[row][col], tile: p.replacedTile };
  }

  // ── Find all 2+-tile word spans in the before-board ─────────────────────
  type Span = { direction: 'h' | 'v'; cross: number; start: number; end: number };
  const beforeSpans: Span[] = [];

  for (let row = 0; row < BOARD_HEIGHT; row++) {
    let runStart = -1;
    for (let col = 0; col <= BOARD_WIDTH; col++) {
      const hasTile = col < BOARD_WIDTH && before[row][col].tile !== null;
      if (hasTile) {
        if (runStart === -1) runStart = col;
      } else {
        if (runStart !== -1 && col - runStart >= 2) {
          beforeSpans.push({ direction: 'h', cross: row, start: runStart, end: col - 1 });
        }
        runStart = -1;
      }
    }
  }

  for (let col = 0; col < BOARD_WIDTH; col++) {
    let runStart = -1;
    for (let row = 0; row <= BOARD_HEIGHT; row++) {
      const hasTile = row < BOARD_HEIGHT && before[row][col].tile !== null;
      if (hasTile) {
        if (runStart === -1) runStart = row;
      } else {
        if (runStart !== -1 && row - runStart >= 2) {
          beforeSpans.push({ direction: 'v', cross: col, start: runStart, end: row - 1 });
        }
        runStart = -1;
      }
    }
  }

  // ── For each new word, check if it is an extension of a before-word ─────
  // A before-word B is "extended by" a new word W when:
  //   • same direction and same cross-axis value
  //   • B's span is entirely within W's span (B.start >= W.start && B.end <= W.end)
  //   • B's span is a PROPER subset (W is longer at at least one end)
  // This distinguishes extension from pure letter-replacement (same span).
  const confiscatedCells: Array<{ col: number; row: number }> = [];
  const seenKeys = new Set<string>();

  for (const word of newWords) {
    const isExtension = beforeSpans.some(
      b =>
        b.direction === word.direction &&
        b.cross === word.cross &&
        b.start >= word.start &&
        b.end <= word.end &&
        (b.start > word.start || b.end < word.end) // proper subset → W is longer
    );

    if (isExtension) {
      for (const cell of word.cells) {
        const key = `${cell.col},${cell.row}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          confiscatedCells.push(cell);
        }
      }
    }
  }

  return confiscatedCells;
}
