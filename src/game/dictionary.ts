// ─── Dictionary ──────────────────────────────────────────────────────────────
// Loads enable1.txt (172 k words) once on first call; all subsequent calls
// resolve immediately from the cached Set.

let wordSet: Set<string> | null = null;
let loadPromise: Promise<Set<string>> | null = null;

export async function loadDictionary(): Promise<Set<string>> {
  if (wordSet) return wordSet;
  if (loadPromise) return loadPromise;

  loadPromise = fetch('/words.txt')
    .then(r => r.text())
    .then(text => {
      wordSet = new Set(text.trim().split('\n').map(w => w.trim().toLowerCase()));
      return wordSet;
    });

  return loadPromise;
}

/** Synchronous check — only call after loadDictionary() has resolved. */
export function isValidWord(word: string): boolean {
  if (!wordSet) return true; // permissive while loading
  return wordSet.has(word.toLowerCase());
}

export function isDictionaryReady(): boolean {
  return wordSet !== null;
}
