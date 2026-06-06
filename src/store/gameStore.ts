import { create } from 'zustand';
import { createEmptyBoard, countScore } from '../game/boardUtils';
import { validatePlacement } from '../game/turnUtils';
import { extractNewWords, findConfiscatedCells } from '../game/wordUtils';
import { loadDictionary, isValidWord } from '../game/dictionary';
import { TILE_DISTRIBUTION, BLANK_TILE_COUNT, STARTING_RACK_SIZE, MAX_RACK_SIZE, BOARD_WIDTH } from '../game/config';
import { createGame, joinGame, pushState, subscribeToGame, getGame } from '../lib/gameSync';
import type { RealtimeChannel } from '@supabase/supabase-js';
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

/** A game the player has created or joined on this device. */
export interface SavedGame {
  gameId: string;
  role: Player;
}

// ── Replay types ─────────────────────────────────────────────────────────────

export interface ReplayPlacement {
  col: number;
  row: number;
  letter: string;
  isWild: boolean;
  wildLetter?: string;
}

export interface ReplayConfiscation {
  col: number;
  row: number;
  fromOwner: Player;
}

export interface GameOverState {
  winner: Player | null;   // null = tie
  reason: 'consecutive-passes' | 'rack-empty' | 'resignation';
  player1Score: number;
  player2Score: number;
}

/** A full record of one player's turn, used to animate the replay. */
export interface TurnReplay {
  player: Player;
  placements: ReplayPlacement[];
  confiscated: ReplayConfiscation[];
  boardBefore: BoardState;   // board state at the START of this turn
}

/** Subset of game state that gets serialised to Supabase on every turn end. */
export interface SyncState {
  board: BoardState;
  player1Rack: RackSlot[];
  player2Rack: RackSlot[];
  player1Score: number;
  player2Score: number;
  currentPlayer: Player;
  tileBag: string[];
  turnCount: number;
  player1Name?: string;
  player2Name?: string;
  lastTurnReplay?: TurnReplay;
  consecutivePassCount: number;
  gameOver: GameOverState | null;
  lastTurnWasPass?: boolean;
  bagClosed: boolean;  // true once the bag runs dry — no more drawing
}

interface GameStore {
  // ── Core game state ────────────────────────────────────────────────────────
  board: BoardState;
  currentPlayer: Player;
  player1Rack: RackSlot[];
  player2Rack: RackSlot[];
  player1Score: number;
  player2Score: number;
  currentTurnPlacements: Record<string, PlacedThisTurn>;
  tileBag: string[];
  turnCount: number;
  turnError: string | null;
  pendingWildAssignment: { col: number; row: number; isRedesig?: boolean } | null;
  consecutivePassCount: number;
  gameOver: GameOverState | null;
  bagClosed: boolean;  // true once the shared bag empties — no more tile draws
  // Tracks the original wildLetter for each redesignated cell this turn ("col,row" → original)
  wildRedigs: Record<string, string>;

  // ── Multiplayer state ──────────────────────────────────────────────────────
  screen: 'lobby' | 'playing';
  gameId: string | null;        // null = local (pass-and-play)
  myRole: Player | null;        // null = local (you are both players)
  myName: string;               // this device's player name (persisted)
  player1Name: string;
  player2Name: string;
  isWaitingForOpponent: boolean;
  syncError: string | null;
  savedGames: SavedGame[];      // games this device has created or joined

  // ── Replay state ───────────────────────────────────────────────────────────
  pendingReplay: TurnReplay | null;
  replayMode: 'banner' | 'watching' | null;
  // Board/score state received from opponent but not yet shown (held until replay completes)
  pendingSync: SyncState | null;
  // Live score shown in the score bar while replay animation is playing
  replayScore: { player1: number; player2: number } | null;

  // ── Tile-placement actions ─────────────────────────────────────────────────
  placeTile: (tileId: string, slotIndex: number, col: number, row: number) => void;
  moveTile: (fromCol: number, fromRow: number, toCol: number, toRow: number) => void;
  recallTile: (col: number, row: number) => void;
  recallAllTiles: () => void;
  swapRackSlots: (fromIndex: number, toIndex: number) => void;
  moveRackTileToSlot: (tileId: string, fromIndex: number, toIndex: number) => void;
  shuffleRack: () => void;
  endTurn: () => void;
  passTurn: () => void;
  resign: () => void;
  assignWildLetter: (letter: string) => void;
  cancelWildAssignment: () => void;
  beginWildRedesig: (col: number, row: number) => void;

