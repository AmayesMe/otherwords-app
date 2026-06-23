import './WordSearchGame.css';
import { useEffect, useRef, useState } from 'react';
import { useWordSearchStore, DEFAULT_OPTIONS } from '../../store/wordSearchStore';
import { useGameStore } from '../../store/gameStore';
import { cellKey, MIN_GRID_SIZE, MAX_GRID_SIZE } from '../../wordSearch/gridGenerator';
import type { WordSearchOptions } from '../../store/wordSearchStore';
import type { CellCoord } from '../../wordSearch/types';

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Build an SVG path string for a capsule/pill connecting two cell-center points.
// r is the radius in grid-unit coordinates (0.43 ≈ slightly narrower than one cell).
function pillPath(x1: number, y1: number, x2: number, y2: number, r: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len === 0) {
    // Degenerate: just a circle
    return `M ${x1 - r},${y1} A ${r},${r},0,1,0,${x1 + r},${y1} A ${r},${r},0,1,0,${x1 - r},${y1} Z`;
  }
  const nx = (-dy / len) * r;
  const ny = (dx / len) * r;
  return [
    `M ${x1 + nx},${y1 + ny}`,
    `A ${r},${r},0,0,0,${x1 - nx},${y1 - ny}`,
    `L ${x2 - nx},${y2 - ny}`,
    `A ${r},${r},0,0,1,${x2 + nx},${y2 + ny}`,
    'Z',
  ].join(' ');
}

