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

export interface Puzzle {
  id: string;
  clue: string;        // full clue phrase for display
  clueWords: string[]; // words split from clue (original case, preserves duplicates)
  answer: string;      // correct answer (compared case-insensitively)
}
