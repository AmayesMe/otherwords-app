import { create } from 'zustand';
import { createEmptyBoard, countScore } from '../game/boardUtils';
import { validatePlacement } from '../game/turnUtils';
import { extractNewWords, findConfiscatedCells } from '../game/wordUtils';
import { loadDictionary, isValidWord } from '../game/dictionary';
import { TILE_DISTRIBUTION, BLANK_TILE_COUNT, STARTING_RACK_SIZE } from '../game/config';
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
  tileBag: string[];
  turnCount: number;         // 0 = first turn of game not yet played
  turnError: string | null;
  pendingWildAssignment: { col: number; row: number } | null;

  // Actions
  placeTile: (tileId: string, slotIndex: number, col: number, row: number) => void;
  moveTile: (fromCol: number, fromRow: number, toCol: number, toRow: number) => void;
  recallTile: (col: number, row: number) => void;
  recallAllTiles: () => void;
  swapRackSlots: (fromIndex: number, toIndex: number) => void;
  moveRackTileToSlot: (tileId: string, fromIndex: number, toIndex: number) => void;
  shuffleRack: () => void;
  endTurn: () => void;
  assignWildLetter: (letter: string) => void;
  cancelWildAssignment: () => void;

  // Helpers
  getCurrentRack: () => RackSlot[];
  isCurrentTurnTile: (col: number, row: number) => boolean;
}

// ─── Tile bag helpers ────────────────────────────────────────────────────────

