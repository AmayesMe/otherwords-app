import { create } from 'zustand';
import { generateGrid, getUniqueHiddenWords, computeSelection, cellKey,
         DEFAULT_GRID_SIZE } from '../wordSearch/gridGenerator';
import { PUZZLES } from '../wordSearch/puzzles';
import { loadDictionary, isValidWord } from '../game/dictionary';
import type { CellCoord, Puzzle, WordPlacement } from '../wordSearch/types';

loadDictionary();

export interface WordSearchOptions {
  allowBackward: boolean;
  gridSize: number;
  hintCost: number;
  selectionMode: 'block' | 'loop';
}

export const DEFAULT_OPTIONS: WordSearchOptions = {
  allowBackward: false,
  gridSize: DEFAULT_GRID_SIZE,
  hintCost: 8,
  selectionMode: 'block',
};

function pathKey(cells: CellCoord[]) {
  return cells.map(c => `${c.row},${c.col}`).join(':');
}

interface WordSearchState {
  puzzle: Puzzle | null;
  grid: string[][];
  placements: WordPlacement[];
  uniqueHiddenWords: string[];
  gridSize: number;
  options: WordSearchOptions;

  foundWordIndices: Set<number>;
  foundWordCells: Map<number, CellCoord[]>;   // actual cells player selected when finding word wi
  revealedOriginalCells: Set<number>;          // cellKeys of original placements found after the fact
  bonusCells: Set<number>;
  foundBonusPaths: Set<string>;
  bonusPoints: number;
  hintsUsed: number;
  hintedLetters: Map<number, Set<number>>;
  bonusSelections: CellCoord[][];

  isSelecting: boolean;
  selectionStart: CellCoord | null;
  selectionCells: CellCoord[];

