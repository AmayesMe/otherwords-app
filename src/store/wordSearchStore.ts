import { create } from 'zustand';
import { generateGrid, getUniqueHiddenWords, computeSelection, cellKey } from '../wordSearch/gridGenerator';
import { ALL_PUZZLES } from '../wordSearch/puzzles';
import { loadDictionary, isValidWord } from '../game/dictionary';
import type { CellCoord, Puzzle, PuzzleType, WordPlacement } from '../wordSearch/types';

loadDictionary();

export interface WordSearchOptions {
  allowBackward: boolean;
  gridSize: number;
  hintCost: number;
  selectionMode: 'block' | 'loop';
  soundEnabled: boolean;
  puzzleTypes: PuzzleType[];
}

export const DEFAULT_OPTIONS: WordSearchOptions = {
  allowBackward: false,
  gridSize: 10,
  hintCost: 10,
  selectionMode: 'loop',
  soundEnabled: true,
  puzzleTypes: ['crossword', 'chain'],
};

function pathKey(cells: CellCoord[]) {
  return cells.map(c => `${c.row},${c.col}`).join(':');
}

// Starts at 1000 pts, decays to 0 at 1200 seconds (20 min)
function computeTimeBonus(startTime: number | null): number {
  const elapsedSec = startTime ? (Date.now() - startTime) / 1000 : 0;
  return Math.max(0, Math.round(1000 * Math.max(0, 1 - elapsedSec / 1200)));
}

interface WordSearchState {
  puzzle: Puzzle | null;
  grid: string[][];
  placements: WordPlacement[];
  uniqueHiddenWords: string[];
  gridSize: number;
  options: WordSearchOptions;

  foundWordIndices: Set<number>;
  foundWordCells: Map<number, CellCoord[]>;
  revealedOriginalCells: Set<number>;
  bonusCells: Set<number>;
  lastSelectionResult: 'word' | 'bonus' | 'original' | 'nothing' | null;
  selectionCount: number;
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

