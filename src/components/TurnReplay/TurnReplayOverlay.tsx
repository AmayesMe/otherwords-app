import './TurnReplayOverlay.css';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Tile } from '../Tile/Tile';
import { isCenterCell } from '../../game/boardUtils';
import type { TurnReplay } from '../../store/gameStore';
import type { BoardState, CellState } from '../../game/types';

const BONUS_LABELS: Record<number, string> = { 1: '+1', 2: '+2', 3: '+3' };
const BONUS_CLASS: Record<number, string>  = { 1: 'bonus-1', 2: 'bonus-2', 3: 'bonus-3' };

const TILE_INTERVAL     = 290;   // ms between each tile reveal
const PAUSE_AFTER_PLACE = 650;   // ms pause before confiscation flips begin
const FLIP_DURATION     = 480;   // ms for the 3-D flip to complete (matches CSS 400ms + buffer)
const DONE_DELAY        = 400;   // ms pause after flips before showing completion buttons

interface Props {
  replay: TurnReplay;
  opponentName: string;
  /** Called when the player is done watching and wants to proceed to their turn. */
  onDone: () => void;
}

export function TurnReplayOverlay({ replay, opponentName, onDone }: Props) {
  // Incrementing this re-runs the animation (for "Watch again")
  const [animKey, setAnimKey]         = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [isFlippingPhase, setIsFlippingPhase] = useState(false);
  const [animDone, setAnimDone]       = useState(false);

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Sort placements reading-order (top-left → bottom-right)
  const sortedPlacements = useMemo(
    () => [...replay.placements].sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col),
    [replay.placements],
  );

  // Keys currently in the 3-D flip phase
  const flippingSet = useMemo(
    () => isFlippingPhase
      ? new Set(replay.confiscated.map(c => `${c.col},${c.row}`))
      : new Set<string>(),
    [isFlippingPhase, replay.confiscated],
  );

  // Keys that have been placed so far (for the isNew lift effect)
  const revealedKeys = useMemo(() => {
    const s = new Set<string>();
    for (let i = 0; i < revealedCount; i++) s.add(`${sortedPlacements[i].col},${sortedPlacements[i].row}`);
    return s;
  }, [revealedCount, sortedPlacements]);

  // Drive the animation — re-runs on "Watch again" (animKey bump)
  useEffect(() => {
    setRevealedCount(0);
    setIsFlippingPhase(false);
    setAnimDone(false);

    const timers: ReturnType<typeof setTimeout>[] = [];

    sortedPlacements.forEach((_, i) => {
      timers.push(setTimeout(() => setRevealedCount(i + 1), i * TILE_INTERVAL));
    });

    const afterPlacements = Math.max(sortedPlacements.length, 1) * TILE_INTERVAL + PAUSE_AFTER_PLACE;

    if (replay.confiscated.length > 0) {
      timers.push(setTimeout(() => setIsFlippingPhase(true), afterPlacements));
      timers.push(setTimeout(() => setAnimDone(true), afterPlacements + FLIP_DURATION + DONE_DELAY));
    } else {
      timers.push(setTimeout(() => setAnimDone(true), afterPlacements));
    }

    return () => timers.forEach(clearTimeout);
  }, [animKey]); // eslint-disable-line react-hooks/exhaustive-deps — intentionally animKey-only

  // Build the display board: boardBefore + revealed placements
  const displayBoard = useMemo((): BoardState =>
    replay.boardBefore.map((row, rowIndex) =>
      row.map((cell, colIndex): CellState => {
        const key = `${colIndex},${rowIndex}`;
        if (!revealedKeys.has(key)) return { ...cell };
        const p = sortedPlacements.find(pl => pl.col === colIndex && pl.row === rowIndex)!;
        return {
          ...cell,
          tile: { letter: p.letter, owner: replay.player, isWild: p.isWild, wildLetter: p.wildLetter },
        };
      })
    ),
    [revealedKeys, sortedPlacements, replay],
  );

  function handleWatchAgain() {
    setAnimKey(k => k + 1);
  }

  return (
    <div className="replay-overlay">
      {/* Header — label always visible; Skip only shown while animating */}
      <div className="replay-header">
        <span className="replay-header-label">{opponentName}&rsquo;s play</span>
        {!animDone && (
          <button className="replay-skip-btn" onClick={() => onDoneRef.current()}>Skip</button>
        )}
      </div>

      {/* Read-only animated board */}
      <div className="board">
        {displayBoard.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const key = `${colIndex},${rowIndex}`;
            const isFlipping = flippingSet.has(key);
            const isNew = revealedKeys.has(key);

            return (
              <div
                key={key}
                className={[
                  'cell',
                  cell.bonus && !cell.tile && !cell.bonusUsed ? BONUS_CLASS[cell.bonus] : '',
                ].filter(Boolean).join(' ')}
              >
                {!cell.tile && isCenterCell(colIndex, rowIndex) && (
                  <span className="center-star">★</span>
                )}
                {cell.bonus && !cell.tile && !cell.bonusUsed && (
                  <span className="bonus-label">{BONUS_LABELS[cell.bonus]}</span>
                )}
                {cell.tile && (
                  <Tile
                    letter={cell.tile.wildLetter ?? (cell.tile.isWild ? '' : cell.tile.letter)}
                    isWild={cell.tile.isWild}
                    owner={cell.tile.owner}
                    isNew={isNew}
                    isFlipping={isFlipping}
                  />
                )}
                {cell.bonus && cell.bonusUsed && cell.tile && (
                  <span className="bonus-pip">{BONUS_LABELS[cell.bonus]}</span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Completion row — shown after animation finishes */}
      {animDone && (
        <div className="replay-done-row">
          <button className="replay-done-btn replay-done-secondary" onClick={handleWatchAgain}>
            Watch again
          </button>
          <button className="replay-done-btn replay-done-primary" onClick={() => onDoneRef.current()}>
            Play
          </button>
        </div>
      )}
    </div>
  );
}