function createShuffledBag(): string[] {
  const bag: string[] = [];
  for (const [letter, count] of Object.entries(TILE_DISTRIBUTION)) {
    for (let i = 0; i < count; i++) bag.push(letter);
  }
  for (let i = 0; i < BLANK_TILE_COUNT; i++) bag.push('*');
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

let _tileIdSeq = 0;
function makeTileId() { return `t${++_tileIdSeq}`; }

function dealTiles(bag: string[], count: number): { rack: RackSlot[]; bag: string[] } {
  const remaining = [...bag];
  const rack: RackSlot[] = [];
  for (let i = 0; i < count; i++) {
    if (remaining.length > 0) {
      const letter = remaining.pop()!;
      rack.push({ id: makeTileId(), letter, isWild: letter === '*' });
    } else {
      rack.push(null);
    }
  }
  return { rack, bag: remaining };
}

function refillRack(rack: RackSlot[], bag: string[]): { rack: RackSlot[]; bag: string[] } {
  // Always normalise back to exactly STARTING_RACK_SIZE slots.
  // Collect whatever tiles the player still holds (regardless of rack length,
  // which may be inflated from a previous bonus draw), then draw just enough
  // to reach 7. Bonus tiles are appended on top of this in endTurn.
  const held = rack.filter((s): s is RackTile => s !== null);
  const newBag = [...bag];
  const newRack: RackSlot[] = [...held];

  while (newRack.length < STARTING_RACK_SIZE && newBag.length > 0) {
    const letter = newBag.pop()!;
    newRack.push({ id: makeTileId(), letter, isWild: letter === '*' });
  }

  // Pad with null slots if the bag ran dry
  while (newRack.length < STARTING_RACK_SIZE) {
    newRack.push(null);
  }

  return { rack: newRack, bag: newBag };
}

// ─── Initial state ───────────────────────────────────────────────────────────

const initBag = createShuffledBag();
const p1Deal = dealTiles(initBag, STARTING_RACK_SIZE);
const p2Deal = dealTiles(p1Deal.bag, STARTING_RACK_SIZE);

// ─── Store helpers ───────────────────────────────────────────────────────────

function getCurrentRackSlots(state: GameStore): RackSlot[] {
  return state.currentPlayer === 'player1' ? state.player1Rack : state.player2Rack;
}

function setCurrentRack(state: GameStore, rack: RackSlot[]) {
  return state.currentPlayer === 'player1' ? { player1Rack: rack } : { player2Rack: rack };
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useGameStore = create<GameStore>((set, get) => ({
  board: createEmptyBoard(),
  currentPlayer: 'player1',
  player1Rack: p1Deal.rack,
  player2Rack: p2Deal.rack,
  player1Score: 0,
  player2Score: 0,
  currentTurnPlacements: {},
  tileBag: p2Deal.bag,
  turnCount: 0,
  turnError: null,
  pendingWildAssignment: null,

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

    const newRack = [...rack];
    newRack[slotIndex] = null;

    if (existingPlacement) {
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

    set({
      board: newBoard,
      currentTurnPlacements: newPlacements,
      turnError: null,
      pendingWildAssignment: rackTile.isWild ? { col, row } : null,
      ...setCurrentRack(state, newRack),
    });
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

    const newRack = [...getCurrentRackSlots(state)];
    if (existingAtTarget) {
      newRack[existingAtTarget.rackSlotIndex] = {
        id: existingAtTarget.rackTileId,
        letter: existingAtTarget.letter,
        isWild: existingAtTarget.isWild,
      };
    }

    set({ board: newBoard, currentTurnPlacements: newPlacements, turnError: null, ...setCurrentRack(state, newRack) });
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

    set({ board: newBoard, currentTurnPlacements: newPlacements, pendingWildAssignment: null, turnError: null, ...setCurrentRack(state, newRack) });
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

    set({ board: newBoard, currentTurnPlacements: {}, pendingWildAssignment: null, turnError: null, ...setCurrentRack(state, newRack) });
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
    [newRack[fromIndex], newRack[toIndex]] = [newRack[toIndex], newRack[fromIndex]];
    set(setCurrentRack(state, newRack));
  },

  shuffleRack() {
    const state = get();
    const rack = [...getCurrentRackSlots(state)];
    const filledIndices = rack.map((slot, i) => slot !== null ? i : -1).filter(i => i !== -1);
    const tiles = filledIndices.map(i => rack[i]);
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    filledIndices.forEach((slotIndex, i) => { rack[slotIndex] = tiles[i]; });
    set(setCurrentRack(state, rack));
  },

  assignWildLetter(letter: string) {
    const state = get();
    const { pendingWildAssignment, board } = state;
    if (!pendingWildAssignment) return;
    const { col, row } = pendingWildAssignment;
    const cell = board[row][col];
    if (!cell.tile) return;
    const newBoard: BoardState = board.map(r => r.map(c => ({ ...c })));
    newBoard[row][col] = { ...cell, tile: { ...cell.tile, wildLetter: letter } };
    set({ board: newBoard, pendingWildAssignment: null });
  },

  cancelWildAssignment() {
    const state = get();
    const { pendingWildAssignment, currentTurnPlacements, board } = state;
    if (!pendingWildAssignment) return;
    const { col, row } = pendingWildAssignment;
    const key = `${col},${row}`;
    const placement = currentTurnPlacements[key];
    if (!placement) { set({ pendingWildAssignment: null }); return; }
    const cell = board[row][col];
    const newBoard: BoardState = board.map(r => r.map(c => ({ ...c })));
    newBoard[row][col] = { ...cell, tile: placement.replacedTile };
    const newRack = [...getCurrentRackSlots(state)];
    newRack[placement.rackSlotIndex] = { id: placement.rackTileId, letter: placement.letter, isWild: placement.isWild };
    const newPlacements = { ...currentTurnPlacements };
    delete newPlacements[key];
    set({ board: newBoard, currentTurnPlacements: newPlacements, pendingWildAssignment: null, turnError: null, ...setCurrentRack(state, newRack) });
  },

  async endTurn() {
    const state = get();
    const { board, currentTurnPlacements, currentPlayer, tileBag, turnCount } = state;

    // Validate placement geometry
    const result = validatePlacement(board, currentTurnPlacements, turnCount === 0);
    if (!result.valid) {
      set({ turnError: result.error ?? 'Invalid placement.' });
      return;
    }

    // Validate words against dictionary (ensures the word set is loaded)
    await loadDictionary();
    const newWords = extractNewWords(board, currentTurnPlacements);
    for (const word of newWords) {
      // Skip validation for words containing unassigned wild tiles (letter not yet chosen)
      if (word.containsWild) continue;
      if (!isValidWord(word.letters)) {
        set({ turnError: `Not a word: ${word.letters.toUpperCase()}` });
        return;
      }
    }

    // Commit: mark bonus spaces as used and tally extra tiles earned
    const newBoard: BoardState = board.map(r => r.map(c => ({ ...c })));
    let bonusTilesEarned = 0;
    for (const key of Object.keys(currentTurnPlacements)) {
      const [col, row] = key.split(',').map(Number);
      const cell = newBoard[row][col];
      if (cell.bonus && !cell.bonusUsed) {
        newBoard[row][col] = { ...cell, bonusUsed: true };
        bonusTilesEarned += cell.bonus;
      }
    }

    // Confiscation: if a word was EXTENDED this turn (letters added to either
    // end, making it longer), all tiles in that word flip to the current
    // player's color — including any opponent tiles already in the word.
    // Crossing through a word or replacing a letter in-place does NOT confiscate.
    const confiscated = findConfiscatedCells(newBoard, currentTurnPlacements, newWords);
    for (const { col, row } of confiscated) {
      const cell = newBoard[row][col];
      if (cell.tile && cell.tile.owner !== currentPlayer) {
        newBoard[row][col] = { ...cell, tile: { ...cell.tile, owner: currentPlayer } };
      }
    }

    // Refill current player's rack back to standard size, then draw bonus tiles
    const currentRack = getCurrentRackSlots(state);
    const refilled = refillRack(currentRack, tileBag);

    // Append bonus tiles to the end of the rack (rack grows temporarily)
    let finalRack: RackSlot[] = [...refilled.rack];
    let finalBag = [...refilled.bag];
    for (let i = 0; i < bonusTilesEarned; i++) {
      if (finalBag.length > 0) {
        const letter = finalBag.pop()!;
        finalRack.push({ id: makeTileId(), letter, isWild: letter === '*' });
      }
    }

    // Update scores from committed board
    const scores = countScore(newBoard);

    // Switch player
    const nextPlayer: Player = currentPlayer === 'player1' ? 'player2' : 'player1';
    const rackUpdate = currentPlayer === 'player1'
      ? { player1Rack: finalRack }
      : { player2Rack: finalRack };

    set({
      board: newBoard,
      currentTurnPlacements: {},
      currentPlayer: nextPlayer,
      tileBag: finalBag,
      turnCount: turnCount + 1,
      turnError: null,
      player1Score: scores.player1,
      player2Score: scores.player2,
      ...rackUpdate,
    });
  },
}));
