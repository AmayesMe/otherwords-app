let _ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!_ctx) {
      const Ctor = window.AudioContext
        ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      _ctx = new Ctor();
    }
    return _ctx;
  } catch {
    return null;
  }
}

export function resumeAudio(): void {
  const c = getCtx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

function note(freq: number, offsetSec: number, durSec: number, vol = 0.3, type: OscillatorType = 'sine'): void {
  const c = getCtx();
  if (!c) return;
  try {
    const t = c.currentTime + offsetSec;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + durSec);
    osc.start(t);
    osc.stop(t + durSec + 0.05);
  } catch { /* audio not supported */ }
}

/** Two ascending chime notes — hint letter revealed */
export function sfxHintGiven(): void {
  note(880,  0,    0.12, 0.22);
  note(1109, 0.1,  0.18, 0.28);
}

/** Short triumphant arpeggio — clue word found */
export function sfxWordFound(): void {
  note(523, 0,   0.14, 0.32);
  note(659, 0.1, 0.14, 0.32);
  note(784, 0.2, 0.28, 0.38);
}

/** Single soft ding — bonus dictionary word found (legacy, prefer sfxBonusLetters) */
export function sfxBonusWord(): void {
  note(660, 0, 0.12, 0.18);
}

/** Ascending ding sequence — one note per letter in a found bonus word */
export function sfxBonusLetters(count: number): void {
  for (let i = 0; i < count; i++) {
    // One semitone per letter, starting at A4 (440 Hz)
    note(440 * Math.pow(2, i / 12), i * 0.11, 0.09, 0.20, 'sine');
  }
}

/** Victory arpeggio — correct answer */
export function sfxCorrectAnswer(): void {
  note(523,  0,   0.18, 0.38);
  note(659,  0.1, 0.18, 0.38);
  note(784,  0.2, 0.18, 0.38);
  note(1047, 0.3, 0.35, 0.42);
}

/** Low descending buzz — wrong answer */
export function sfxWrongAnswer(): void {
  note(220, 0,   0.12, 0.28, 'sawtooth');
  note(185, 0.1, 0.18, 0.18, 'sawtooth');
}

/** Brief soft tap — selection not found */
export function sfxNotFound(): void {
  note(330, 0, 0.07, 0.10, 'triangle');
}
