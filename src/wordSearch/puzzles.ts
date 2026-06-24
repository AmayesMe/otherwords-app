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
  {
    id: 'amazon',
    puzzleType: 'crossword',
    clue: 'Largest river by volume in South America flowing through dense rainforest',
    clueWords: words('Largest river by volume in South America flowing through dense rainforest'),
    answer: 'Amazon',
  },
  {
    id: 'penguin',
    puzzleType: 'crossword',
    clue: 'Flightless seabird of the Southern Hemisphere known for waddling on ice',
    clueWords: words('Flightless seabird of the Southern Hemisphere known for waddling on ice'),
    answer: 'Penguin',
  },
  {
    id: 'diamond',
    puzzleType: 'crossword',
    clue: 'Hardest natural substance on Earth often set in engagement rings',
    clueWords: words('Hardest natural substance on Earth often set in engagement rings'),
    answer: 'Diamond',
  },
  {
    id: 'volcano',
    puzzleType: 'crossword',
    clue: 'Mountain that ejects molten rock and ash when it erupts',
    clueWords: words('Mountain that ejects molten rock and ash when it erupts'),
    answer: 'Volcano',
  },
  {
    id: 'compass',
    puzzleType: 'crossword',
    clue: 'Handheld navigation tool with a magnetic needle that always points north',
    clueWords: words('Handheld navigation tool with a magnetic needle that always points north'),
    answer: 'Compass',
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
  {
    id: 'chain-stage',
    puzzleType: 'chain',
    clue: 'FIRE → TRUCK → STOP → SIGN → LANGUAGE → ARTS → CENTER → ?',
    clueWords: ['FIRE', 'TRUCK', 'STOP', 'SIGN', 'LANGUAGE', 'ARTS', 'CENTER'],
    answer: 'Stage',
    // fire truck · truck stop · stop sign · sign language · language arts · arts center · center stage
  },
  {
    id: 'chain-brand',
    puzzleType: 'chain',
    clue: 'PRIME → TIME → ZONE → DEFENSE → ATTORNEY → GENERAL → STORE → ?',
    clueWords: ['PRIME', 'TIME', 'ZONE', 'DEFENSE', 'ATTORNEY', 'GENERAL', 'STORE'],
    answer: 'Brand',
    // prime time · time zone · zone defense · defense attorney · attorney general · general store · store brand
  },
  {
    id: 'chain-plan',
    puzzleType: 'chain',
    clue: 'HIGH → TIDE → POOL → PARTY → LINE → DANCE → FLOOR → ?',
    clueWords: ['HIGH', 'TIDE', 'POOL', 'PARTY', 'LINE', 'DANCE', 'FLOOR'],
    answer: 'Plan',
    // high tide · tide pool · pool party · party line · line dance · dance floor · floor plan
  },
  {
    id: 'chain-cell',
    puzzleType: 'chain',
    clue: 'SMALL → TALK → BACK → PAIN → RELIEF → VALVE → STEM → ?',
    clueWords: ['SMALL', 'TALK', 'BACK', 'PAIN', 'RELIEF', 'VALVE', 'STEM'],
    answer: 'Cell',
    // small talk · talk back · back pain · pain relief · relief valve · valve stem · stem cell
  },
  {
    id: 'chain-office',
    puzzleType: 'chain',
    clue: 'BRAIN → TEASER → TRAILER → PARK → BENCH → PRESS → BOX → ?',
    clueWords: ['BRAIN', 'TEASER', 'TRAILER', 'PARK', 'BENCH', 'PRESS', 'BOX'],
    answer: 'Office',
    // brain teaser · teaser trailer · trailer park · park bench · bench press · press box · box office
  },
];

export const ALL_PUZZLES: Puzzle[] = [...CROSSWORD_PUZZLES, ...CHAIN_PUZZLES];

// Legacy alias
export const PUZZLES = CROSSWORD_PUZZLES;
