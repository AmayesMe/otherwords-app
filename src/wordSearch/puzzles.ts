import type { Puzzle } from './types';

function words(clue: string): string[] {
  return clue.split(/\s+/).filter(w => w.length > 0);
}

export const CROSSWORD_PUZZLES: Puzzle[] = [
  {
    id: 'dover',
    puzzleType: 'crossword',
    clue: 'Capital of the first state to ratify the Constitution',
    clueWords: words('Capital of the first state to ratify the Constitution'),
    answer: 'Dover',
  },
  {
    id: 'paris',
    puzzleType: 'crossword',
    clue: 'City of light home to the famous iron tower',
    clueWords: words('City of light home to the famous iron tower'),
    answer: 'Paris',
  },
  {
    id: 'moon',
    puzzleType: 'crossword',
    clue: 'Natural satellite that orbits our planet and causes tides',
    clueWords: words('Natural satellite that orbits our planet and causes tides'),
    answer: 'Moon',
  },
  {
    id: 'chess',
    puzzleType: 'crossword',
    clue: 'Ancient strategy board game where the king must not be checkmated',
    clueWords: words('Ancient strategy board game where the king must not be checkmated'),
    answer: 'Chess',
  },
  {
    id: 'nile',
    puzzleType: 'crossword',
    clue: 'Longest river in the world flowing through northern Africa',
    clueWords: words('Longest river in the world flowing through northern Africa'),
    answer: 'Nile',
  },
  {
    id: 'tennis',
    puzzleType: 'crossword',
    clue: 'Racket sport played at Wimbledon with a fuzzy yellow ball',
    clueWords: words('Racket sport played at Wimbledon with a fuzzy yellow ball'),
    answer: 'Tennis',
  },
  {
    id: 'mercury',
    puzzleType: 'crossword',
    clue: 'Smallest planet and closest to the Sun in our solar system',
    clueWords: words('Smallest planet and closest to the Sun in our solar system'),
    answer: 'Mercury',
  },
  {
    id: 'pacific',
    puzzleType: 'crossword',
    clue: 'Largest ocean on Earth covering more than one third of the globe',
    clueWords: words('Largest ocean on Earth covering more than one third of the globe'),
    answer: 'Pacific',
  },
];

// Each puzzle is a compound-word chain: consecutive pairs form one compound word.
// clueWords = the chain links hidden in the grid; answer = the final link.
export const CHAIN_PUZZLES: Puzzle[] = [
  {
    id: 'chain-punch',
    puzzleType: 'chain',
    clue: 'SUN → FLOWER → POT → HOLE → ?',
    clueWords: ['SUN', 'FLOWER', 'POT', 'HOLE'],
    answer: 'Punch',
    // SUNFLOWER · FLOWERPOT · POTHOLE · HOLE PUNCH
  },
  {
    id: 'chain-fast',
    puzzleType: 'chain',
    clue: 'RAIN → BOW → TIE → BREAK → ?',
    clueWords: ['RAIN', 'BOW', 'TIE', 'BREAK'],
    answer: 'Fast',
    // RAINBOW · BOWTIE · TIEBREAK · BREAKFAST
  },
  {
    id: 'chain-off',
    puzzleType: 'chain',
    clue: 'FIRE → WORK → SHOP → LIFT → ?',
    clueWords: ['FIRE', 'WORK', 'SHOP', 'LIFT'],
    answer: 'Off',
    // FIREWORK · WORKSHOP · SHOPLIFT · LIFTOFF
  },
  {
    id: 'chain-out',
    puzzleType: 'chain',
    clue: 'BOOK → MARK → DOWN → FALL → ?',
    clueWords: ['BOOK', 'MARK', 'DOWN', 'FALL'],
    answer: 'Out',
    // BOOKMARK · MARKDOWN · DOWNFALL · FALLOUT
  },
  {
    id: 'chain-walk',
    puzzleType: 'chain',
    clue: 'EAR → RING → LEADER → BOARD → ?',
    clueWords: ['EAR', 'RING', 'LEADER', 'BOARD'],
    answer: 'Walk',
    // EARRING · RINGLEADER · LEADERBOARD · BOARDWALK
  },
  {
    id: 'chain-step',
    puzzleType: 'chain',
    clue: 'WATER → FALL → OUT → DOOR → ?',
    clueWords: ['WATER', 'FALL', 'OUT', 'DOOR'],
    answer: 'Step',
    // WATERFALL · FALLOUT · OUTDOOR · DOORSTEP
  },
  {
    id: 'chain-life',
    puzzleType: 'chain',
    clue: 'HEAD → BAND → STAND → STILL → ?',
    clueWords: ['HEAD', 'BAND', 'STAND', 'STILL'],
    answer: 'Life',
    // HEADBAND · BANDSTAND · STANDSTILL · STILL LIFE
  },
  {
    id: 'chain-mate',
    puzzleType: 'chain',
    clue: 'THUNDER → CLAP → BOARD → ROOM → ?',
    clueWords: ['THUNDER', 'CLAP', 'BOARD', 'ROOM'],
    answer: 'Mate',
    // THUNDERCLAP · CLAPBOARD · BOARDROOM · ROOMMATE
  },
  {
    id: 'chain-soil',
    puzzleType: 'chain',
    clue: 'OVER → TIME → TABLE → TOP → ?',
    clueWords: ['OVER', 'TIME', 'TABLE', 'TOP'],
    answer: 'Soil',
    // OVERTIME · TIMETABLE · TABLETOP · TOPSOIL
  },
  {
    id: 'chain-game',
    puzzleType: 'chain',
    clue: 'UNDER → COVER → STORY → BOARD → ?',
    clueWords: ['UNDER', 'COVER', 'STORY', 'BOARD'],
    answer: 'Game',
    // UNDERCOVER · COVER STORY · STORYBOARD · BOARD GAME
  },
];

export const ALL_PUZZLES: Puzzle[] = [...CROSSWORD_PUZZLES, ...CHAIN_PUZZLES];

// Legacy alias
export const PUZZLES = CROSSWORD_PUZZLES;
