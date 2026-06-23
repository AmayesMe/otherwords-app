export interface CellCoord {
  row: number;
  col: number;
}

export interface WordPlacement {
  word: string;
  wordIndex: number;  // index into uniqueHiddenWords
  startRow: number;
  startCol: number;
  stepRow: number;    // -1, 0, or 1
  stepCol: number;    // -1, 0, or 1
  cells: CellCoord[];
}

export type PuzzleType = 'crossword' | 'chain';

export interface Puzzle {
  id: string;
  puzzleType: PuzzleType;
  clue: string;        // full clue phrase for display (crossword) or chain description
  clueWords: string[]; // words hidden in the grid (chain: all words except the answer)
  answer: string;      // correct answer (compared case-insensitively)
}
