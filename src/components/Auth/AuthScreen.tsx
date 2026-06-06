import './AuthScreen.css';
import { useState, useRef, type FormEvent } from 'react';
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  sendPasswordReset,
  updateDisplayName,
} from '../../lib/auth';

type AuthView = 'sign-in' | 'sign-up' | 'set-name' | 'forgot-password' | 'reset-sent';

interface Props {
  /** Jump straight to set-name after OAuth sign-in with no display name yet. */
  initialView?: AuthView;
}

// ─── Google wordmark SVG ──────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg className="auth-google-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

export function AuthScreen({ initialView = 'sign-in' }: Props) {
  const [view, setView]         = useState<AuthView>(initialView);
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);
  const [sentTo, setSentTo]     = useState('');

  // Controlled field values
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  const nameRef = useRef<HTMLInputElement>(null);

  function clearError() { setError(''); }

  function switchTo(next: AuthView) {
    setError('');
    setView(next);
    // Focus name field when switching to set-name
    if (next === 'set-name') {
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }

  // ── Sign in ──────────────────────────────────────────────────────────────
  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true); clearError();
    try {
      await signInWithEmail(email, password);
      // onAuthStateChange in useAuth handles the rest
    } catch (err: unknown) {
      setError(err instanceof Error ? friendlyError(err.message) : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  // ── Sign up ──────────────────────────────────────────────────────────────
  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Enter your display name.'); return; }
    setBusy(true); clearError();
    try {
      await signUpWithEmail(email, password, name.trim());
      // Supabase signs them in immediately (email confirm disabled for playtesting)
    } catch (err: unknown) {
      setError(err instanceof Error ? friendlyError(err.message) : 'Sign up failed.');
    } finally {
      setBusy(false);
    }
  }

  // ── Google ───────────────────────────────────────────────────────────────
  async function handleGoogle() {
    setBusy(true); clearError();
    try {
      await signInWithGoogle();
      // Page redirects — execution stops here
    } catch (err: unknown) {
      setError(err instanceof Error ? friendlyError(err.message) : 'Google sign-in failed.');
      setBusy(false);
    }
  }

  // ── Set display name (post-OAuth) ─────────────────────────────────────────
  async function handleSetName(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Enter your display name.'); return; }
    setBusy(true); clearError();
    try {
      await updateDisplayName(name.trim());
      // useAuth will re-render with updated user_metadata — no navigation needed
    } catch (err: unknown) {
      setError(err instanceof Error ? friendlyError(err.message) : 'Failed to save name.');
    } finally {
      setBusy(false);
    }
  }

  // ── Password reset ────────────────────────────────────────────────────────
  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true); clearError();
    try {
      await sendPasswordReset(email);
      setSentTo(email);
      setView('reset-sent');
    } catch (err: unknown) {
      setError(err instanceof Error ? friendlyError(err.message) : 'Failed to send reset link.');
    } finally {
      setBusy(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="auth-screen">
      <div className="auth-card">

        {/* Wordmark */}
        <div className="auth-wordmark">OTHERWORDS</div>

        {/* ── Sign in ───────────────────────────────────────────────── */}
        {view === 'sign-in' && (
          <>
            <h2 className="auth-title">Welcome back</h2>

            <button className="auth-google-btn" onClick={handleGoogle} disabled={busy} type="button">
              <GoogleIcon />
              Continue with Google
            </button>

            <div className="auth-divider"><span>or</span></div>

            <form className="auth-form" onSubmit={handleSignIn} noValidate>
              <label className="auth-label">
                Email
                <input
                  className="auth-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); clearError(); }}
                  required
                  disabled={busy}
                />
              </label>
              <label className="auth-label">
                Password
                <input
                  className="auth-input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); clearError(); }}
                  required
                  disabled={busy}
                />
              </label>
              {error && <p className="auth-error">{error}</p>}
              <button className="auth-submit" type="submit" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <div className="auth-links">
              <button className="auth-link" onClick={() => switchTo('forgot-password')} type="button">
                Forgot password?
              </button>
              <button className="auth-link" onClick={() => switchTo('sign-up')} type="button">
                New player — create account
              </button>
            </div>
          </>
        )}

        {/* ── Sign up ───────────────────────────────────────────────── */}
        {view === 'sign-up' && (
          <>
            <h2 className="auth-title">Create account</h2>

            <button className="auth-google-btn" onClick={handleGoogle} disabled={busy} type="button">
              <GoogleIcon />
              Continue with Google
            </button>

            <div className="auth-divider"><span>or</span></div>

            <form className="auth-form" onSubmit={handleSignUp} noValidate>
              <label className="auth-label">
                Your name
                <input
                  className="auth-input"
                  type="text"
                  autoComplete="nickname"
                  placeholder="How opponents see you"
                  value={name}
                  onChange={e => { setName(e.target.value); clearError(); }}
                  maxLength={24}
                  required
                  disabled={busy}
                  autoFocus
                />
              </label>
              <label className="auth-label">
                Email
                <input
                  className="auth-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); clearError(); }}
                  required
                  disabled={busy}
                />
              </label>
              <label className="auth-label">
                Password
                <input
                  className="auth-input"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); clearError(); }}
                  minLength={6}
                  required
                  disabled={busy}
                />
              </label>
              {error && <p className="auth-error">{error}</p>}
              <button className="auth-submit" type="submit" disabled={busy}>
                {busy ? 'Creating account…' : 'Create Account'}
              </button>
            </form>

            <div className="auth-links">
              <button className="auth-link" onClick={() => switchTo('sign-in')} type="button">
                Already have an account — sign in
              </button>
            </div>
          </>
        )}

        {/* ── Set display name (post-OAuth) ─────────────────────────── */}
        {view === 'set-name' && (
          <>
            <h2 className="auth-title">What should we call you?</h2>
            <p className="auth-subtitle">This is how opponents will see you in-game.</p>

            <form className="auth-form" onSubmit={handleSetName} noValidate>
              <label className="auth-label">
                Your name
                <input
                  className="auth-input"
                  type="text"
                  autoComplete="nickname"
                  placeholder="e.g. Alex"
                  value={name}
                  onChange={e => { setName(e.target.value); clearError(); }}
                  maxLength={24}
                  required
                  disabled={busy}
                  ref={nameRef}
                  autoFocus
                />
              </label>
              {error && <p className="auth-error">{error}</p>}
              <button className="auth-submit" type="submit" disabled={busy || !name.trim()}>
                {busy ? 'Saving…' : "Let's play"}
              </button>
            </form>
          </>
        )}

        {/* ── Forgot password ───────────────────────────────────────── */}
        {view === 'forgot-password' && (
          <>
            <h2 className="auth-title">Reset password</h2>
            <p className="auth-subtitle">We'll send a reset link to your email.</p>

            <form className="auth-form" onSubmit={handleForgotPassword} noValidate>
              <label className="auth-label">
                Email
                <input
                  className="auth-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); clearError(); }}
                  required
                  disabled={busy}
                  autoFocus
                />
              </label>
              {error && <p className="auth-error">{error}</p>}
              <button className="auth-submit" type="submit" disabled={busy}>
                {busy ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            <div className="auth-links">
              <button className="auth-link" onClick={() => switchTo('sign-in')} type="button">
                Back to sign in
              </button>
            </div>
          </>
        )}

        {/* ── Reset link sent ───────────────────────────────────────── */}
        {view === 'reset-sent' && (
          <>
            <h2 className="auth-title">Check your email</h2>
            <p className="auth-subtitle">
              We sent a password reset link to <strong>{sentTo}</strong>.
              It expires in 1 hour.
            </p>
            <div className="auth-links">
              <button className="auth-link" onClick={() => switchTo('sign-in')} type="button">
                Back to sign in
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

// ─── Error message cleanup ────────────────────────────────────────────────────

function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials')) {
    return 'Incorrect email or password.';
  }
  if (m.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.';
  }
  if (m.includes('already registered') || m.includes('already exists') || m.includes('user already')) {
    return 'An account with that email already exists.';
  }
  if (m.includes('password') && m.includes('short')) {
    return 'Password must be at least 6 characters.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Too many attempts — please wait a moment.';
  }
  if (m.includes('network') || m.includes('fetch')) {
    return 'Connection error — check your internet and try again.';
  }
  return msg;
}