  answerSubmitted: boolean;
  clueBonus: number | null;
  wordsRevealedAtAnswer: number;
  timeBonus: number | null;
  guessLockoutEnd: number | null;

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

function randomPuzzle(types: PuzzleType[]): Puzzle {
  const pool = ALL_PUZZLES.filter(p => types.includes(p.puzzleType));
  const source = pool.length > 0 ? pool : ALL_PUZZLES;
  return source[Math.floor(Math.random() * source.length)];
}

export const useWordSearchStore = create<WordSearchState>((set, get) => ({
  puzzle: null,
  grid: [],
  placements: [],
  uniqueHiddenWords: [],
  gridSize: DEFAULT_OPTIONS.gridSize,
  options: DEFAULT_OPTIONS,
  foundWordIndices: new Set(),
  foundWordCells: new Map(),
  revealedOriginalCells: new Set(),
  bonusCells: new Set(),
  lastSelectionResult: null,
  selectionCount: 0,
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
  answerSubmitted: false,
  clueBonus: null,
  wordsRevealedAtAnswer: 0,
  timeBonus: null,
  guessLockoutEnd: null,

  startPuzzle(puzzle, options) {
    const opts = options ?? get().options;
    const p = puzzle ?? randomPuzzle(opts.puzzleTypes);
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
      lastSelectionResult: null,
      selectionCount: 0,
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
      answerSubmitted: false,
      clueBonus: null,
      wordsRevealedAtAnswer: 0,
      timeBonus: null,
      guessLockoutEnd: null,
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
      options, bonusSelections, revealedOriginalCells, selectionCount,
      answerSubmitted, startTime,
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

    let clueMatchIndex = findMatchingPlacement(selectionCells, placements, newFoundWordIndices, allowBackward);

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
    let selectionResult: 'word' | 'bonus' | 'original' | 'nothing' = 'nothing';
    let originalFound = false;

    if (clueMatchIndex !== null) {
      newFoundWordIndices.add(clueMatchIndex);
      newFoundWordCells.set(clueMatchIndex, [...selectionCells]);
      if (!newFoundBonusPaths.has(key)) {
        earned += selectionCells.length;
        newFoundBonusPaths.add(key);
      }
      selectionResult = 'word';
    } else {
      for (const p of placements) {
        if (!newFoundWordIndices.has(p.wordIndex)) continue;
        const actual = newFoundWordCells.get(p.wordIndex);
        if (!actual) continue;
        const sameAsFwd = actual.length === p.cells.length &&
          p.cells.every((c, i) => c.row === actual[i].row && c.col === actual[i].col);
        const sameAsRev = actual.length === p.cells.length &&
          p.cells.every((c, i) => c.row === actual[actual.length - 1 - i].row && c.col === actual[actual.length - 1 - i].col);
        if (sameAsFwd || sameAsRev) continue;
        if (selectionCells.length !== p.cells.length) continue;
        const matchFwd = p.cells.every((c, i) => c.row === selectionCells[i].row && c.col === selectionCells[i].col);
        const matchRev = allowBackward && p.cells.every((c, i) =>
          c.row === selectionCells[selectionCells.length - 1 - i].row &&
          c.col === selectionCells[selectionCells.length - 1 - i].col);
        if (matchFwd || matchRev) {
          for (const c of p.cells) newRevealedOriginalCells.add(cellKey(c.row, c.col));
          originalFound = true;
        }
      }

      if (!newFoundBonusPaths.has(key) && selectionCells.length >= 3) {
        const dictWord = extracted.toLowerCase();
        const dictWordRev = allowBackward ? extractedRev.toLowerCase() : '';
        if (isValidWord(dictWord) || (allowBackward && isValidWord(dictWordRev))) {
          for (const c of selectionCells) newBonusCells.add(cellKey(c.row, c.col));
          earned += selectionCells.length;
          newFoundBonusPaths.add(key);
          newBonusSelections.push([...selectionCells]);
          selectionResult = 'bonus';
        }
      }

      if (selectionResult === 'nothing' && originalFound) selectionResult = 'original';
    }

    let winExtra: Partial<WordSearchState> = {};
    if (answerSubmitted && newFoundWordIndices.size >= uniqueHiddenWords.length) {
      winExtra = { gameWon: true, endTime: Date.now(), timeBonus: computeTimeBonus(startTime) };
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
      lastSelectionResult: selectionResult,
      selectionCount: selectionCount + 1,
      ...winExtra,
    });
  },

  buyHint() {
    const { bonusPoints, hintsUsed, hintedLetters, uniqueHiddenWords,
            foundWordIndices, options, answerSubmitted, startTime } = get();
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

    let winExtra: Partial<WordSearchState> = {};
    if (answerSubmitted && newFoundWordIndices.size >= uniqueHiddenWords.length) {
      winExtra = { gameWon: true, endTime: Date.now(), timeBonus: computeTimeBonus(startTime) };
    }

    set({ hintsUsed: hintsUsed + 1, hintedLetters: newHintedLetters,
          foundWordIndices: newFoundWordIndices, ...winExtra });
  },

  submitAnswer(answer) {
    const { puzzle, foundWordIndices, uniqueHiddenWords, startTime, guessLockoutEnd, answerSubmitted } = get();
    if (!puzzle || answerSubmitted) return;
    if (guessLockoutEnd !== null && Date.now() < guessLockoutEnd) return;

    const correct = answer.trim().toLowerCase() === puzzle.answer.trim().toLowerCase();
    if (correct) {
      const K = foundWordIndices.size;
      const N = uniqueHiddenWords.length;
      const clueBonus = N > 0 ? Math.round(1000 * (N - K) / N) : 0;
      if (K >= N) {
        set({ answerSubmitted: true, clueBonus, wordsRevealedAtAnswer: K,
              gameWon: true, endTime: Date.now(), timeBonus: computeTimeBonus(startTime) });
      } else {
        set({ answerSubmitted: true, clueBonus, wordsRevealedAtAnswer: K });
      }
    } else {
      const lockout = puzzle.puzzleType === 'crossword' ? Date.now() + 10000 : null;
      set({ answerError: true, guessLockoutEnd: lockout });
    }
  },

  clearError() {
    set({ answerError: false });
  },
}));