  // ── Multiplayer actions ────────────────────────────────────────────────────
  startLocalGame: () => void;
  createOnlineGame: () => Promise<string>;   // returns join code
  joinOnlineGame: (code: string) => Promise<void>;
  resumeGame: (gameId: string, role: Player) => Promise<void>;
  removeSavedGame: (gameId: string) => void;
  setPlayerName: (name: string) => void;
  startPlayingNow: () => void;
  applyRemoteRow: (row: { state: SyncState; player2_joined: boolean }) => void;
  resetToLobby: () => void;

  // ── Replay actions ─────────────────────────────────────────────────────────
  watchReplay: () => void;    // banner → watching (user clicks "see their play")
  dismissReplay: () => void;  // apply pendingSync + clear replay state
  setReplayScore: (score: { player1: number; player2: number } | null) => void;

  // ── Helpers ────────────────────────────────────────────────────────────────
  getCurrentRack: () => RackSlot[];
  isCurrentTurnTile: (col: number, row: number) => boolean;
  isMyTurn: () => boolean;
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
  const held = rack.filter((s): s is RackTile => s !== null);
  const newBag = [...bag];
  const newRack: RackSlot[] = [...held];

  while (newRack.length < STARTING_RACK_SIZE && newBag.length > 0) {
    const letter = newBag.pop()!;
    newRack.push({ id: makeTileId(), letter, isWild: letter === '*' });
  }

  while (newRack.length < STARTING_RACK_SIZE) {
    newRack.push(null);
  }

  return { rack: newRack, bag: newBag };
}

// ─── Sync helpers ────────────────────────────────────────────────────────────

function freshGameState(): Omit<SyncState, 'currentPlayer'> & { currentPlayer: Player } {
  const bag = createShuffledBag();
  const p1Deal = dealTiles(bag, STARTING_RACK_SIZE);
  const p2Deal = dealTiles(p1Deal.bag, STARTING_RACK_SIZE);
  return {
    board: createEmptyBoard(),
    currentPlayer: 'player1' as Player,
    player1Rack: p1Deal.rack,
    player2Rack: p2Deal.rack,
    player1Score: 0,
    player2Score: 0,
    tileBag: p2Deal.bag,
    turnCount: 0,
    consecutivePassCount: 0,
    gameOver: null,
    bagClosed: false,
  };
}

function extractSyncState(s: GameStore): SyncState {
  return {
    board: s.board,
    player1Rack: s.player1Rack,
    player2Rack: s.player2Rack,
    player1Score: s.player1Score,
    player2Score: s.player2Score,
    currentPlayer: s.currentPlayer,
    tileBag: s.tileBag,
    turnCount: s.turnCount,
    player1Name: s.player1Name,
    player2Name: s.player2Name,
    consecutivePassCount: s.consecutivePassCount,
    gameOver: s.gameOver,
    bagClosed: s.bagClosed,
  };
}

function applySyncState(sync: SyncState): Partial<GameStore> {
  return {
    board: sync.board,
    player1Rack: sync.player1Rack,
    player2Rack: sync.player2Rack,
    player1Score: sync.player1Score,
    player2Score: sync.player2Score,
    currentPlayer: sync.currentPlayer,
    tileBag: sync.tileBag,
    turnCount: sync.turnCount,
    player1Name: sync.player1Name ?? '',
    player2Name: sync.player2Name ?? '',
    currentTurnPlacements: {},
    turnError: null,
    pendingWildAssignment: null,
    consecutivePassCount: sync.consecutivePassCount ?? 0,
    gameOver: sync.gameOver ?? null,
    bagClosed: sync.bagClosed ?? false,
    wildRedigs: {},
  };
}

// ─── Saved-games persistence ─────────────────────────────────────────────────

const SAVED_KEY = 'ow_games';
const NAME_KEY  = 'ow_player_name';

function loadSavedGames(): SavedGame[] {
  try {
    // Migrate from the old single-game format (ow_game → ow_games)
    const legacy = localStorage.getItem('ow_game');
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (parsed?.gameId && parsed?.role) {
        const migrated: SavedGame[] = [{ gameId: parsed.gameId, role: parsed.role as Player }];
        localStorage.setItem(SAVED_KEY, JSON.stringify(migrated));
        localStorage.removeItem('ow_game');
        return migrated;
      }
    }
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? (JSON.parse(raw) as SavedGame[]) : [];
  } catch {
    return [];
  }
}

