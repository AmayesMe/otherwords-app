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

// Each puzzle is a two-word-phrase chain: consecutive pairs form a two-word phrase (words stay separate).
// clueWords = 7 words hidden in the grid; answer = the 8th word (final link, not hidden).
export const CHAIN_PUZZLES: Puzzle[] = [
  {
    id: 'chain-chain',
    puzzleType: 'chain',
    clue: 'ROLLING → STONE → COLD → SHOULDER → PAD → THAI → FOOD → ?',
    clueWords: ['ROLLING', 'STONE', 'COLD', 'SHOULDER', 'PAD', 'THAI', 'FOOD'],
    answer: 'Chain',
    // rolling stone · stone cold · cold shoulder · shoulder pad · pad Thai · Thai food · food chain
  },
  {
    id: 'chain-elbow',
    puzzleType: 'chain',
    clue: 'HOT → SPRING → CHICKEN → SOUP → KITCHEN → TABLE → TENNIS → ?',
    clueWords: ['HOT', 'SPRING', 'CHICKEN', 'SOUP', 'KITCHEN', 'TABLE', 'TENNIS'],
    answer: 'Elbow',
    // hot spring · spring chicken · chicken soup · soup kitchen · kitchen table · table tennis · tennis elbow
  },
  {
    id: 'chain-wave',
    puzzleType: 'chain',
    clue: 'LONG → JUMP → ROPE → TRICK → SHOT → CLOCK → RADIO → ?',
    clueWords: ['LONG', 'JUMP', 'ROPE', 'TRICK', 'SHOT', 'CLOCK', 'RADIO'],
    answer: 'Wave',
    // long jump · jump rope · rope trick · trick shot · shot clock · clock radio · radio wave
  },
  {
    id: 'chain-bomb',
    puzzleType: 'chain',
    clue: 'COLD → CASE → STUDY → HALL → PASS → MARK → TIME → ?',
    clueWords: ['COLD', 'CASE', 'STUDY', 'HALL', 'PASS', 'MARK', 'TIME'],
    answer: 'Bomb',
    // cold case · case study · study hall · hall pass · pass mark · mark time · time bomb
  },
  {
    id: 'chain-piano',
    puzzleType: 'chain',
    clue: 'OPEN → SEASON → TICKET → PRICE → TAG → TEAM → PLAYER → ?',
    clueWords: ['OPEN', 'SEASON', 'TICKET', 'PRICE', 'TAG', 'TEAM', 'PLAYER'],
    answer: 'Piano',
    // open season · season ticket · ticket price · price tag · tag team · team player · player piano
  },
  {
    id: 'chain-flight',
    puzzleType: 'chain',
    clue: 'TRADE → WIND → FARM → FRESH → AIR → GUITAR → SOLO → ?',
    clueWords: ['TRADE', 'WIND', 'FARM', 'FRESH', 'AIR', 'GUITAR', 'SOLO'],
    answer: 'Flight',
    // trade wind · wind farm · farm fresh · fresh air · air guitar · guitar solo · solo flight
  },
];

export const ALL_PUZZLES: Puzzle[] = [...CROSSWORD_PUZZLES, ...CHAIN_PUZZLES];

// Legacy alias
export const PUZZLES = CROSSWORD_PUZZLES;
