import type { Puzzle } from './types';

function words(clue: string): string[] {
  return clue.split(/\s+/).filter(w => w.length > 0);
}

export const PUZZLES: Puzzle[] = [
  {
    id: 'dover',
    clue: 'Capital of the first state to ratify the Constitution',
    clueWords: words('Capital of the first state to ratify the Constitution'),
    answer: 'Dover',
  },
  {
    id: 'paris',
    clue: 'City of light home to the famous iron tower',
    clueWords: words('City of light home to the famous iron tower'),
    answer: 'Paris',
  },
  {
    id: 'moon',
    clue: 'Natural satellite that orbits our planet and causes tides',
    clueWords: words('Natural satellite that orbits our planet and causes tides'),
    answer: 'Moon',
  },
  {
    id: 'chess',
    clue: 'Ancient strategy board game where the king must not be checkmated',
    clueWords: words('Ancient strategy board game where the king must not be checkmated'),
    answer: 'Chess',
  },
  {
    id: 'nile',
    clue: 'Longest river in the world flowing through northern Africa',
    clueWords: words('Longest river in the world flowing through northern Africa'),
    answer: 'Nile',
  },
  {
    id: 'tennis',
    clue: 'Racket sport played at Wimbledon with a fuzzy yellow ball',
    clueWords: words('Racket sport played at Wimbledon with a fuzzy yellow ball'),
    answer: 'Tennis',
  },
  {
    id: 'mercury',
    clue: 'Smallest planet and closest to the Sun in our solar system',
    clueWords: words('Smallest planet and closest to the Sun in our solar system'),
    answer: 'Mercury',
  },
  {
    id: 'pacific',
    clue: 'Largest ocean on Earth covering more than one third of the globe',
    clueWords: words('Largest ocean on Earth covering more than one third of the globe'),
    answer: 'Pacific',
  },
];
