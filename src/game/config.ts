import type { BonusValue } from './types';

export const BOARD_WIDTH = 13;
export const BOARD_HEIGHT = 13;
export const CENTER_COL = 6;
export const CENTER_ROW = 6;
export const STARTING_RACK_SIZE = 7;
export const BLANK_TILE_COUNT = 2;

export interface BonusSpaceConfig {
  col: number;
  row: number;
  bonus: BonusValue;
}

export const BONUS_SPACES: BonusSpaceConfig[] = [
  // Triple (+3) — four corners
  { col: 0,  row: 0,  bonus: 3 }, { col: 12, row: 0,  bonus: 3 },
  { col: 0,  row: 12, bonus: 3 }, { col: 12, row: 12, bonus: 3 },
  // Double (+2) — edges at positions 4 and 8
  { col: 4,  row: 0,  bonus: 2 }, { col: 8,  row: 0,  bonus: 2 },
  { col: 0,  row: 4,  bonus: 2 }, { col: 0,  row: 8,  bonus: 2 },
  { col: 12, row: 4,  bonus: 2 }, { col: 12, row: 8,  bonus: 2 },
  { col: 4,  row: 12, bonus: 2 }, { col: 8,  row: 12, bonus: 2 },
  // Single (+1) — interior (best estimate; tune via board editor)
  { col: 1,  row: 1,  bonus: 1 }, { col: 11, row: 1,  bonus: 1 },
  { col: 1,  row: 11, bonus: 1 }, { col: 11, row: 11, bonus: 1 },
  { col: 3,  row: 3,  bonus: 1 }, { col: 9,  row: 3,  bonus: 1 },
  { col: 3,  row: 9,  bonus: 1 }, { col: 9,  row: 9,  bonus: 1 },
  { col: 2,  row: 6,  bonus: 1 }, { col: 6,  row: 2,  bonus: 1 },
  { col: 10, row: 6,  bonus: 1 }, { col: 6,  row: 10, bonus: 1 },
  { col: 5,  row: 5,  bonus: 1 }, { col: 7,  row: 5,  bonus: 1 },
  { col: 5,  row: 7,  bonus: 1 }, { col: 7,  row: 7,  bonus: 1 },
];

export const TILE_DISTRIBUTION: Record<string, number> = {
  A: 9,  B: 2,  C: 2,  D: 4,  E: 12, F: 2,  G: 3,  H: 2,
  I: 9,  J: 1,  K: 1,  L: 4,  M: 2,  N: 6,  O: 8,  P: 2,
  Q: 1,  R: 6,  S: 4,  T: 6,  U: 4,  V: 2,  W: 2,  X: 1,
  Y: 2,  Z: 1,
};
