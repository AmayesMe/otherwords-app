import { create } from 'zustand';
import { createEmptyBoard } from '../game/boardUtils';
import type { BoardState, Player, RackTile, TileData } from '../game/types';

// Rack is a fixed-length array of slots; null means empty slot
export type RackSlot = RackTile | null;

export interface PlacedThisTurn {
  rackTileId: string;
  rackSlotIndex: number;   // where to return the tile on recall
  letter: string;
  isWild: boolean;
  replacedTile: TileData | null;
}

export type DragData =
  | { type: 'rack';  tileId: string; slotIndex: number }
  | { type: 'board'; col: number; row: number };

interface GameStore {
  board: BoardState;
  currentPlayer: Player;
  player1Rack: RackSlot[];
  player2Rack: RackSlot[];
  player1Score: number;
  player2Score: number;
  currentTurnPlacements: Record<string, PlacedThisTurn>;

  // Actions
  placeTile: (tileId: string, slotIndex: number, col: number, row: number) => void;
  moveTile: (fromCol: number, fromRow: number, toCol: number, toRow: number) => void;
  recallTile: (col: number, row: number) => void;
  recallAllTiles: () => void;
  swapRackSlots: (fromIndex: number, toIndex: number) => void;
  moveRackTileToSlot: (tileId: string, fromIndex: number, toIndex: number) => void;

  // Helpers
  getCurrentRack: () => RackSlot[];
  isCurrentTurnTile: (col: number, row: number) => boolean;
}

const STARTING_RACK: RackSlot[] = [
  { id: 'r1', letter: 'S', isWild: false },
  { id: 'r2', letter: 'T', isWild: false },
  { id: 'r3', letter: 'A', isWild: false },
  { id: 'r4', letter: 'R', isWild: false },
  { id: 'r5', letter: 'E', isWild: false },
  { id: 'r6', letter: 'N', isWild: false },
  { id: 'r7', letter: 'D', isWild: false },
];

function getCurrentRackSlots(state: GameStore): RackSlot[] {
  return state.currentPlayer === 'player1' ? state.player1Rack : state.player2Rack;
}

function setCurrentRack(state: GameStore, rack: RackSlot[]) {
  return state.currentPlayer === 'player1' ? { player1Rack: rack } : { player2Rack: rack };
}

export const useGameStore = create<GameStore>((set, get) => ({
  board: createEmptyBoard(),
  currentPlayer: 'player1',
  player1Rack: [...STARTING_RACK],
  player2Rack: [],
  player1Score: 0,
  player2Score: 0,
  currentTurnPlacements: {},

  getCurrentRack: () => getCurrentRackSlots(get()),
  isCurrentTurnTile: (col, row) => `${col},${row}` in get().currentTurnPlacements,

  placeTile(tileId, slotIndex, col, row) {
    const state = get();
    const rack = getCurrentRackSlots(state);
    const rackTile = rack[slotIndex];
    if (!rackTile || rackTile.id !== tileId) return;

    const cell = state.board[row][col];
    const key = `${col},${row}`;
    const existingPlacement = state.currentTurnPlacements[key];

    const newBoard: BoardState = state.board.map(r => r.map(c => ({ ...c })));
    newBoard[row][col] = {
      ...cell,
      tile: { letter: rackTile.letter, owner: state.currentPlayer, isWild: rackTile.isWild },
    };

    // Clear the rack slot; if a this-turn tile was already here, restore its displaced tile back
    const newRack = [...rack];
    newRack[slotIndex] = null;

    if (existingPlacement) {
      // Put the displaced this-turn tile back into its original rack slot
      newRack[existingPlacement.rackSlotIndex] = {
        id: existingPlacement.rackTileId,
        letter: existingPlacement.letter,
        isWild: existingPlacement.isWild,
      };
    }

    const newPlacements = {
      ...state.currentTurnPlacements,
      [key]: {
        rackTileId: tileId,
        rackSlotIndex: slotIndex,
        letter: rackTile.letter,
        isWild: rackTile.isWild,
        replacedTile: existingPlacement ? existingPlacement.replacedTile : cell.tile,
      },
    };

    set({ board: newBoard, currentTurnPlacements: newPlacements, ...setCurrentRack(state, newRack) });
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

    // If the target had a this-turn tile, bump it back to its rack slot
    const newRack = [...getCurrentRackSlots(state)];
    if (existingAtTarget) {
      newRack[existingAtTarget.rackSlotIndex] = {
        id: existingAtTarget.rackTileId,
        letter: existingAtTarget.letter,
        isWild: existingAtTarget.isWild,
      };
    }

    set({ board: newBoard, currentTurnPlacements: newPlacements, ...setCurrentRack(state, newRack) });
  },

  recallTile(col, row) {
    const state = get();
    const key = `${col},${row}`;
    const placement = state.currentTurnPlacements[key];
    if (!placement) return;

    const cell = state.board[row][col];
    const newBoard: BoardState = state.board.map(r => r.map(c => ({ ...c })));
    newBoard[row][col] = { ...cell, tile: placement.replacedTile };

    const newRack = [...getCurrentRackSlots(state)];
    newRack[placement.rackSlotIndex] = { id: placement.rackTileId, letter: placement.letter, isWild: placement.isWild };

    const newPlacements = { ...state.currentTurnPlacements };
    delete newPlacements[key];

    set({ board: newBoard, currentTurnPlacements: newPlacements, ...setCurrentRack(state, newRack) });
  },

  recallAllTiles() {
    const state = get();
    const newBoard: BoardState = state.board.map(r => r.map(c => ({ ...c })));
    const newRack = [...getCurrentRackSlots(state)];

    for (const [key, placement] of Object.entries(state.currentTurnPlacements)) {
      const [col, row] = key.split(',').map(Number);
      newBoard[row][col] = { ...newBoard[row][col], tile: placement.replacedTile };
      newRack[placement.rackSlotIndex] = { id: placement.rackTileId, letter: placement.letter, isWild: placement.isWild };
    }

    set({ board: newBoard, currentTurnPlacements: {}, ...setCurrentRack(state, newRack) });
  },

  swapRackSlots(fromIndex, toIndex) {
    const state = get();
    const newRack = [...getCurrentRackSlots(state)];
    [newRack[fromIndex], newRack[toIndex]] = [newRack[toIndex], newRack[fromIndex]];
    set(setCurrentRack(state, newRack));
  },

  moveRackTileToSlot(tileId, fromIndex, toIndex) {
    const state = get();
    const newRack = [...getCurrentRackSlots(state)];
    const tile = newRack[fromIndex];
    if (!tile || tile.id !== tileId) return;
    // Swap with target (whether occupied or empty)
    [newRack[fromIndex], newRack[toIndex]] = [newRack[toIndex], newRack[fromIndex]];
    set(setCurrentRack(state, newRack));
  },
}));