export function WordSearchGame() {
  const {
    puzzle,
    grid,
    placements,
    uniqueHiddenWords,
    gridSize,
    options,
    foundWordIndices,
    foundWordCells,
    revealedOriginalCells,
    bonusCells,
    bonusSelections,
    bonusPoints,
    hintsUsed,
    hintedLetters,
    isSelecting,
    selectionCells,
    answerError,
    gameWon,
    startTime,
    endTime,
    startPuzzle,
    startSelecting,
    updateSelection,
    endSelection,
    buyHint,
    submitAnswer,
    clearError,
  } = useWordSearchStore();

  const resetToLobby = useGameStore(s => s.resetToLobby);

  const [answer, setAnswer] = useState('');
  const [localOptions, setLocalOptions] = useState<WordSearchOptions>({
    ...DEFAULT_OPTIONS,
    ...options,
  });
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  // Live timer
  useEffect(() => {
    if (!started || gameWon || !startTime) return;
    const id = setInterval(() => setElapsed(Date.now() - startTime), 500);
    return () => clearInterval(id);
  }, [started, gameWon, startTime]);

  // Clear error after short delay
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (answerError) {
    if (!errorTimerRef.current) {
      errorTimerRef.current = setTimeout(() => {
        clearError();
        errorTimerRef.current = null;
      }, 600);
    }
  }

  const hintCost = options.hintCost;
  const availablePoints = bonusPoints - hintsUsed * hintCost;
  const canHint = availablePoints >= hintCost;
  const hasHintTargets = uniqueHiddenWords.some((_, wi) => !foundWordIndices.has(wi));

  const selectedSet = new Set(selectionCells.map(c => cellKey(c.row, c.col)));

  // Build green cell set from actual found locations (not original placements).
  // For hint-revealed words (no entry in foundWordCells), fall back to placement cells.
  const foundCells = new Set<number>();
  for (const wi of foundWordIndices) {
    const cells = foundWordCells.get(wi);
    if (cells) {
      for (const c of cells) foundCells.add(cellKey(c.row, c.col));
    } else {
      const p = placements.find(pl => pl.wordIndex === wi);
      if (p) for (const c of p.cells) foundCells.add(cellKey(c.row, c.col));
    }
  }

  function getPointerCell(e: React.PointerEvent): { row: number; col: number } | null {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const col = Math.floor(((e.clientX - rect.left) / rect.width) * gridSize);
    const row = Math.floor(((e.clientY - rect.top) / rect.height) * gridSize);
    if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) return null;
    return { row, col };
  }

  function handlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    const cell = getPointerCell(e);
    if (!cell) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startSelecting(cell.row, cell.col);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!isSelecting) return;
    const cell = getPointerCell(e);
    if (!cell) return;
    updateSelection(cell.row, cell.col);
  }

  function handlePointerUp(_e: React.PointerEvent) {
    if (!isSelecting) return;
    endSelection();
  }

  function handleSubmit() {
    if (!answer.trim()) return;
    submitAnswer(answer);
  }

  function handleStart() {
    startPuzzle(undefined, localOptions);
    setStarted(true);
    setAnswer('');
    setElapsed(0);
  }

  function handlePlayAgain() {
    setStarted(false);
  }

  const finalTime = endTime && startTime ? endTime - startTime : null;
  const isLoopMode = options.selectionMode === 'loop';

  // ── Options screen ────────────────────────────────────────────────────────

  if (!started) {
    return (
      <div className="ws-container">
        <div className="ws-options">
          <button className="ws-back-btn ws-options-back" onClick={resetToLobby}>✕</button>
          <h2 className="ws-options-title">Word Search</h2>

          {/* Grid size */}
          <div className="ws-option-row">
            <label className="ws-option-label">
              Grid size
              <span className="ws-option-desc">Larger grids are harder to search</span>
            </label>
            <div className="ws-option-control">
              <span className="ws-option-value">{localOptions.gridSize}×{localOptions.gridSize}</span>
              <input
                className="ws-slider"
                type="range"
                min={MIN_GRID_SIZE}
                max={MAX_GRID_SIZE}
                step={1}
                value={localOptions.gridSize}
                onChange={e => setLocalOptions(o => ({ ...o, gridSize: Number(e.target.value) }))}
              />
            </div>
          </div>

          {/* Hint cost */}
          <div className="ws-option-row">
            <label className="ws-option-label">
              Hint cost
              <span className="ws-option-desc">Bonus points needed to reveal a letter</span>
            </label>
            <input
              className="ws-number-input"
              type="number"
              min={1}
              max={99}
              value={localOptions.hintCost}
              onChange={e => setLocalOptions(o => ({
                ...o,
                hintCost: Math.max(1, Math.min(99, Number(e.target.value) || 1)),
              }))}
            />
          </div>

          {/* Backward words */}
          <div className="ws-option-row">
            <label className="ws-option-label">
              Allow backward words
              <span className="ws-option-desc">Words can be placed in any direction, including reversed</span>
            </label>
            <button
              role="switch"
              aria-checked={localOptions.allowBackward}
              className={`ws-toggle ${localOptions.allowBackward ? 'ws-toggle-on' : ''}`}
              onClick={() => setLocalOptions(o => ({ ...o, allowBackward: !o.allowBackward }))}
            >
              <span className="ws-toggle-thumb" />
            </button>
          </div>

          {/* Selection mode */}
          <div className="ws-option-row">
            <label className="ws-option-label">
              Found word style
              <span className="ws-option-desc">How found words are highlighted</span>
            </label>
            <div className="ws-mode-toggle">
              <button
                className={`ws-mode-btn ${localOptions.selectionMode === 'block' ? 'ws-mode-btn-active' : ''}`}
                onClick={() => setLocalOptions(o => ({ ...o, selectionMode: 'block' }))}
              >
                Block
              </button>
              <button
                className={`ws-mode-btn ${localOptions.selectionMode === 'loop' ? 'ws-mode-btn-active' : ''}`}
                onClick={() => setLocalOptions(o => ({ ...o, selectionMode: 'loop' }))}
              >
                Loop
              </button>
            </div>
          </div>

          {/* Require all words found */}
          <div className="ws-option-row">
            <label className="ws-option-label">
              Require all words found
              <span className="ws-option-desc">Must find every clue word before guessing the answer</span>
            </label>
            <button
              role="switch"
              aria-checked={localOptions.requireAllFound}
              className={`ws-toggle ${localOptions.requireAllFound ? 'ws-toggle-on' : ''}`}
              onClick={() => setLocalOptions(o => ({ ...o, requireAllFound: !o.requireAllFound }))}
            >
              <span className="ws-toggle-thumb" />
            </button>
          </div>

          <button className="ws-start-btn" onClick={handleStart}>Play</button>
        </div>
      </div>
    );
  }

  if (!puzzle || grid.length === 0) return null;

  const foundCount = foundWordIndices.size;
  const totalCount = uniqueHiddenWords.length;

  // ── Loop mode SVG overlay ─────────────────────────────────────────────────

  function renderLoopOverlay() {
    const shapes: React.ReactNode[] = [];
    const R = 0.43; // pill radius in grid units

    // Render found clue words at their actual found location
    for (const wi of foundWordIndices) {
      const cells: CellCoord[] | undefined = foundWordCells.get(wi)
        ?? placements.find(p => p.wordIndex === wi)?.cells;
      if (!cells || cells.length < 1) continue;
      const first = cells[0];
      const last = cells[cells.length - 1];
      shapes.push(
        <path
          key={`w-${wi}`}
          d={pillPath(first.col + 0.5, first.row + 0.5, last.col + 0.5, last.row + 0.5, R)}
          fill="rgba(42, 107, 60, 0.10)"
          stroke="rgba(42, 107, 60, 0.80)"
          strokeWidth={0.07}
        />
      );

      // If found at a different location, show gray pill at original placement once player finds it
      const actualCells = foundWordCells.get(wi);
      if (actualCells) {
        const placement = placements.find(p => p.wordIndex === wi);
        if (placement && placement.cells.length >= 2) {
          const sameAsFwd = actualCells.length === placement.cells.length &&
            placement.cells.every((c, i) => c.row === actualCells[i].row && c.col === actualCells[i].col);
          const sameAsRev = actualCells.length === placement.cells.length &&
            placement.cells.every((c, i) =>
              c.row === actualCells[actualCells.length - 1 - i].row &&
              c.col === actualCells[actualCells.length - 1 - i].col);
          if (!sameAsFwd && !sameAsRev) {
            const hasRevealedOriginal = placement.cells.some(
              c => revealedOriginalCells.has(cellKey(c.row, c.col))
            );
            if (hasRevealedOriginal) {
              const pf = placement.cells[0];
              const pl = placement.cells[placement.cells.length - 1];
              shapes.push(
                <path
                  key={`w-${wi}-orig`}
                  d={pillPath(pf.col + 0.5, pf.row + 0.5, pl.col + 0.5, pl.row + 0.5, R)}
                  fill="rgba(255, 255, 255, 0.05)"
                  stroke="rgba(255, 255, 255, 0.25)"
                  strokeWidth={0.05}
                />
              );
            }
          }
        }
      }
    }

    // Bonus word selections
    bonusSelections.forEach((sel: CellCoord[], idx: number) => {
      if (sel.length < 1) return;
      const first = sel[0];
      const last = sel[sel.length - 1];
      shapes.push(
        <path
          key={`b-${idx}`}
          d={pillPath(first.col + 0.5, first.row + 0.5, last.col + 0.5, last.row + 0.5, R)}
          fill="rgba(200, 200, 200, 0.10)"
          stroke="rgba(200, 200, 200, 0.38)"
          strokeWidth={0.06}
        />
      );
    });

    // Active drag preview
    if (isSelecting && selectionCells.length >= 1) {
      const first = selectionCells[0];
      const last = selectionCells[selectionCells.length - 1];
      shapes.push(
        <path
          key="sel"
          d={pillPath(first.col + 0.5, first.row + 0.5, last.col + 0.5, last.row + 0.5, R)}
          fill="rgba(232, 184, 48, 0.10)"
          stroke="rgba(232, 184, 48, 0.75)"
          strokeWidth={0.07}
        />
      );
    }

    return (
      <svg
        className="ws-grid-svg"
        viewBox={`0 0 ${gridSize} ${gridSize}`}
        preserveAspectRatio="none"
      >
        {shapes}
      </svg>
    );
  }

  // ── Game screen ───────────────────────────────────────────────────────────

  return (
    <div className="ws-container">
      <div className="ws-game">

        <div className="ws-header">
          <button className="ws-back-btn" onClick={resetToLobby} title="Back to lobby">✕</button>
          <span className="ws-title">Word Search</span>
          <span className="ws-timer">{formatTime(elapsed)}</span>
        </div>

        {/* Clue */}
        <div className="ws-clue">
          {puzzle.clueWords.map((word, i) => {
            const upper = word.toUpperCase().replace(/[^A-Z]/g, '');
            if (upper.length < 3) {
              return <span key={i} className="ws-clue-word ws-clue-word-revealed">{upper || word.toUpperCase()}</span>;
            }
            const idx = uniqueHiddenWords.indexOf(upper);
            if (idx === -1 || foundWordIndices.has(idx)) {
              return <span key={i} className="ws-clue-word ws-clue-word-revealed">{upper}</span>;
            }
            const hinted = hintedLetters.get(idx) ?? new Set<number>();
            return (
              <span key={i} className="ws-clue-word ws-clue-word-hidden">
                {upper.split('').map((ch, li) =>
                  hinted.has(li)
                    ? <span key={li} className="ws-clue-hint-letter">{ch}</span>
                    : <span key={li}>_</span>
                )}
              </span>
            );
          })}
        </div>

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
          >
            {grid.map((row, r) =>
              row.map((letter, c) => {
                const key = cellKey(r, c);
                const isSel      = selectedSet.has(key);
                const isFound    = foundCells.has(key);
                const isOriginal = !isFound && revealedOriginalCells.has(key);
                const isBonus    = !isFound && !isOriginal && bonusCells.has(key);
                let cls = 'ws-cell';
                if (!isLoopMode) {
                  if (isFound)    cls += ' ws-cell-found';
                  else if (isOriginal) cls += ' ws-cell-original';
                  else if (isBonus)    cls += ' ws-cell-bonus';
                }
                if (isSel) cls += ' ws-cell-selected';
                return <div key={key} className={cls}>{letter}</div>;
              }),
            )}
            {isLoopMode && renderLoopOverlay()}
          </div>
        </div>

        {/* Progress + bonus */}
        <div className="ws-progress-row">
          <div className="ws-progress">
            {uniqueHiddenWords.map((_, i) => (
              <div key={i} className={`ws-progress-dot ${foundWordIndices.has(i) ? 'ws-progress-dot-found' : ''}`} />
            ))}
            <span className="ws-progress-label">{foundCount}/{totalCount}</span>
          </div>
          <div className="ws-bonus-area">
            <span className="ws-bonus-score">Bonus: {availablePoints}</span>
            <button
              className={`ws-hint-btn ${canHint && hasHintTargets ? 'ws-hint-btn-active' : 'ws-hint-btn-disabled'}`}
              onClick={buyHint}
              disabled={!canHint || !hasHintTargets}
              title={`Reveal a random letter (costs ${hintCost} bonus points)`}
            >
              Hint ({hintCost} pts)
            </button>
          </div>
        </div>

        {/* Answer */}
        {(() => {
          const allFound = foundWordIndices.size >= uniqueHiddenWords.length;
          const locked = options.requireAllFound && !allFound;
          return (
            <div className="ws-answer-area">
              <span className="ws-answer-label">
                {locked ? `Find all words first (${foundCount}/${totalCount})` : 'What is the answer?'}
              </span>
              <div className="ws-answer-row">
                <input
                  className={`ws-answer-input ${answerError ? 'ws-answer-error' : ''}`}
                  type="text"
                  placeholder="Your answer…"
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !locked && handleSubmit()}
                  disabled={locked}
                  autoCorrect="off"
                  autoCapitalize="words"
                  spellCheck={false}
                />
                <button className="ws-submit-btn" onClick={handleSubmit} disabled={!answer.trim() || locked}>
                  Guess
                </button>
              </div>
            </div>
          );
        })()}

      </div>

      {gameWon && (
        <div className="ws-win">
          <div className="ws-win-title">Correct!</div>
          <div className="ws-win-answer">{puzzle.answer}</div>
          {finalTime !== null && (
            <div className="ws-win-time">Time: {formatTime(finalTime)}</div>
          )}
          <button className="ws-win-btn" onClick={handlePlayAgain}>Play Again</button>
          <button className="ws-win-btn" onClick={resetToLobby}>Back to Menu</button>
        </div>
      )}
    </div>
  );
}
