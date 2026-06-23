import './WordSearchGame.css';
import { useEffect, useRef, useState } from 'react';
import { useWordSearchStore, DEFAULT_OPTIONS } from '../../store/wordSearchStore';
import { useGameStore } from '../../store/gameStore';
import { cellKey, MIN_GRID_SIZE, MAX_GRID_SIZE } from '../../wordSearch/gridGenerator';
import type { WordSearchOptions } from '../../store/wordSearchStore';
import type { CellCoord, PuzzleType } from '../../wordSearch/types';
import {
  resumeAudio, sfxHintGiven, sfxWordFound, sfxBonusLetters,
  sfxCorrectAnswer, sfxWrongAnswer, sfxNotFound,
} from '../../wordSearch/sounds';

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function pillPath(x1: number, y1: number, x2: number, y2: number, r: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len === 0) {
    return `M ${x1 - r},${y1} A ${r},${r},0,1,0,${x1 + r},${y1} A ${r},${r},0,1,0,${x1 - r},${y1} Z`;
  }
  const nx = (-dy / len) * r;
  const ny = (dx / len) * r;
  return [
    `M ${x1 + nx},${y1 + ny}`,
    `A ${r},${r},0,0,1,${x1 - nx},${y1 - ny}`,
    `L ${x2 - nx},${y2 - ny}`,
    `A ${r},${r},0,0,1,${x2 + nx},${y2 + ny}`,
    'Z',
  ].join(' ');
}

/** Maps clue position i → index in uniqueHiddenWords (handles duplicates). Returns -1 if not tracked. */
function clueWordIdx(clueWords: string[], hidden: string[], i: number): number {
  const upper = clueWords[i].toUpperCase().replace(/[^A-Z]/g, '');
  if (upper.length < 3) return -1;
  let occurrence = 0;
  for (let j = 0; j < i; j++) {
    if (clueWords[j].toUpperCase().replace(/[^A-Z]/g, '') === upper) occurrence++;
  }
  let count = 0;
  for (let j = 0; j < hidden.length; j++) {
    if (hidden[j] === upper) {
      if (count === occurrence) return j;
      count++;
    }
  }
  return -1;
}

