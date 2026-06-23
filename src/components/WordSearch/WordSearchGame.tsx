import './WordSearchGame.css';
import { useRef, useState } from 'react';
import { useWordSearchStore, DEFAULT_OPTIONS } from '../../store/wordSearchStore';
import { useGameStore } from '../../store/gameStore';
import { cellKey, MIN_GRID_SIZE, MAX_GRID_SIZE } from '../../wordSearch/gridGenerator';
import type { WordSearchOptions } from '../../store/wordSearchStore';

export function WordSearchGame() {
  const {
    puzzle,
    grid,
    placements,
    uniqueHiddenWords,
    gridSize,
    options,
    foundWordIndices,
    bonusCells,
    bonusPoints,
    hintsUsed,
    hintedLetters,
    isSelecting,
    selectionCells,
    answerError,
    gameWon,
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
  const gridRef = useRef<HTMLDivElement>(null);

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
  const foundCells = new Set<number>();
  for (const p of placements) {
    if (foundWordIndices.has(p.wordIndex)) {
      for (const c of p.cells) foundCells.add(cellKey(c.row, c.col));
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
  }

  function handlePlayAgain() {
    setStarted(false);
  }

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

          <button className="ws-start-btn" onClick={handleStart}>Play</button>
        </div>
      </div>
    );
  }

  if (!puzzle || grid.length === 0) return null;

  const foundCount = foundWordIndices.size;
  const totalCount = uniqueHiddenWords.length;

  // ── Game screen ───────────────────────────────────────────────────────────

  return (
    <div className="ws-container">
      <div className="ws-game">

        <div className="ws-header">
          <button className="ws-back-btn" onClick={resetToLobby} title="Back to lobby">✕</button>
          <span className="ws-title">Word Search</span>
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
            className="ws-grid"
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
                const isSel   = selectedSet.has(key);
                const isFound = foundCells.has(key);
                const isBonus = !isFound && bonusCells.has(key);
                let cls = 'ws-cell';
                if (isFound) cls += ' ws-cell-found';
                else if (isBonus) cls += ' ws-cell-bonus';
                if (isSel) cls += ' ws-cell-selected';
                return <div key={key} className={cls}>{letter}</div>;
              }),
            )}
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
        <div className="ws-answer-area">
          <span className="ws-answer-label">What is the answer?</span>
          <div className="ws-answer-row">
            <input
              className={`ws-answer-input ${answerError ? 'ws-answer-error' : ''}`}
              type="text"
              placeholder="Your answer…"
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
            />
            <button className="ws-submit-btn" onClick={handleSubmit} disabled={!answer.trim()}>
              Guess
            </button>
          </div>
        </div>

      </div>

      {gameWon && (
        <div className="ws-win">
          <div className="ws-win-title">Correct!</div>
          <div className="ws-win-answer">{puzzle.answer}</div>
          <button className="ws-win-btn" onClick={handlePlayAgain}>Play Again</button>
          <button className="ws-win-btn" onClick={resetToLobby}>Back to Menu</button>
        </div>
      )}
    </div>
  );
}