  startTime: number | null;
  endTime: number | null;

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
  allowBackward: boolean,
): number | null {
  for (const p of placements) {
    if (foundWordIndices.has(p.wordIndex)) continue;
    if (selectedCells.length !== p.cells.length) continue;
    const forward = p.cells.every(
      (c, i) => c.row === selectedCells[i].row && c.col === selectedCells[i].col,
    );
    if (forward) return p.wordIndex;
    if (allowBackward) {
      const reverse = p.cells.every(
        (c, i) =>
          c.row === selectedCells[selectedCells.length - 1 - i].row &&
          c.col === selectedCells[selectedCells.length - 1 - i].col,
      );
      if (reverse) return p.wordIndex;
    }
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
  gridSize: DEFAULT_GRID_SIZE,
  options: DEFAULT_OPTIONS,
  foundWordIndices: new Set(),
  foundWordCells: new Map(),
  revealedOriginalCells: new Set(),
  bonusCells: new Set(),
  foundBonusPaths: new Set(),
  bonusPoints: 0,
  hintsUsed: 0,
  hintedLetters: new Map(),
  bonusSelections: [],
  isSelecting: false,
  selectionStart: null,
  selectionCells: [],
  startTime: null,
  endTime: null,
  answerError: false,
  gameWon: false,

  startPuzzle(puzzle, options) {
    const p = puzzle ?? randomPuzzle();
    const opts = options ?? get().options;
    const uniqueHiddenWords = getUniqueHiddenWords(p.clueWords);
    const { grid, placements } = generateGrid(uniqueHiddenWords, opts.allowBackward, opts.gridSize);
    set({
      puzzle: p,
      options: opts,
      grid,
      placements,
      uniqueHiddenWords,
      gridSize: opts.gridSize,
      foundWordIndices: new Set(),
      foundWordCells: new Map(),
      revealedOriginalCells: new Set(),
      bonusCells: new Set(),
      foundBonusPaths: new Set(),
      bonusPoints: 0,
      hintsUsed: 0,
      hintedLetters: new Map(),
      bonusSelections: [],
      isSelecting: false,
      selectionStart: null,
      selectionCells: [],
      startTime: Date.now(),
      endTime: null,
      answerError: false,
      gameWon: false,
    });
  },

  startSelecting(row, col) {
    set({ isSelecting: true, selectionStart: { row, col }, selectionCells: [{ row, col }] });
  },

  updateSelection(row, col) {
    const { isSelecting, selectionStart, gridSize, options } = get();
    if (!isSelecting || !selectionStart) return;
    const cells = computeSelection(selectionStart.row, selectionStart.col, row, col, gridSize, options.allowBackward);
    set({ selectionCells: cells });
  },

  endSelection() {
    const {
      selectionCells, placements, foundWordIndices, foundWordCells,
      grid, uniqueHiddenWords, bonusCells, foundBonusPaths, bonusPoints,
      options, bonusSelections, revealedOriginalCells,
    } = get();

    if (selectionCells.length < 2) {
      set({ isSelecting: false, selectionCells: [] });
      return;
    }

    const { allowBackward } = options;
    const key = pathKey(selectionCells);
    const newFoundWordIndices = new Set(foundWordIndices);
    const newFoundWordCells = new Map(foundWordCells);
    const newBonusCells = new Set(bonusCells);
    const newFoundBonusPaths = new Set(foundBonusPaths);
    const newRevealedOriginalCells = new Set(revealedOriginalCells);
    let earned = 0;

    const extracted = selectionCells.map(c => grid[c.row][c.col]).join('');
    const extractedRev = allowBackward ? extracted.split('').reverse().join('') : '';

    // 1. Exact placement cell match
    let clueMatchIndex = findMatchingPlacement(selectionCells, placements, newFoundWordIndices, allowBackward);

    // 2. String match anywhere in grid
    if (clueMatchIndex === null) {
      for (let wi = 0; wi < uniqueHiddenWords.length; wi++) {
        if (newFoundWordIndices.has(wi)) continue;
        const matchFwd = extracted === uniqueHiddenWords[wi];
        const matchRev = allowBackward && extractedRev === uniqueHiddenWords[wi];
        if (matchFwd || matchRev) {
          clueMatchIndex = wi;
          break;
        }
      }
    }

    const newBonusSelections = [...bonusSelections];

    if (clueMatchIndex !== null) {
      newFoundWordIndices.add(clueMatchIndex);
      newFoundWordCells.set(clueMatchIndex, [...selectionCells]);
      if (!newFoundBonusPaths.has(key)) {
        earned += selectionCells.length;
        newFoundBonusPaths.add(key);
      }
    } else {
      // Check if this selection lands on the original placement of an already-found word
      // (found at a different location) — mark those cells as gray "also-found"
      for (const p of placements) {
        if (!newFoundWordIndices.has(p.wordIndex)) continue;
        const actual = newFoundWordCells.get(p.wordIndex);
        if (!actual) continue; // hint-revealed words don't need this treatment
        // Skip if the word was already found at its original location
        const sameAsFwd = actual.length === p.cells.length &&
          p.cells.every((c, i) => c.row === actual[i].row && c.col === actual[i].col);
        const sameAsRev = actual.length === p.cells.length &&
          p.cells.every((c, i) => c.row === actual[actual.length - 1 - i].row && c.col === actual[actual.length - 1 - i].col);
        if (sameAsFwd || sameAsRev) continue;
        // Check if current selection matches the original placement
        if (selectionCells.length !== p.cells.length) continue;
        const matchFwd = p.cells.every((c, i) => c.row === selectionCells[i].row && c.col === selectionCells[i].col);
        const matchRev = allowBackward && p.cells.every((c, i) =>
          c.row === selectionCells[selectionCells.length - 1 - i].row &&
          c.col === selectionCells[selectionCells.length - 1 - i].col);
        if (matchFwd || matchRev) {
          for (const c of p.cells) newRevealedOriginalCells.add(cellKey(c.row, c.col));
        }
      }

      if (!newFoundBonusPaths.has(key)) {
        const dictWord = extracted.toLowerCase();
        const dictWordRev = allowBackward ? extractedRev.toLowerCase() : '';
        if (isValidWord(dictWord) || (allowBackward && isValidWord(dictWordRev))) {
          for (const c of selectionCells) newBonusCells.add(cellKey(c.row, c.col));
          earned += selectionCells.length;
          newFoundBonusPaths.add(key);
          newBonusSelections.push([...selectionCells]);
        }
      }
    }

    set({
      isSelecting: false,
      selectionCells: [],
      foundWordIndices: newFoundWordIndices,
      foundWordCells: newFoundWordCells,
      revealedOriginalCells: newRevealedOriginalCells,
      bonusCells: newBonusCells,
      foundBonusPaths: newFoundBonusPaths,
      bonusPoints: bonusPoints + earned,
      bonusSelections: newBonusSelections,
    });
  },

  buyHint() {
    const { bonusPoints, hintsUsed, hintedLetters, uniqueHiddenWords,
            foundWordIndices, options } = get();
    const available = bonusPoints - hintsUsed * options.hintCost;
    if (available < options.hintCost) return;

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
    const allHinted = new Set([...existing, pick.letterIndex]);
    newHintedLetters.set(pick.wordIndex, allHinted);

    const newFoundWordIndices = new Set(foundWordIndices);
    if (allHinted.size === uniqueHiddenWords[pick.wordIndex].length) {
      newFoundWordIndices.add(pick.wordIndex);
    }

    set({ hintsUsed: hintsUsed + 1, hintedLetters: newHintedLetters,
          foundWordIndices: newFoundWordIndices });
  },

  submitAnswer(answer) {
    const { puzzle } = get();
    if (!puzzle) return;
    const correct = answer.trim().toLowerCase() === puzzle.answer.trim().toLowerCase();
    if (correct) set({ gameWon: true, endTime: Date.now() });
    else set({ answerError: true });
  },

  clearError() {
    set({ answerError: false });
  },
}));
