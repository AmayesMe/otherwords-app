export type Player = 'player1' | 'player2';
export type BonusValue = 1 | 2 | 3;

export interface TileData {
  letter: string;
  owner: Player;
  isWild: boolean;
  wildLetter?: string;
}

export interface CellState {
  tile: TileData | null;
  bonus: BonusValue | null;
  bonusUsed: boolean;
}

export type BoardState = CellState[][];

export interface RackTile {
  id: string;
  letter: string;
  isWild: boolean;
}

export interface GameState {
  board: BoardState;
  currentPlayer: Player;
  player1Rack: RackTile[];
  player2Rack: RackTile[];
  player1Score: number;
  player2Score: number;
  turnNumber: number;
}
