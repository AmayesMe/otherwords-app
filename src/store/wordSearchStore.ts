import { create } from 'zustand';
import { generateGrid, getUniqueHiddenWords, computeSelection, GRID_SIZE } from '../wordSearch/gridGenerator';
import { PUZZLES } from '../wordSearch/puzzles';
import { loadDictionary, isValidWord } from '../game/dictionary';
import type { CellCoord, Puzzle, WordPlacement } from '../wordSearch/types';

// Start loading the dictionary as soon as this module is imported
loadDictionary();

export const HINT_COST = 8;

function cellKey(row: number, col: number) {
  return row * GRID_SIZE + col;
}

function pathKey(cells: CellCoord[]) {
  return cells.map(c => `${c.row},${c.col}`).join(':');
}

export interface WordSearchOptions {
  allowBackward: boolean;
}

interface WordSearchState {
  puzzle: Puzzle | null;
  grid: string[][];
  placements: WordPlacement[];
  uniqueHiddenWords: string[];
  gridSize: number;
  options: WordSearchOptions;

  foundWordIndices: Set<number>;

  // Bonus word tracking
  bonusCells: Set<number>;
  foundBonusPaths: Set<string>;
  bonusPoints: number;

  // Hints
  hintsUsed: number;
  hintedLetters: Map<number, Set<number>>; // wordIndex → revealed letter positions

  // Active drag selection
  isSelecting: boolean;
  selectionStart: CellCoord | null;
  selectionCells: CellCoord[];

  answerError: boolean;
  gameWon: boolean;

  startPuzzle: (puzzle?: Puzzle, options?: WordSearchOptions) => void;
  startSelecting: (row: number, col: number) => void;
  updateSelection: (row: number, col: number) => void;
  endSelection: () => void;
  buyHint: () => void;
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
  options: { allowBackward: false },
  foundWordIndices: new Set(),
  bonusCells: new Set(),
  foundBonusPaths: new Set(),
  bonusPoints: 0,
  hintsUsed: 0,
  hintedLetters: new Map(),
  isSelecting: false,
  selectionStart: null,
  selectionCells: [],
  answerError: false,
  gameWon: false,

  startPuzzle(puzzle, options) {
    const p = puzzle ?? randomPuzzle();
    const opts = options ?? get().options;
    const uniqueHiddenWords = getUniqueHiddenWords(p.clueWords);
    const { grid, placements } = generateGrid(uniqueHiddenWords, opts.allowBackward);
    set({
      puzzle: p,
      options: opts,
      grid,
      placements,
      uniqueHiddenWords,
      gridSize: GRID_SIZE,
      foundWordIndices: new Set(),
      bonusCells: new Set(),
      foundBonusPaths: new Set(),
      bonusPoints: 0,
      hintsUsed: 0,
      hintedLetters: new Map(),
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
    const {
      selectionCells, placements, foundWordIndices,
      grid, bonusCells, foundBonusPaths, bonusPoints,
    } = get();

    if (selectionCells.length < 2) {
      set({ isSelecting: false, selectionCells: [] });
      return;
    }

    const key = pathKey(selectionCells);
    const newFoundWordIndices = new Set(foundWordIndices);
    const newBonusCells = new Set(bonusCells);
    const newFoundBonusPaths = new Set(foundBonusPaths);
    let earned = 0;

    const clueMatch = findMatchingPlacement(selectionCells, placements, foundWordIndices);

    if (clueMatch !== null) {
      newFoundWordIndices.add(clueMatch);
      // Award bonus for the clue word if this path hasn't been counted
      if (!newFoundBonusPaths.has(key)) {
        earned += selectionCells.length;
        newFoundBonusPaths.add(key);
      }
    } else {
      // Check dictionary for non-clue bonus words
      if (!newFoundBonusPaths.has(key)) {
        const word = selectionCells.map(c => grid[c.row][c.col]).join('').toLowerCase();
        if (isValidWord(word)) {
          for (const c of selectionCells) newBonusCells.add(cellKey(c.row, c.col));
          earned += selectionCells.length;
          newFoundBonusPaths.add(key);
        }
      }
    }

    set({
      isSelecting: false,
      selectionCells: [],
      foundWordIndices: newFoundWordIndices,
      bonusCells: newBonusCells,
      foundBonusPaths: newFoundBonusPaths,
      bonusPoints: bonusPoints + earned,
    });
  },

  buyHint() {
    const { bonusPoints, hintsUsed, hintedLetters, uniqueHiddenWords, foundWordIndices } = get();
    const available = bonusPoints - hintsUsed * HINT_COST;
    if (available < HINT_COST) return;

    // Collect all unhinted letter positions across unfound clue words
    const candidates: { wordIndex: number; letterIndex: number }[] = [];
    for (let wi = 0; wi < uniqueHiddenWords.length; wi++) {
      if (foundWordIndices.has(wi)) continue;
      const word = uniqueHiddenWords[wi];
      const hinted = hintedLetters.get(wi) ?? new Set<number>();
      for (let li = 0; li < word.length; li++) {
        if (!hinted.has(li)) candidates.push({ wordIndex: wi, letterIndex: li });
      }
    }

    if (candidates.length === 0) return;

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const newHintedLetters = new Map(hintedLetters);
    const existing = newHintedLetters.get(pick.wordIndex) ?? new Set<number>();
    newHintedLetters.set(pick.wordIndex, new Set([...existing, pick.letterIndex]));

    set({ hintsUsed: hintsUsed + 1, hintedLetters: newHintedLetters });
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