export function WordSearchGame() {
  const {
    puzzle, grid, placements, uniqueHiddenWords, gridSize, options,
    foundWordIndices, foundWordCells, revealedOriginalCells,
    bonusCells, bonusSelections, bonusPoints, hintsUsed, hintedLetters,
    isSelecting, selectionCells, answerError, gameWon, startTime,
    answerSubmitted, clueBonus, wordsRevealedAtAnswer, timeBonus, guessLockoutEnd,
    startPuzzle, startSelecting, updateSelection, endSelection,
    buyHint, submitAnswer, clearError,
  } = useWordSearchStore();

  const resetToLobby = useGameStore(s => s.resetToLobby);

  const [answer, setAnswer] = useState('');
  const [localOptions, setLocalOptions] = useState<WordSearchOptions>({ ...DEFAULT_OPTIONS, ...options });
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [lockoutSecsLeft, setLockoutSecsLeft] = useState(0);
  const [showAnswerModal, setShowAnswerModal] = useState(false);
  const [showIntroModal, setShowIntroModal] = useState(false);
  const [introDontShowAgain, setIntroDontShowAgain] = useState(true);

  // Fanfare & cell flash
  const [fanfareIdx, setFanfareIdx]         = useState<number | null>(null);
  const [justFoundCells, setJustFoundCells] = useState(new Set<number>());
  const [hintRevealPos, setHintRevealPos]   = useState<{ wi: number; li: number } | null>(null);

  // Refs for change-detection
  const gridRef                  = useRef<HTMLDivElement>(null);
  const errorTimerRef            = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevFoundIndicesRef      = useRef(new Set<number>());
  const prevHintedLettersRef     = useRef(new Map<number, Set<number>>());
  const prevAnswerSubmittedRef   = useRef(false);

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!started || gameWon || !startTime) return;
    const id = setInterval(() => setElapsed(Date.now() - startTime), 500);
    return () => clearInterval(id);
  }, [started, gameWon, startTime]);

  // ── Lockout countdown ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!guessLockoutEnd) { setLockoutSecsLeft(0); return; }
    const update = () => setLockoutSecsLeft(Math.max(0, Math.ceil((guessLockoutEnd - Date.now()) / 1000)));
    update();
    const id = setInterval(update, 200);
    return () => clearInterval(id);
  }, [guessLockoutEnd]);

  // ── Correct answer transition ──────────────────────────────────────────────
  useEffect(() => {
    if (answerSubmitted && !prevAnswerSubmittedRef.current) {
      setShowAnswerModal(true);
      setAnswer('');
      if (useWordSearchStore.getState().options.soundEnabled) sfxCorrectAnswer();
    }
    prevAnswerSubmittedRef.current = answerSubmitted;
  }, [answerSubmitted]); // eslint-disable-line

  // ── Auto-hint: fires when accumulated points cover another hint cost ─────────
  useEffect(() => {
    if (!started || gameWon) return;
    const hasTargets = uniqueHiddenWords.some((_, wi) => !foundWordIndices.has(wi));
    const available  = bonusPoints - hintsUsed * options.hintCost;
    if (available >= options.hintCost && hasTargets) {
      const t = setTimeout(() => buyHint(), 700);
      return () => clearTimeout(t);
    }
  }, [bonusPoints, hintsUsed, started, gameWon]); // eslint-disable-line

  // ── Word found fanfare (visual only — sound fires in handlePointerUp) ────────
  useEffect(() => {
    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;
    for (const wi of foundWordIndices) {
      if (!prevFoundIndicesRef.current.has(wi)) {
        setFanfareIdx(wi);
        const cells = foundWordCells.get(wi)
          ?? placements.find(p => p.wordIndex === wi)?.cells ?? [];
        setJustFoundCells(new Set(cells.map(c => cellKey(c.row, c.col))));
        t1 = setTimeout(() => setFanfareIdx(null), 800);
        t2 = setTimeout(() => setJustFoundCells(new Set()), 600);
        break;
      }
    }
    prevFoundIndicesRef.current = new Set(foundWordIndices);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [foundWordIndices]); // eslint-disable-line

  // ── Hint letter reveal animation ───────────────────────────────────────────
  useEffect(() => {
    let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
    loop: for (const [wi, indices] of hintedLetters) {
      const prev = prevHintedLettersRef.current.get(wi) ?? new Set<number>();
      for (const li of indices) {
        if (!prev.has(li)) {
          if (!foundWordIndices.has(wi) && useWordSearchStore.getState().options.soundEnabled) sfxHintGiven();
          setHintRevealPos({ wi, li });
          cleanupTimer = setTimeout(() => setHintRevealPos(null), 600);
          break loop;
        }
      }
    }
    prevHintedLettersRef.current = new Map([...hintedLetters].map(([k, v]) => [k, new Set(v)]));
    return () => clearTimeout(cleanupTimer);
  }, [hintsUsed]); // eslint-disable-line

  // ── Wrong answer sound ─────────────────────────────────────────────────────
  useEffect(() => { if (answerError && useWordSearchStore.getState().options.soundEnabled) sfxWrongAnswer(); }, [answerError]); // eslint-disable-line

  // ── Error clear ────────────────────────────────────────────────────────────
  if (answerError && !errorTimerRef.current) {
    errorTimerRef.current = setTimeout(() => {
      clearError();
      errorTimerRef.current = null;
    }, 600);
  }

  // ── Derived display values ─────────────────────────────────────────────────
  const available    = bonusPoints - hintsUsed * options.hintCost;
  const meterPercent = Math.min(100, Math.max(0, (available / options.hintCost) * 100));

  const selectedSet = new Set(selectionCells.map(c => cellKey(c.row, c.col)));
  const foundCells  = new Set<number>();
  for (const wi of foundWordIndices) {
    const cells = foundWordCells.get(wi);
    if (cells) { for (const c of cells) foundCells.add(cellKey(c.row, c.col)); }
    else {
      const p = placements.find(pl => pl.wordIndex === wi);
      if (p) for (const c of p.cells) foundCells.add(cellKey(c.row, c.col));
    }
  }

  // Maps each clue word position → its uniqueHiddenWords index (handles duplicates)
  const clueWordToHiddenIdx = puzzle
    ? puzzle.clueWords.map((_, i) => clueWordIdx(puzzle.clueWords, uniqueHiddenWords, i))
    : [];

  function getPointerCell(e: React.PointerEvent): { row: number; col: number } | null {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const col = Math.floor(((e.clientX - rect.left) / rect.width) * gridSize);
    const row = Math.floor(((e.clientY - rect.top) / rect.height) * gridSize);
    if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) return null;
    return { row, col };
  }

  function handlePointerDown(e: React.PointerEvent) {
    resumeAudio();
    e.stopPropagation();
    const cell = getPointerCell(e);
    if (!cell) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startSelecting(cell.row, cell.col);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!isSelecting) return;
    e.preventDefault();
    const cell = getPointerCell(e);
    if (!cell) return;
    updateSelection(cell.row, cell.col);
  }

  function handlePointerUp(_e: React.PointerEvent) {
    if (!isSelecting) return;
    endSelection();
    const s = useWordSearchStore.getState();
    if (s.options.soundEnabled) {
      const result = s.lastSelectionResult;
      if (result === 'word') sfxWordFound();
      else if (result === 'bonus') {
        const wordLen = s.bonusSelections[s.bonusSelections.length - 1]?.length ?? 3;
        sfxBonusLetters(wordLen);
      } else if (result === 'nothing') sfxNotFound();
    }
  }

  function handlePointerCancel(_e: React.PointerEvent) {
    if (!isSelecting) return;
    endSelection();
  }

  function handleSubmit() {
    resumeAudio();
    if (!answer.trim() || lockoutSecsLeft > 0 || answerSubmitted) return;
    submitAnswer(answer);
  }

  function handleIntroClose() {
    const pt = useWordSearchStore.getState().puzzle?.puzzleType;
    if (introDontShowAgain && pt) {
      localStorage.setItem(`ws-intro-seen-${pt}`, '1');
    }
    setShowIntroModal(false);
  }

  function handleStart() {
    resumeAudio();
    startPuzzle(undefined, localOptions);
    setStarted(true);
    setAnswer('');
    setElapsed(0);
    setFanfareIdx(null);
    setJustFoundCells(new Set());
    setHintRevealPos(null);
    setLockoutSecsLeft(0);
    setShowAnswerModal(false);
    prevFoundIndicesRef.current      = new Set();
    prevHintedLettersRef.current     = new Map();
    prevAnswerSubmittedRef.current   = false;

    const pt = useWordSearchStore.getState().puzzle?.puzzleType;
    if (pt && !localStorage.getItem(`ws-intro-seen-${pt}`)) {
      setIntroDontShowAgain(true);
      setShowIntroModal(true);
    }
  }

  function handlePlayAgain() {
    resumeAudio();
    setStarted(false);
    setShowAnswerModal(false);
  }

  const isLoopMode = options.selectionMode === 'loop';
  const allFound   = foundWordIndices.size >= uniqueHiddenWords.length;

  // ── Options screen ────────────────────────────────────────────────────────
  if (!started) {
    return (
      <div className="ws-container">
        <span className="ws-build-ver">{__BUILD_TS__}</span>
        <div className="ws-options">
          <button className="ws-back-btn ws-options-back" onClick={resetToLobby}>✕</button>
          <h2 className="ws-options-title">Word Search</h2>

          <div className="ws-option-row">
            <label className="ws-option-label">
              Grid size
              <span className="ws-option-desc">Larger grids are harder to search</span>
            </label>
            <div className="ws-option-control">
              <span className="ws-option-value">{localOptions.gridSize}×{localOptions.gridSize}</span>
              <input className="ws-slider" type="range" min={MIN_GRID_SIZE} max={MAX_GRID_SIZE} step={1}
                value={localOptions.gridSize}
                onChange={e => setLocalOptions(o => ({ ...o, gridSize: Number(e.target.value) }))} />
            </div>
          </div>

          <div className="ws-option-row">
            <label className="ws-option-label">
              Points per hint
              <span className="ws-option-desc">Bonus points earned before a letter is auto-revealed</span>
            </label>
            <input className="ws-number-input" type="number" min={1} max={99}
              value={localOptions.hintCost}
              onChange={e => setLocalOptions(o => ({
                ...o, hintCost: Math.max(1, Math.min(99, Number(e.target.value) || 1)),
              }))} />
          </div>

          <div className="ws-option-row">
            <label className="ws-option-label">
              Allow backward words
              <span className="ws-option-desc">Words can be placed in any direction, including reversed</span>
            </label>
            <button role="switch" aria-checked={localOptions.allowBackward}
              className={`ws-toggle ${localOptions.allowBackward ? 'ws-toggle-on' : ''}`}
              onClick={() => setLocalOptions(o => ({ ...o, allowBackward: !o.allowBackward }))}>
              <span className="ws-toggle-thumb" />
            </button>
          </div>

          <div className="ws-option-row">
            <label className="ws-option-label">
              Found word style
              <span className="ws-option-desc">How found words are highlighted</span>
            </label>
            <div className="ws-mode-toggle">
              <button className={`ws-mode-btn ${localOptions.selectionMode === 'block' ? 'ws-mode-btn-active' : ''}`}
                onClick={() => setLocalOptions(o => ({ ...o, selectionMode: 'block' }))}>Block</button>
              <button className={`ws-mode-btn ${localOptions.selectionMode === 'loop' ? 'ws-mode-btn-active' : ''}`}
                onClick={() => setLocalOptions(o => ({ ...o, selectionMode: 'loop' }))}>Loop</button>
            </div>
          </div>

          <div className="ws-option-row">
            <label className="ws-option-label">
              Puzzle types
              <span className="ws-option-desc">Which formats to include when selecting a puzzle</span>
            </label>
            <div className="ws-mode-toggle">
              {(['crossword', 'chain'] as PuzzleType[]).map(type => {
                const active = localOptions.puzzleTypes.includes(type);
                return (
                  <button key={type}
                    className={`ws-mode-btn ${active ? 'ws-mode-btn-active' : ''}`}
                    onClick={() => setLocalOptions(o => {
                      const next = active
                        ? o.puzzleTypes.filter(t => t !== type)
                        : [...o.puzzleTypes, type];
                      return { ...o, puzzleTypes: next.length > 0 ? next : [type] };
                    })}>
                    {type === 'crossword' ? 'Crossword' : 'Chain'}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="ws-option-row">
            <label className="ws-option-label">
              Sound effects
              <span className="ws-option-desc">Audio feedback for game events</span>
            </label>
            <button role="switch" aria-checked={localOptions.soundEnabled}
              className={`ws-toggle ${localOptions.soundEnabled ? 'ws-toggle-on' : ''}`}
              onClick={() => setLocalOptions(o => ({ ...o, soundEnabled: !o.soundEnabled }))}>
              <span className="ws-toggle-thumb" />
            </button>
          </div>

          <button className="ws-start-btn" onClick={handleStart}>Play</button>
        </div>
      </div>
    );
  }

  if (!puzzle || grid.length === 0) return null;

  // ── Loop mode SVG overlay ─────────────────────────────────────────────────
  function renderLoopOverlay() {
    const shapes: React.ReactNode[] = [];
    const R = 0.43;

    for (const wi of foundWordIndices) {
      const cells: CellCoord[] | undefined = foundWordCells.get(wi)
        ?? placements.find(p => p.wordIndex === wi)?.cells;
      if (!cells || cells.length < 1) continue;
      const first = cells[0], last = cells[cells.length - 1];
      shapes.push(
        <path key={`w-${wi}`}
          d={pillPath(first.col + 0.5, first.row + 0.5, last.col + 0.5, last.row + 0.5, R)}
          fill="rgba(42, 107, 60, 0.10)" stroke="rgba(42, 107, 60, 0.80)" strokeWidth={0.07} />
      );

      const actualCells = foundWordCells.get(wi);
      if (actualCells) {
        const placement = placements.find(p => p.wordIndex === wi);
        if (placement && placement.cells.length >= 2) {
          const sameF = actualCells.length === placement.cells.length &&
            placement.cells.every((c, i) => c.row === actualCells[i].row && c.col === actualCells[i].col);
          const sameR = actualCells.length === placement.cells.length &&
            placement.cells.every((c, i) =>
              c.row === actualCells[actualCells.length - 1 - i].row &&
              c.col === actualCells[actualCells.length - 1 - i].col);
          if (!sameF && !sameR &&
              placement.cells.some(c => revealedOriginalCells.has(cellKey(c.row, c.col)))) {
            const pf = placement.cells[0], pl = placement.cells[placement.cells.length - 1];
            shapes.push(
              <path key={`w-${wi}-orig`}
                d={pillPath(pf.col + 0.5, pf.row + 0.5, pl.col + 0.5, pl.row + 0.5, R)}
                fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.25)" strokeWidth={0.05} />
            );
          }
        }
      }
    }

    bonusSelections.forEach((sel: CellCoord[], idx: number) => {
      if (sel.length < 1) return;
      const first = sel[0], last = sel[sel.length - 1];
      shapes.push(
        <path key={`b-${idx}`}
          d={pillPath(first.col + 0.5, first.row + 0.5, last.col + 0.5, last.row + 0.5, R)}
          fill="rgba(200,200,200,0.10)" stroke="rgba(200,200,200,0.38)" strokeWidth={0.06} />
      );
    });

    if (isSelecting && selectionCells.length >= 1) {
      const first = selectionCells[0], last = selectionCells[selectionCells.length - 1];
      shapes.push(
        <path key="sel"
          d={pillPath(first.col + 0.5, first.row + 0.5, last.col + 0.5, last.row + 0.5, R)}
          fill="rgba(232,184,48,0.10)" stroke="rgba(232,184,48,0.75)" strokeWidth={0.07} />
      );
    }

    return (
      <svg className="ws-grid-svg" viewBox={`0 0 ${gridSize} ${gridSize}`} preserveAspectRatio="none">
        {shapes}
      </svg>
    );
  }

  const remainingCount = uniqueHiddenWords.length - foundWordIndices.size;

  // ── Game screen ───────────────────────────────────────────────────────────
  return (
    <div className="ws-container">
      <span className="ws-build-ver">{__BUILD_TS__}</span>
      <div className="ws-game">

        <div className="ws-header">
          <button className="ws-back-btn" onClick={resetToLobby} title="Back to lobby">✕</button>
          <span className="ws-title">Word Search</span>
          <span className="ws-timer">{formatTime(elapsed)}</span>
        </div>

        {/* Puzzle type tag */}
        <div className="ws-puzzle-type-tag">
          {puzzle.puzzleType === 'chain' ? 'Chain Reaction' : 'Crossword'}
        </div>

        {/* Clue */}
        {puzzle.puzzleType === 'chain' ? (
          <div className="ws-chain-clue">
            {puzzle.clueWords.map((word, i) => {
              const upper = word.toUpperCase().replace(/[^A-Z]/g, '');
              const idx   = clueWordToHiddenIdx[i];
              const found = idx === -1 || foundWordIndices.has(idx);
              const isFanfare = fanfareIdx === idx && idx !== -1;
              const hinted = hintedLetters.get(idx) ?? new Set<number>();
              return (
                <span key={i} className="ws-chain-item">
                  {i > 0 && <span className="ws-chain-arrow">→</span>}
                  {found ? (
                    <span className={`ws-chain-word ws-chain-word-found${isFanfare ? ' ws-clue-word-fanfare' : ''}`}>
                      {upper}
                    </span>
                  ) : (
                    <span className="ws-chain-word ws-chain-word-hidden">
                      {upper.split('').map((ch, li) => {
                        if (hinted.has(li)) {
                          const isNew = hintRevealPos?.wi === idx && hintRevealPos?.li === li;
                          return (
                            <span key={li} className={`ws-clue-hint-letter${isNew ? ' ws-clue-hint-letter-new' : ''}`}>
                              {ch}
                            </span>
                          );
                        }
                        return <span key={li}>_</span>;
                      })}
                    </span>
                  )}
                </span>
              );
            })}
            <span className="ws-chain-item">
              <span className="ws-chain-arrow">→</span>
              {answerSubmitted
                ? <span className="ws-chain-word ws-chain-word-found ws-clue-word-fanfare">{puzzle.answer.toUpperCase()}</span>
                : <span className="ws-chain-answer-mark">?</span>
              }
            </span>
          </div>
        ) : (
          <div className="ws-clue">
            {puzzle.clueWords.map((word, i) => {
              const upper = word.toUpperCase().replace(/[^A-Z]/g, '');
              if (upper.length < 3) {
                return <span key={i} className="ws-clue-word ws-clue-word-revealed">{upper || word.toUpperCase()}</span>;
              }
              const idx = clueWordToHiddenIdx[i];
              if (idx === -1 || foundWordIndices.has(idx)) {
                const isFanfare = fanfareIdx === idx && idx !== -1;
                return (
                  <span key={i}
                    className={`ws-clue-word ws-clue-word-revealed${isFanfare ? ' ws-clue-word-fanfare' : ''}`}>
                    {upper}
                  </span>
                );
              }
              const hinted = hintedLetters.get(idx) ?? new Set<number>();
              return (
                <span key={i} className="ws-clue-word ws-clue-word-hidden">
                  {upper.split('').map((ch, li) => {
                    if (hinted.has(li)) {
                      const isNew = hintRevealPos?.wi === idx && hintRevealPos?.li === li;
                      return (
                        <span key={li} className={`ws-clue-hint-letter${isNew ? ' ws-clue-hint-letter-new' : ''}`}>
                          {ch}
                        </span>
                      );
                    }
                    return <span key={li}>_</span>;
                  })}
                </span>
              );
            })}
          </div>
        )}

        {/* Answer area: input before answering, status after */}
        {!answerSubmitted ? (
          <div className="ws-answer-area">
            <div className="ws-answer-row">
              <input
                className={`ws-answer-input ${answerError ? 'ws-answer-error' : ''}`}
                type="text"
                placeholder="Your answer…"
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !lockoutSecsLeft && handleSubmit()}
                disabled={lockoutSecsLeft > 0}
                autoCorrect="off"
                autoCapitalize="words"
                spellCheck={false}
              />
              <button
                className={`ws-submit-btn${lockoutSecsLeft > 0 ? ' ws-submit-btn-locked' : ''}`}
                onClick={handleSubmit}
                disabled={lockoutSecsLeft === 0 && !answer.trim()}
              >
                {lockoutSecsLeft > 0 ? `Locked ${lockoutSecsLeft}…` : 'Guess'}
              </button>
            </div>
          </div>
        ) : !allFound ? (
          <div className="ws-find-remaining">
            Find {remainingCount} remaining word{remainingCount !== 1 ? 's' : ''}!
          </div>
        ) : null}

        {/* Grid */}
        <div className="ws-grid-wrap">
          <div
            ref={gridRef}
            className={`ws-grid${isLoopMode ? ' ws-grid-loop' : ''}`}
            style={{
              '--grid-size': gridSize,
              gridTemplateColumns: `repeat(${gridSize}, var(--cell))`,
              gridTemplateRows: `repeat(${gridSize}, var(--cell))`,
            } as React.CSSProperties}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
          >
            {grid.map((row, r) =>
              row.map((letter, c) => {
                const key        = cellKey(r, c);
                const isSel      = selectedSet.has(key);
                const isFound    = foundCells.has(key);
                const isJustFound = justFoundCells.has(key);
                const isOriginal = !isFound && revealedOriginalCells.has(key);
                const isBonus    = !isFound && !isOriginal && bonusCells.has(key);
                let cls = 'ws-cell';
                if (!isLoopMode) {
                  if (isFound)         cls += ' ws-cell-found';
                  else if (isOriginal) cls += ' ws-cell-original';
                  else if (isBonus)    cls += ' ws-cell-bonus';
                }
                if (isJustFound) cls += ' ws-cell-just-found';
                if (isSel)       cls += ' ws-cell-selected';
                return <div key={key} className={cls}>{letter}</div>;
              }),
            )}
            {isLoopMode && renderLoopOverlay()}
          </div>
        </div>

        {/* Hint meter */}
        {!allFound && (
          <div className={`ws-hint-row${available >= options.hintCost ? ' ws-hint-full' : ''}`}>
            <span className="ws-hint-row-label">Hint</span>
            <div className="ws-hint-meter">
              <div className="ws-hint-meter-fill" style={{ width: `${meterPercent}%` }} />
            </div>
          </div>
        )}

      </div>

      {/* How-to-play intro modal */}
      {showIntroModal && (
        <div className="ws-win">
          <div className="ws-intro-title">
            {puzzle.puzzleType === 'chain' ? 'Chain Reaction' : 'Crossword'}
          </div>
          {puzzle.puzzleType === 'chain' ? (
            <ul className="ws-intro-list">
              <li>The first word is given — find the remaining chain words in the grid</li>
              <li>Consecutive pairs form a two-word phrase (e.g. "spring chicken", "chicken soup")</li>
              <li>Figure out the final word that completes the last phrase — that's your answer</li>
              <li>No penalty for wrong guesses, so take your best shot!</li>
            </ul>
          ) : (
            <ul className="ws-intro-list">
              <li>Read the clue and find its words hidden in the grid</li>
              <li>Guess the answer any time — you don't need to find every word first</li>
              <li>After a correct guess, find the remaining words to finish the round</li>
              <li>Fewer words revealed before guessing = higher clue bonus</li>
            </ul>
          )}
          <label className="ws-intro-checkbox">
            <input type="checkbox" checked={introDontShowAgain}
              onChange={e => setIntroDontShowAgain(e.target.checked)} />
            Don't show this again
          </label>
          <button className="ws-win-btn" onClick={handleIntroClose}>Got it!</button>
        </div>
      )}

      {/* Correct answer modal — shown after answer is submitted, before all words found */}
      {answerSubmitted && !gameWon && showAnswerModal && (
        <div className="ws-win">
          <div className="ws-win-title">Correct!</div>
          <div className="ws-win-answer">{puzzle.answer}</div>
          {clueBonus === 0 ? (
            <p className="ws-win-subtitle">
              You revealed all {uniqueHiddenWords.length} clue words before answering — no clue bonus.
            </p>
          ) : (
            <p className="ws-win-subtitle">
              You answered with only {wordsRevealedAtAnswer} of {uniqueHiddenWords.length} words revealed,
              earning <strong>{clueBonus}</strong> clue bonus points!
            </p>
          )}
          <p className="ws-win-subtitle">Now find the remaining clue words to earn your time bonus — go fast!</p>
          <button className="ws-win-btn" onClick={() => setShowAnswerModal(false)}>Continue</button>
        </div>
      )}

      {/* Final score overlay */}
      {gameWon && (
        <div className="ws-win">
          <div className="ws-win-title">Complete!</div>
          <div className="ws-win-answer">{puzzle.answer}</div>
          <div className="ws-score-breakdown">
            <div className="ws-score-row">
              <span>Clue Bonus</span>
              <span>{clueBonus ?? 0}</span>
            </div>
            <div className="ws-score-row">
              <span>Time Bonus</span>
              <span>{timeBonus ?? 0}</span>
            </div>
            <div className="ws-score-row ws-score-total">
              <span>Total</span>
              <span>{(clueBonus ?? 0) + (timeBonus ?? 0)}</span>
            </div>
          </div>
          <button className="ws-win-btn" onClick={handlePlayAgain}>Play Again</button>
          <button className="ws-win-btn" onClick={resetToLobby}>Back to Menu</button>
        </div>
      )}
    </div>
  );
}
