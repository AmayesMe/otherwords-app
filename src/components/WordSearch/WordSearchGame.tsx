import './WordSearchGame.css';
import { useEffect, useRef, useState } from 'react';
import { useWordSearchStore } from '../../store/wordSearchStore';
import { useGameStore } from '../../store/gameStore';
import { GRID_SIZE } from '../../wordSearch/gridGenerator';

function cellKey(row: number, col: number) {
  return row * GRID_SIZE + col;
}

export function WordSearchGame() {
  const {
    puzzle,
    grid,
    placements,
    uniqueHiddenWords,
    foundWordIndices,
    isSelecting,
    selectionCells,
    answerError,
    gameWon,
    startPuzzle,
    startSelecting,
    updateSelection,
    endSelection,
    submitAnswer,
    clearError,
  } = useWordSearchStore();

  const resetToLobby = useGameStore(s => s.resetToLobby);

  const [answer, setAnswer] = useState('');
  const gridRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Start a fresh puzzle on mount
  useEffect(() => {
    startPuzzle();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear error after short delay
  useEffect(() => {
    if (!answerError) return;
    const t = setTimeout(clearError, 600);
    return () => clearTimeout(t);
  }, [answerError, clearError]);

  // Build cell state lookup: key → 'selected' | 'found' | ''
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
    const col = Math.floor(((e.clientX - rect.left) / rect.width) * GRID_SIZE);
    const row = Math.floor(((e.clientY - rect.top) / rect.height) * GRID_SIZE);
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return null;
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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSubmit();
  }

  function handlePlayAgain() {
    setAnswer('');
    startPuzzle();
  }

  if (!puzzle || grid.length === 0) return null;

  // Build clue display: each word is hidden (underscores) or revealed (text)
  const clueDisplay = puzzle.clueWords.map((word, i) => {
    const upper = word.toUpperCase().replace(/[^A-Z]/g, '');
    if (upper.length < 3) {
      return { word, revealed: true, key: i };
    }
    const idx = uniqueHiddenWords.indexOf(upper);
    const revealed = idx === -1 || foundWordIndices.has(idx);
    return { word, revealed, key: i };
  });

  const foundCount = foundWordIndices.size;
  const totalCount = uniqueHiddenWords.length;

  return (
    <div className="ws-container">
      <div className="ws-game">
        {/* Header */}
        <div className="ws-header">
          <button className="ws-back-btn" onClick={resetToLobby} title="Back to lobby">
            ✕
          </button>
          <span className="ws-title">Word Search</span>
        </div>

        {/* Clue */}
        <div className="ws-clue">
          {clueDisplay.map(({ word, revealed, key }) => (
            <span
              key={key}
              className={`ws-clue-word ${revealed ? 'ws-clue-word-revealed' : 'ws-clue-word-hidden'}`}
            >
              {revealed
                ? word
                : word.replace(/[A-Za-z]/g, '_')}
            </span>
          ))}
        </div>

        {/* Grid */}
        <div className="ws-grid-wrap">
          <div
            ref={gridRef}
            className="ws-grid"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {grid.map((row, r) =>
              row.map((letter, c) => {
                const key = cellKey(r, c);
                const isSel = selectedSet.has(key);
                const isFound = foundCells.has(key);
                let cls = 'ws-cell';
                if (isFound) cls += ' ws-cell-found';
                if (isSel) cls += ' ws-cell-selected';
                return (
                  <div key={key} className={cls}>
                    {letter}
                  </div>
                );
              }),
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="ws-progress">
          {uniqueHiddenWords.map((_, i) => (
            <div
              key={i}
              className={`ws-progress-dot ${foundWordIndices.has(i) ? 'ws-progress-dot-found' : ''}`}
            />
          ))}
          <span className="ws-progress-label">
            {foundCount}/{totalCount} words found
          </span>
        </div>

        {/* Answer */}
        <div className="ws-answer-area">
          <span className="ws-answer-label">What is the answer?</span>
          <div className="ws-answer-row">
            <input
              ref={inputRef}
              className={`ws-answer-input ${answerError ? 'ws-answer-error' : ''}`}
              type="text"
              placeholder="Your answer…"
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
            />
            <button
              className="ws-submit-btn"
              onClick={handleSubmit}
              disabled={!answer.trim()}
            >
              Guess
            </button>
          </div>
        </div>
      </div>

      {/* Win overlay */}
      {gameWon && (
        <div className="ws-win">
          <div className="ws-win-title">Correct!</div>
          <div className="ws-win-answer">{puzzle.answer}</div>
          <button className="ws-win-btn" onClick={handlePlayAgain}>
            Play Again
          </button>
          <button className="ws-win-btn" onClick={resetToLobby}>
            Back to Menu
          </button>
        </div>
      )}
    </div>
  );
}
