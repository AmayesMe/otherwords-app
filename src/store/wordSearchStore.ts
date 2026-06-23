import { create } from 'zustand';
import { generateGrid, getUniqueHiddenWords, computeSelection, GRID_SIZE } from '../wordSearch/gridGenerator';
import { PUZZLES } from '../wordSearch/puzzles';
import type { CellCoord, Puzzle, WordPlacement } from '../wordSearch/types';

interface WordSearchState {
  puzzle: Puzzle | null;
  grid: string[][];
  placements: WordPlacement[];
  uniqueHiddenWords: string[];
  gridSize: number;

  // Set of wordIndex values that have been found
  foundWordIndices: Set<number>;

  // Active drag selection
  isSelecting: boolean;
  selectionStart: CellCoord | null;
  selectionCells: CellCoord[];

  // Flash state for wrong answer
  answerError: boolean;
  gameWon: boolean;

  // Actions
  startPuzzle: (puzzle?: Puzzle) => void;
  startSelecting: (row: number, col: number) => void;
  updateSelection: (row: number, col: number) => void;
  endSelection: () => void;
  submitAnswer: (answer: string) => void;
  clearError: () => void;
}

function findMatchingPlacement(
  selectedCells: CellCoord[],
  placements: WordPlacement[],
  foundWordIndices: Set<number>,
): number | null {
  for (const p of placements) {
    if (foundWordIndices.has(p.wordIndex)) continue;
    if (selectedCells.length !== p.cells.length) continue;

    const forward = p.cells.every(
      (c, i) => c.row === selectedCells[i].row && c.col === selectedCells[i].col,
    );
    if (forward) return p.wordIndex;

    const reverse = p.cells.every(
      (c, i) =>
        c.row === selectedCells[selectedCells.length - 1 - i].row &&
        c.col === selectedCells[selectedCells.length - 1 - i].col,
    );
    if (reverse) return p.wordIndex;
  }
  return null;
}

function randomPuzzle(): Puzzle {
  return PUZZLES[Math.floor(Math.random() * PUZZLES.length)];
}

export const useWordSearchStore = create<WordSearchState>((set, get) => ({
  puzzle: null,
  grid: [],
  placements: [],
  uniqueHiddenWords: [],
  gridSize: GRID_SIZE,
  foundWordIndices: new Set(),
  isSelecting: false,
  selectionStart: null,
  selectionCells: [],
  answerError: false,
  gameWon: false,

  startPuzzle(puzzle) {
    const p = puzzle ?? randomPuzzle();
    const uniqueHiddenWords = getUniqueHiddenWords(p.clueWords);
    const { grid, placements } = generateGrid(uniqueHiddenWords);
    set({
      puzzle: p,
      grid,
      placements,
      uniqueHiddenWords,
      gridSize: GRID_SIZE,
      foundWordIndices: new Set(),
      isSelecting: false,
      selectionStart: null,
      selectionCells: [],
      answerError: false,
      gameWon: false,
    });
  },

  startSelecting(row, col) {
    set({
      isSelecting: true,
      selectionStart: { row, col },
      selectionCells: [{ row, col }],
    });
  },

  updateSelection(row, col) {
    const { isSelecting, selectionStart } = get();
    if (!isSelecting || !selectionStart) return;
    const cells = computeSelection(selectionStart.row, selectionStart.col, row, col);
    set({ selectionCells: cells });
  },

  endSelection() {
    const { selectionCells, placements, foundWordIndices } = get();
    if (selectionCells.length < 2) {
      set({ isSelecting: false, selectionCells: [] });
      return;
    }

    const matchedIndex = findMatchingPlacement(selectionCells, placements, foundWordIndices);
    const newFound = new Set(foundWordIndices);
    if (matchedIndex !== null) newFound.add(matchedIndex);

    set({
      isSelecting: false,
      selectionCells: [],
      foundWordIndices: newFound,
    });
  },

  submitAnswer(answer) {
    const { puzzle } = get();
    if (!puzzle) return;
    const correct = answer.trim().toLowerCase() === puzzle.answer.trim().toLowerCase();
    if (correct) {
      set({ gameWon: true });
    } else {
      set({ answerError: true });
    }
  },

  clearError() {
    set({ answerError: false });
  },
}));
