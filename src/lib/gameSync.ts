/**
 * Supabase database operations for online multiplayer.
 *
 * Schema (run once in Supabase SQL editor):
 *
 *   create table if not exists games (
 *     id              text        primary key,
 *     state           jsonb       not null,
 *     player1_joined  boolean     not null default false,
 *     player2_joined  boolean     not null default false,
 *     created_at      timestamptz not null default now(),
 *     updated_at      timestamptz not null default now()
 *   );
 *   alter table games enable row level security;
 *   create policy "Public game access" on games for all to anon
 *     using (true) with check (true);
 *   alter publication supabase_realtime add table games;
 */

import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { SyncState } from '../store/gameStore';

// Unambiguous characters only — no 0/O/1/I/L
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

// ─── Database operations ─────────────────────────────────────────────────────

/** Create a new game row and return the join code. */
export async function createGame(initialState: SyncState): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = generateCode();
    const { error } = await supabase.from('games').insert({
      id,
      state: initialState,
      player1_joined: true,
      player2_joined: false,
    });
    if (!error) return id;
    // Retry only on duplicate key — bail on anything else
    if (!error.message.includes('duplicate') && !error.message.includes('unique')) throw error;
  }
  throw new Error('Failed to create game. Please try again.');
}

/** Join an existing game by code. Returns the updated game state (with player2Name set). */
export async function joinGame(code: string, player2Name: string): Promise<SyncState> {
  const id = code.toUpperCase().trim();

  const { data, error } = await supabase
    .from('games')
    .select('state, player1_joined, player2_joined')
    .eq('id', id)
    .single();

  if (error || !data) throw new Error('Game not found. Double-check your code.');
  if (!data.player1_joined) throw new Error('Game is not ready yet.');
  if (data.player2_joined) throw new Error('This game already has two players.');

  const updatedState: SyncState = { ...(data.state as SyncState), player2Name };

  const { error: joinErr } = await supabase
    .from('games')
    .update({ player2_joined: true, state: updatedState })
    .eq('id', id);

  if (joinErr) throw new Error('Failed to join. Please try again.');

  return updatedState;
}

/** Push committed game state after a turn ends. */
export async function pushState(gameId: string, state: SyncState): Promise<void> {
  const { error } = await supabase
    .from('games')
    .update({ state, updated_at: new Date().toISOString() })
    .eq('id', gameId);
  if (error) throw error;
}

// ─── Real-time subscription ──────────────────────────────────────────────────

export interface GameRow {
  state: SyncState;
  player2_joined: boolean;
  updated_at?: string;
}

/** Fetch current row for a game. Returns null if not found or on error. */
export async function getGame(
  gameId: string,
): Promise<GameRow | null> {
  const { data, error } = await supabase
    .from('games')
    .select('state, player2_joined, updated_at')
    .eq('id', gameId)
    .single();
  if (error || !data) return null;
  return data as GameRow;
}

/** Subscribe to game updates. Returns the channel for later cleanup. */
export function subscribeToGame(
  gameId: string,
  onUpdate: (row: GameRow) => void,
): RealtimeChannel {
  let subscribedOnce = false;

  return supabase
    .channel(`game-${gameId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
      (payload) => onUpdate(payload.new as GameRow),
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (subscribedOnce) {
          // Reconnected after a drop — fetch current DB row immediately to
          // catch any update that arrived while the WebSocket was down.
          getGame(gameId).then(row => { if (row) onUpdate(row); });
        }
        subscribedOnce = true;
      }
    });
}
