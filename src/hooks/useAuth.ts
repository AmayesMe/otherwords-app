import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  loading: boolean;
}

/**
 * Returns the current authenticated user and a loading flag.
 * Subscribes to Supabase's onAuthStateChange so it stays in sync
 * across tab-focus, token refresh, and OAuth redirects.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    // Resolve the initial session (catches OAuth redirects too)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({ user: session?.user ?? null, loading: false });
    });

    // Keep in sync with future auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, loading: false });
    });

    return () => subscription.unsubscribe();
  }, []);

  return state;
}