function persistSavedGames(games: SavedGame[]): void {
  localStorage.setItem(SAVED_KEY, JSON.stringify(games.slice(0, 20)));
}

function upsertSavedGame(existing: SavedGame[], gameId: string, role: Player): SavedGame[] {
  return [{ gameId, role }, ...existing.filter(g => g.gameId !== gameId)];
}

// ─── Real-time channel (module-level, one at a time) ─────────────────────────

let _channel: RealtimeChannel | null = null;

function attachChannel(ch: RealtimeChannel) {
  if (_channel) { _channel.unsubscribe(); }
  _channel = ch;
}

function detachChannel() {
  if (_channel) { _channel.unsubscribe(); _channel = null; }
}

// ─── Store helpers ───────────────────────────────────────────────────────────

function getCurrentRackSlots(state: GameStore): RackSlot[] {
  return state.currentPlayer === 'player1' ? state.player1Rack : state.player2Rack;
}

function setCurrentRack(state: GameStore, rack: RackSlot[]) {
  return state.currentPlayer === 'player1' ? { player1Rack: rack } : { player2Rack: rack };
}

// ─── Store ───────────────────────────────────────────────────────────────────

const initial = freshGameState();

export const useGameStore = create<GameStore>((set, get) => ({
  // Core game (starts fresh; replaced when a game begins)
  ...initial,
  currentTurnPlacements: {},
  turnError: null,
  pendingWildAssignment: null,
  consecutivePassCount: 0,
  gameOver: null,
  wildRedigs: {},

  // Multiplayer
  screen: 'lobby',
  gameId: null,
  myRole: null,
  myName: localStorage.getItem(NAME_KEY) ?? '',
  player1Name: '',
  player2Name: '',
  isWaitingForOpponent: false,
  syncError: null,
  savedGames: loadSavedGames(),

  // Replay
  pendingReplay: null,
  replayMode: null,
  pendingSync: null,
  replayScore: null,

  // ── Helpers ──────────────────────────────────────────────────────────────

  getCurrentRack: () => {
    const { gameId, myRole, currentPlayer, player1Rack, player2Rack } = get();
    // In online mode always show YOUR rack, not the active player's rack
    const player = (gameId && myRole) ? myRole : currentPlayer;
    return player === 'player1' ? player1Rack : player2Rack;
  },

  isCurrentTurnTile: (col, row) => `${col},${row}` in get().currentTurnPlacements,

  isMyTurn: () => {
    const { gameId, myRole, currentPlayer } = get();
    if (!gameId) return true;          // local: always your turn
    return myRole === currentPlayer;   // online: only when it's your role
  },

  // ── Tile placement ────────────────────────────────────────────────────────

  placeTile(tileId, slotIndex, col, row) {
    const state = get();
    const rack = getCurrentRackSlots(state);
    const rackTile = rack[slotIndex];
    if (!rackTile || rackTile.id !== tileId) return;

    const cell = state.board[row][col];
    const key = `${col},${row}`;
    const existingPlacement = state.currentTurnPlacements[key];

    // ── Replacement guards ────────────────────────────────────────────────────
    if (cell.tile) {
      // Settled wild tiles can only be re-designated (tap them) — never physically replaced.
      if (cell.tile.isWild && !existingPlacement) {
        set({ turnError: "Wild tiles can't be replaced — tap to re-designate." });
        return;
      }
      // Placing the same letter on a cell that already shows that letter is a no-op.
      if (!rackTile.isWild && !cell.tile.isWild && cell.tile.letter === rackTile.letter) {
        set({ turnError: "Can't place the same letter here." });
        return;
      }
    }

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

    // Revert any wild tile re-designations made this turn
    for (const [key, originalLetter] of Object.entries(state.wildRedigs)) {
      const [col, row] = key.split(',').map(Number);
      const cell = newBoard[row][col];
      if (cell.tile) {
        newBoard[row][col] = { ...cell, tile: { ...cell.tile, wildLetter: originalLetter } };
      }
    }

    set({ board: newBoard, currentTurnPlacements: {}, pendingWildAssignment: null, turnError: null, wildRedigs: {}, ...setCurrentRack(state, newRack) });
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
    const { pendingWildAssignment, currentTurnPlacements, board, wildRedigs } = state;
    if (!pendingWildAssignment) return;
    const { col, row, isRedesig } = pendingWildAssignment;
    const key = `${col},${row}`;

    if (isRedesig) {
      // Re-designation: just close the picker without touching the board.
      // beginWildRedesig doesn't change the board — only assignWildLetter does.
      const newRedigs = { ...wildRedigs };
      delete newRedigs[key];
      set({ pendingWildAssignment: null, wildRedigs: newRedigs });
      return;
    }

    // New placement: remove the tile and return it to the rack
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

  beginWildRedesig(col: number, row: number) {
    const { board, wildRedigs, isMyTurn } = get();
    if (!isMyTurn()) return;
    const cell = board[row][col];
    if (!cell.tile?.isWild) return;
    const key = `${col},${row}`;
    // Preserve the very first original letter so Reset Turn can always fully revert
    const original = wildRedigs[key] ?? (cell.tile.wildLetter ?? '');
    set({
      pendingWildAssignment: { col, row, isRedesig: true },
      wildRedigs: { ...wildRedigs, [key]: original },
    });
  },

  async endTurn() {
    const state = get();
    const { board, currentTurnPlacements, currentPlayer, tileBag, turnCount, gameId, bagClosed } = state;

    const result = validatePlacement(board, currentTurnPlacements, turnCount === 0);
    if (!result.valid) {
      set({ turnError: result.error ?? 'Invalid placement.' });
      return;
    }

    await loadDictionary();
    const newWords = extractNewWords(board, currentTurnPlacements);
    for (const word of newWords) {
      if (word.containsWild) continue;
      if (!isValidWord(word.letters)) {
        set({ turnError: `Not a word: ${word.letters.toUpperCase()}` });
        return;
      }
    }

    // Board Buster: any new word spanning the full board width or height earns +3 extra tiles.
    const isBoardBuster = newWords.some(w => w.letters.length >= BOARD_WIDTH);

    const newBoard: BoardState = board.map(r => r.map(c => ({ ...c })));
    let bonusTilesEarned = isBoardBuster ? 3 : 0;
    for (const key of Object.keys(currentTurnPlacements)) {
      const [col, row] = key.split(',').map(Number);
      const cell = newBoard[row][col];
      if (cell.bonus && !cell.bonusUsed) {
        newBoard[row][col] = { ...cell, bonusUsed: true };
        bonusTilesEarned += cell.bonus;
      }
    }

    const confiscated = findConfiscatedCells(newBoard, currentTurnPlacements, newWords);

    // Build replay data — capture fromOwner BEFORE applying confiscation to newBoard
    const replayConfiscated: ReplayConfiscation[] = confiscated
      .filter(({ col, row }) => newBoard[row][col].tile?.owner !== currentPlayer)
      .map(({ col, row }) => ({ col, row, fromOwner: newBoard[row][col].tile!.owner }));

    for (const { col, row } of confiscated) {
      const cell = newBoard[row][col];
      if (cell.tile && cell.tile.owner !== currentPlayer) {
        newBoard[row][col] = { ...cell, tile: { ...cell.tile, owner: currentPlayer } };
      }
    }

    // Tiles displaced from the board this turn (replacements) must return to the bag.
    const replacedLetters: string[] = [];
    for (const placement of Object.values(currentTurnPlacements)) {
      if (placement.replacedTile) {
        replacedLetters.push(placement.replacedTile.isWild ? '*' : placement.replacedTile.letter);
      }
    }

    const currentRack = getCurrentRackSlots(state);

    let finalRack: RackSlot[];
    let finalBag: string[];

    if (bagClosed) {
      // Bag is closed: compact the rack (remove null slots) but draw nothing.
      // Replaced tiles leave play permanently — they're in the supply but can't be redrawn.
      finalRack = currentRack.filter((s): s is RackTile => s !== null);
      finalBag = [...tileBag]; // unchanged; replaced tiles exit the game
    } else {
      // Normal phase: shuffle replaced tiles back into the bag at random positions,
      // then refill the rack to STARTING_RACK_SIZE, then draw any bonus tiles.
      const bagWithReturned = [...tileBag];
      for (const letter of replacedLetters) {
        const pos = Math.floor(Math.random() * (bagWithReturned.length + 1));
        bagWithReturned.splice(pos, 0, letter);
      }
      const refilled = refillRack(currentRack, bagWithReturned);
      finalRack = [...refilled.rack];
      finalBag = [...refilled.bag];

      // Draw bonus tiles (Board Buster + bonus spaces) up to MAX_RACK_SIZE
      const filledNow = finalRack.filter(s => s !== null).length;
      const canDraw   = Math.max(0, MAX_RACK_SIZE - filledNow);
      const toDraw    = Math.min(bonusTilesEarned, canDraw);
      for (let i = 0; i < toDraw; i++) {
        if (finalBag.length > 0) {
          const letter = finalBag.pop()!;
          finalRack.push({ id: makeTileId(), letter, isWild: letter === '*' });
        }
      }
    }

    // Bag closes the moment it runs dry after drawing
    const newBagClosed = bagClosed || finalBag.length === 0;

    // Build boardBefore: revert placements from `board` (pre-bonus-processing)
    const boardBefore: BoardState = board.map(r => r.map(c => ({ ...c })));
    for (const [key, placement] of Object.entries(currentTurnPlacements)) {
      const [col, row] = key.split(',').map(Number);
      boardBefore[row][col] = { ...boardBefore[row][col], tile: placement.replacedTile };
    }

    const replayPlacements: ReplayPlacement[] = Object.entries(currentTurnPlacements).map(([key, p]) => {
      const [col, row] = key.split(',').map(Number);
      return { col, row, letter: p.letter, isWild: p.isWild, wildLetter: board[row][col].tile?.wildLetter };
    });

    const replay: TurnReplay = {
      player: currentPlayer,
      placements: replayPlacements,
      confiscated: replayConfiscated,
      boardBefore,
    };

    const scores = countScore(newBoard);
    const nextPlayer: Player = currentPlayer === 'player1' ? 'player2' : 'player1';
    const rackUpdate = currentPlayer === 'player1'
      ? { player1Rack: finalRack }
      : { player2Rack: finalRack };

    // Game over if the active player emptied their rack (bag must be empty too —
    // if the bag had tiles, refillRack would have filled them back up).
    const rackIsEmpty = finalRack.every(slot => slot === null);
    const gameOverState: GameOverState | null = rackIsEmpty ? {
      winner: scores.player1 > scores.player2 ? 'player1'
            : scores.player2 > scores.player1 ? 'player2'
            : null,
      reason: 'rack-empty',
      player1Score: scores.player1,
      player2Score: scores.player2,
    } : null;

    set({
      board: newBoard,
      currentTurnPlacements: {},
      currentPlayer: nextPlayer,
      tileBag: finalBag,
      turnCount: turnCount + 1,
      turnError: null,
      player1Score: scores.player1,
      player2Score: scores.player2,
      consecutivePassCount: 0,   // valid turn resets pass streak
      gameOver: gameOverState,
      bagClosed: newBagClosed,
      wildRedigs: {},            // redesigs committed — nothing to revert
      ...rackUpdate,
    });

    // Push to Supabase after a successful turn (online mode only)
    if (gameId) {
      const syncToSave: SyncState = { ...extractSyncState(get()), lastTurnReplay: replay };
      pushState(gameId, syncToSave).catch(() => {
        set({ syncError: 'Turn saved locally but failed to sync. Your opponent may not see it.' });
      });
    }
  },

  passTurn() {
    const state = get();
    const { currentTurnPlacements, currentPlayer, turnCount, consecutivePassCount, gameId,
            player1Score, player2Score } = state;

    // Recall any tiles the player may have placed before deciding to pass
    const newBoard: BoardState = state.board.map(r => r.map(c => ({ ...c })));
    const newRack = [...getCurrentRackSlots(state)];
    for (const [key, placement] of Object.entries(currentTurnPlacements)) {
      const [col, row] = key.split(',').map(Number);
      newBoard[row][col] = { ...newBoard[row][col], tile: placement.replacedTile };
      newRack[placement.rackSlotIndex] = {
        id: placement.rackTileId,
        letter: placement.letter,
        isWild: placement.isWild,
      };
    }

    const newPassCount = consecutivePassCount + 1;
    const nextPlayer: Player = currentPlayer === 'player1' ? 'player2' : 'player1';

    // Two consecutive passes ends the game
    const gameOverState: GameOverState | null = newPassCount >= 2 ? {
      winner: player1Score > player2Score ? 'player1'
            : player2Score > player1Score ? 'player2'
            : null,
      reason: 'consecutive-passes',
      player1Score,
      player2Score,
    } : null;

    set({
      board: newBoard,
      currentTurnPlacements: {},
      pendingWildAssignment: null,
      turnError: null,
      consecutivePassCount: newPassCount,
      currentPlayer: nextPlayer,
      turnCount: turnCount + 1,
      gameOver: gameOverState,
      ...setCurrentRack(state, newRack),
    });

    if (gameId) {
      const syncToSave: SyncState = { ...extractSyncState(get()), lastTurnWasPass: true };
      pushState(gameId, syncToSave).catch(() => {
        set({ syncError: 'Pass saved locally but failed to sync.' });
      });
    }
  },

  resign() {
    const state = get();
    const { gameId, myRole, currentPlayer, player1Score, player2Score } = state;

    // In online mode the resigning player is myRole; locally it's currentPlayer
    const resigningPlayer: Player = (gameId && myRole) ? myRole : currentPlayer;
    const winner: Player = resigningPlayer === 'player1' ? 'player2' : 'player1';

    const gameOverState: GameOverState = {
      winner,
      reason: 'resignation',
      player1Score,
      player2Score,
    };

    set({ gameOver: gameOverState });

    if (gameId) {
      // Push so the opponent also sees the game-over screen
      pushState(gameId, extractSyncState(get())).catch(() => {
        set({ syncError: 'Resign failed to sync — opponent may not be notified.' });
      });
    }
  },

  // ── Multiplayer actions ───────────────────────────────────────────────────

  startLocalGame() {
    detachChannel();
    const fresh = freshGameState();
    set({
      ...fresh,
      currentTurnPlacements: {},
      turnError: null,
      pendingWildAssignment: null,
      screen: 'playing',
      gameId: null,
      myRole: null,
      isWaitingForOpponent: false,
      syncError: null,
      pendingReplay: null,
      replayMode: null,
      pendingSync: null,
      replayScore: null,
      wildRedigs: {},
      bagClosed: false,
    });
  },

  async createOnlineGame() {
    const fresh = freshGameState();
    const syncState: SyncState = { ...fresh, player1Name: get().myName };

    const gameId = await createGame(syncState);

    set({
      ...fresh,
      currentTurnPlacements: {},
      turnError: null,
      pendingWildAssignment: null,
      gameId,
      myRole: 'player1',
      isWaitingForOpponent: true,
      syncError: null,
      // Stay on lobby screen until opponent joins
    });

    const newSaved = upsertSavedGame(get().savedGames, gameId, 'player1');
    set({ savedGames: newSaved });
    persistSavedGames(newSaved);

    attachChannel(subscribeToGame(gameId, (row) => get().applyRemoteRow(row)));

    return gameId;
  },

  async joinOnlineGame(code: string) {
    const syncState = await joinGame(code, get().myName);
    const gameId = code.toUpperCase().trim();

    set({
      ...applySyncState(syncState),
      gameId,
      myRole: 'player2',
      isWaitingForOpponent: false,
      syncError: null,
      screen: 'playing',
    });

    const newSaved = upsertSavedGame(get().savedGames, gameId, 'player2');
    set({ savedGames: newSaved });
    persistSavedGames(newSaved);

    attachChannel(subscribeToGame(gameId, (row) => get().applyRemoteRow(row)));
  },

  async resumeGame(gameId, role) {
    const data = await getGame(gameId);
    if (!data) throw new Error('Game not found — it may have expired.');

    if (data.player2_joined) {
      const hasReplay = !!data.state.lastTurnReplay && data.state.currentPlayer === role;

      if (hasReplay) {
        // Opponent played while we were away. Show the same banner experience as the live
        // case: set the board to boardBefore so the pre-turn state is visible, hold the
        // final result in pendingSync, and wait for the user to choose Watch or Play now.
        const replayData = data.state.lastTurnReplay!;
        const preScore = countScore(replayData.boardBefore);
        set({
          ...applySyncState(data.state),      // racks, tileBag, turnCount…
          board: replayData.boardBefore,      // pre-turn board — don't spoil the result
          player1Score: preScore.player1,     // pre-turn scores
          player2Score: preScore.player2,
          currentPlayer: replayData.player,  // who just played (so isMyTurn() = false)
          gameId,
          myRole: role,
          isWaitingForOpponent: false,
          syncError: null,
          screen: 'playing',
          pendingReplay: replayData,
          replayMode: 'banner',              // same flow as live update
          pendingSync: data.state,           // applied when user dismisses replay
        });
      } else {
        set({
          ...applySyncState(data.state),
          gameId,
          myRole: role,
          isWaitingForOpponent: false,
          syncError: null,
          screen: 'playing',
          pendingReplay: null,
          replayMode: null,
          pendingSync: null,
        });
      }
    } else {
      // Still waiting for opponent — restore waiting state, stay on lobby
      set({
        ...applySyncState(data.state),
        gameId,
        myRole: role,
        isWaitingForOpponent: true,
        syncError: null,
        screen: 'lobby',
        pendingReplay: null,
        replayMode: null,
        pendingSync: null,
      });
    }

    attachChannel(subscribeToGame(gameId, (row) => get().applyRemoteRow(row)));
  },

  removeSavedGame(gameId) {
    const newSaved = get().savedGames.filter(g => g.gameId !== gameId);
    set({ savedGames: newSaved });
    persistSavedGames(newSaved);
  },

  setPlayerName(name) {
    localStorage.setItem(NAME_KEY, name);
    const { gameId, myRole } = get();
    // Also update the in-game name field so the opponent sees it immediately
    const nameField = myRole === 'player1'
      ? { player1Name: name }
      : myRole === 'player2'
        ? { player2Name: name }
        : {};
    set({ myName: name, ...nameField });
    // Push to Supabase if currently in an active online game
    if (gameId && myRole) {
      pushState(gameId, extractSyncState(get())).catch(() => {});
    }
  },

  startPlayingNow() {
    set({ screen: 'playing' });
  },

  applyRemoteRow(row) {
    const { isWaitingForOpponent, turnCount, myRole, screen } = get();
    const update: Partial<GameStore> = {};

    // Player 1 sees opponent connect → start the game
    if (isWaitingForOpponent && row.player2_joined) {
      update.isWaitingForOpponent = false;
      update.screen = 'playing';
    }

    // Apply opponent's committed turn (ignore our own echo via turnCount guard)
    if (row.state.turnCount > turnCount) {
      if (row.state.gameOver) {
        // Game ended — apply directly (no replay needed)
        Object.assign(update, applySyncState(row.state));
      } else if (!row.state.lastTurnWasPass && screen === 'playing'
          && row.state.lastTurnReplay && row.state.currentPlayer === myRole) {
        // Opponent played tiles while our game screen is open — hold state, show replay banner
        update.pendingReplay = row.state.lastTurnReplay;
        update.replayMode = 'banner';
        update.pendingSync = row.state;
      } else {
        // Pass, or no replay data — apply immediately
        Object.assign(update, applySyncState(row.state));
      }
    }

    // Catch game-over pushed without a turn change (e.g. resignation arriving out of band)
    if (row.state.gameOver && !get().gameOver) {
      update.gameOver = row.state.gameOver;
    }

    if (Object.keys(update).length > 0) set(update as GameStore);
  },

  resetToLobby() {
    detachChannel();
    set({
      screen: 'lobby',
      gameId: null,
      myRole: null,
      isWaitingForOpponent: false,
      syncError: null,
      turnError: null,
      currentTurnPlacements: {},
      pendingWildAssignment: null,
      pendingReplay: null,
      replayMode: null,
      pendingSync: null,
      replayScore: null,
      consecutivePassCount: 0,
      gameOver: null,
      bagClosed: false,
      wildRedigs: {},
    });
  },

  watchReplay() {
    set({ replayMode: 'watching' });
  },

  dismissReplay() {
    const { pendingSync } = get();
    const clearReplay = { pendingReplay: null, replayMode: null, pendingSync: null, replayScore: null };
    if (pendingSync) {
      set({ ...applySyncState(pendingSync), ...clearReplay });
    } else {
      set(clearReplay);
    }
  },

  setReplayScore(score) {
    set({ replayScore: score });
  },
}));
