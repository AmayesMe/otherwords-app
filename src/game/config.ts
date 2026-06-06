import type { BonusValue } from './types';

export const BOARD_WIDTH = 13;
export const BOARD_HEIGHT = 13;
export const CENTER_COL = 6;
export const CENTER_ROW = 6;
export const STARTING_RACK_SIZE = 7;
export const MAX_RACK_SIZE = 14;  // bonus tiles can push you up to 2× the starting size
export const BLANK_TILE_COUNT = 2;

export interface BonusSpaceConfig {
  col: number;
  row: number;
  bonus: BonusValue;
}

// Bonus positions extracted directly from Figma design (FgWK7wycaMUognXTB91vT7)
export const BONUS_SPACES: BonusSpaceConfig[] = [
  // Triple (+3) — four corners
  { col: 0,  row: 0,  bonus: 3 }, { col: 12, row: 0,  bonus: 3 },
  { col: 0,  row: 12, bonus: 3 }, { col: 12, row: 12, bonus: 3 },

  // Double (+2) — 8 positions
  { col: 6,  row: 0,  bonus: 2 },
  { col: 2,  row: 2,  bonus: 2 }, { col: 10, row: 2,  bonus: 2 },
  { col: 0,  row: 6,  bonus: 2 }, { col: 12, row: 6,  bonus: 2 },
  { col: 2,  row: 10, bonus: 2 }, { col: 10, row: 10, bonus: 2 },
  { col: 6,  row: 12, bonus: 2 },

  // Single (+1) — 16 positions
  { col: 4,  row: 1,  bonus: 1 }, { col: 8,  row: 1,  bonus: 1 },
  { col: 6,  row: 3,  bonus: 1 },
  { col: 1,  row: 4,  bonus: 1 }, { col: 4,  row: 4,  bonus: 1 },
  { col: 8,  row: 4,  bonus: 1 }, { col: 11, row: 4,  bonus: 1 },
  { col: 3,  row: 6,  bonus: 1 }, { col: 9,  row: 6,  bonus: 1 },
  { col: 1,  row: 8,  bonus: 1 }, { col: 4,  row: 8,  bonus: 1 },
  { col: 8,  row: 8,  bonus: 1 }, { col: 11, row: 8,  bonus: 1 },
  { col: 6,  row: 9,  bonus: 1 },
  { col: 4,  row: 11, bonus: 1 }, { col: 8,  row: 11, bonus: 1 },
];

export const TILE_DISTRIBUTION: Record<string, number> = {
  A: 9,  B: 2,  C: 2,  D: 4,  E: 12, F: 2,  G: 3,  H: 2,
  I: 9,  J: 1,  K: 1,  L: 4,  M: 2,  N: 6,  O: 8,  P: 2,
  Q: 1,  R: 6,  S: 4,  T: 6,  U: 4,  V: 2,  W: 2,  X: 1,
  Y: 2,  Z: 1,
};
