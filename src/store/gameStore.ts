import { create } from 'zustand';
import { createEmptyBoard } from '../game/boardUtils';
import type { BoardState, Player, RackTile, TileData } from '../game/types';

export interface PlacedThisTurn {
  rackTileId: string;
  letter: string;
  isWild: boolean;
  replacedTile: TileData | null;
}

interface GameStore {
  board: BoardState;
  currentPlayer: Player;
  player1Rack: RackTile[];
  player2Rack: RackTile[];
  player1Score: number;
  player2Score: number;
  currentTurnPlacements: Record<string, PlacedThisTurn>;

  // Actions
  placeTile: (tileId: string, col: number, row: number) => void;
  moveTile: (fromCol: number, fromRow: number, toCol: number, toRow: number) => void;
  recallTile: (col: number, row: number) => void;
  recallAllTiles: () => void;

  // Helpers
  getCurrentRack: () => RackTile[];
  isCurrentTurnTile: (col: number, row: number) => boolean;
}

function getRack(state: GameStore) {
  return state.currentPlayer === 'player1' ? state.player1Rack : state.player2Rack;
}

function setRack(state: GameStore, rack: RackTile[]) {
  return state.currentPlayer === 'player1'
    ? { player1Rack: rack }
    : { player2Rack: rack };
}

export const useGameStore = create<GameStore>((set, get) => ({
  board: createEmptyBoard(),
  currentPlayer: 'player1',
  player1Rack: [
    { id: 'r1', letter: 'S', isWild: false },
    { id: 'r2', letter: 'T', isWild: false },
    { id: 'r3', letter: 'A', isWild: false },
    { id: 'r4', letter: 'R', isWild: false },
    { id: 'r5', letter: 'E', isWild: false },
    { id: 'r6', letter: 'N', isWild: false },
    { id: 'r7', letter: 'D', isWild: false },
  ],
  player2Rack: [],
  player1Score: 0,
  player2Score: 0,
  currentTurnPlacements: {},

  getCurrentRack: () => getRack(get()),
  isCurrentTurnTile: (col, row) => `${col},${row}` in get().currentTurnPlacements,

  placeTile(tileId, col, row) {
    const state = get();
    const rack = getRack(state);
    const rackTile = rack.find(t => t.id === tileId);
    if (!rackTile) return;

    const cell = state.board[row][col];
    const key = `${col},${row}`;

    // If dropping on a cell that already has a this-turn tile, swap:
    // recall the existing one back to rack first, then place the new one.
    const existingPlacement = state.currentTurnPlacements[key];

    const newBoard: BoardState = state.board.map(r => r.map(c => ({ ...c })));
    newBoard[row][col] = {
      ...cell,
      tile: { letter: rackTile.letter, owner: state.currentPlayer, isWild: rackTile.isWild },
    };

    // Build new rack: remove placed tile, optionally re-add the displaced one
    let newRack = rack.filter(t => t.id !== tileId);
    if (existingPlacement) {
      newRack = [...newRack, {
        id: existingPlacement.rackTileId,
        letter: existingPlacement.letter,
        isWild: existingPlacement.isWild,
      }];
    }

    const newPlacements = {
      ...state.currentTurnPlacements,
      [key]: {
        rackTileId: tileId,
        letter: rackTile.letter,
        isWild: rackTile.isWild,
        replacedTile: existingPlacement ? existingPlacement.replacedTile : cell.tile,
      },
    };

    set({ board: newBoard, currentTurnPlacements: newPlacements, ...setRack(state, newRack) });
  },

  moveTile(fromCol, fromRow, toCol, toRow) {
    const state = get();
    const fromKey = `${fromCol},${fromRow}`;
    const toKey = `${toCol},${toRow}`;
    const placement = state.currentTurnPlacements[fromKey];
    if (!placement) return;

    const fromCell = state.board[fromRow][fromCol];
    const toCell = state.board[toRow][toCol];
    if (!fromCell.tile) return;

    const existingAtTarget = state.currentTurnPlacements[toKey];

    const newBoard: BoardState = state.board.map(r => r.map(c => ({ ...c })));
    newBoard[toRow][toCol] = { ...toCell, tile: fromCell.tile };
    newBoard[fromRow][fromCol] = { ...fromCell, tile: placement.replacedTile };

    const newPlacements = { ...state.currentTurnPlacements };
    delete newPlacements[fromKey];
    newPlacements[toKey] = {
      ...placement,
      replacedTile: existingAtTarget ? existingAtTarget.replacedTile : toCell.tile,
    };

    // If target had a this-turn tile, it gets displaced back to rack
    let newRack = getRack(state);
    if (existingAtTarget) {
      newRack = [...newRack, {
        id: existingAtTarget.rackTileId,
        letter: existingAtTarget.letter,
        isWild: existingAtTarget.isWild,
      }];
    }

    set({ board: newBoard, currentTurnPlacements: newPlacements, ...setRack(state, newRack) });
  },

  recallTile(col, row) {
    const state = get();
    const key = `${col},${row}`;
    const placement = state.currentTurnPlacements[key];
    if (!placement) return;

    const cell = state.board[row][col];
    const newBoard: BoardState = state.board.map(r => r.map(c => ({ ...c })));
    newBoard[row][col] = { ...cell, tile: placement.replacedTile };

    const newRack = [...getRack(state), {
      id: placement.rackTileId,
      letter: placement.letter,
      isWild: placement.isWild,
    }];

    const newPlacements = { ...state.currentTurnPlacements };
    delete newPlacements[key];

    set({ board: newBoard, currentTurnPlacements: newPlacements, ...setRack(state, newRack) });
  },

  recallAllTiles() {
    const state = get();
    const newBoard: BoardState = state.board.map(r => r.map(c => ({ ...c })));
    const restoredTiles: RackTile[] = [];

    for (const [key, placement] of Object.entries(state.currentTurnPlacements)) {
      const [col, row] = key.split(',').map(Number);
      newBoard[row][col] = { ...newBoard[row][col], tile: placement.replacedTile };
      restoredTiles.push({ id: placement.rackTileId, letter: placement.letter, isWild: placement.isWild });
    }

    set({
      board: newBoard,
      currentTurnPlacements: {},
      ...setRack(state, [...getRack(state), ...restoredTiles]),
    });
  },
}));
