/**
 * Auth helpers — thin wrappers around Supabase Auth.
 *
 * Display names are stored in user_metadata.display_name.
 * No separate profiles table needed for Phase 1.
 */

import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

// ─── Display name ─────────────────────────────────────────────────────────────

/** Best available display name for the authenticated user. */
export function getDisplayName(user: User): string {
  return (
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||        // Google sometimes sends this
    user.user_metadata?.name ||             // Apple sometimes sends this
    user.email?.split('@')[0] ||
    'Player'
  );
}

/** True if the user has explicitly set a display name (not inferred from email). */
export function hasDisplayName(user: User): boolean {
  return !!(user.user_metadata?.display_name);
}

// ─── Email / password ─────────────────────────────────────────────────────────

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user!;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<User> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) throw error;
  if (!data.user) throw new Error('Sign-up failed — please try again.');
  return data.user;
}

// ─── OAuth ────────────────────────────────────────────────────────────────────

export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function updateDisplayName(name: string): Promise<User> {
  const { data, error } = await supabase.auth.updateUser({
    data: { display_name: name.trim() },
  });
  if (error) throw error;
  return data.user!;
}

// ─── Password reset ───────────────────────────────────────────────────────────

export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
}

// ─── Session ─────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
