import './TurnReplayOverlay.css';
import { useState, useEffect, useMemo } from 'react';
import { Tile } from '../Tile/Tile';
import { isCenterCell, countScore } from '../../game/boardUtils';
import { useGameStore } from '../../store/gameStore';
import type { TurnReplay, ReplayPlacement } from '../../store/gameStore';
import type { BoardState, CellState } from '../../game/types';

const BONUS_LABELS: Record<number, string> = { 1: '+1', 2: '+2', 3: '+3' };
const BONUS_CLASS: Record<number, string>  = { 1: 'bonus-1', 2: 'bonus-2', 3: 'bonus-3' };

const INITIAL_DELAY      = 350;  // ms before first tile appears (overlay slide-in is 220ms)
const TILE_INTERVAL      = 290;  // ms between consecutive tile placements
const WORD_PAUSE         = 500;  // ms extra pause between separate word groups
const PAUSE_AFTER_PLACE  = 700;  // ms pause before flips start
const FLIP_STAGGER       = 220;  // ms between each flip start (tiles overlap slightly)
const FLIP_CSS_DURATION  = 400;  // must match CSS transition on .tile-inner
const FLIP_BUFFER        = 80;   // extra buffer after flip animation
const DONE_DELAY         = 350;  // ms after last flip settles before showing completion buttons

/**
 * Split reading-order placements into word groups.
 * A new group starts whenever a tile doesn't share the same row or column
 * as the first tile of the current group (i.e. it's a separate word).
 */
function groupByWord(placements: ReplayPlacement[]): ReplayPlacement[][] {
  if (placements.length === 0) return [];
  const groups: ReplayPlacement[][] = [];
  let current: ReplayPlacement[] = [placements[0]];
  for (let i = 1; i < placements.length; i++) {
    const anchor = current[0];
    const p = placements[i];
    if (p.row === anchor.row || p.col === anchor.col) {
      current.push(p);
    } else {
      groups.push(current);
      current = [p];
    }
  }
  groups.push(current);
  return groups;
}

interface Props {
  replay: TurnReplay;
  opponentName: string;
  /** Called when player is done and ready to take their turn. */
  onDone: () => void;
}

export function TurnReplayOverlay({ replay, opponentName, onDone }: Props) {
  const setReplayScore = useGameStore(state => state.setReplayScore);

  // Incrementing this key re-runs the entire animation ("Watch again")
  const [animKey, setAnimKey]           = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [flippedCount, setFlippedCount] = useState(0);   // how many flips have STARTED
  const [scoredCount, setScoredCount]   = useState(0);   // how many flips have FINISHED (for score)
  const [animDone, setAnimDone]         = useState(false);

  // Sort placements reading-order (top-left → bottom-right)
  const sortedPlacements = useMemo(
    () => [...replay.placements].sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col),
    [replay.placements],
  );

  // Sort confiscated cells reading-order — one flips at a time, staggered
  const sortedConfiscated = useMemo(
    () => [...replay.confiscated].sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col),
    [replay.confiscated],
  );

  // Which cells are currently mid-flip (CSS animation in progress)
  const flippingSet = useMemo(() => {
    const s = new Set<string>();
    for (let i = 0; i < flippedCount; i++) s.add(`${sortedConfiscated[i].col},${sortedConfiscated[i].row}`);
    return s;
  }, [flippedCount, sortedConfiscated]);

  // Which placements have been revealed so far
  const revealedKeys = useMemo(() => {
    const s = new Set<string>();
    for (let i = 0; i < revealedCount; i++) s.add(`${sortedPlacements[i].col},${sortedPlacements[i].row}`);
    return s;
  }, [revealedCount, sortedPlacements]);

  // Drive the full animation sequence — re-runs when animKey increments
  useEffect(() => {
    // Reset all animation state at the start of each run
    setRevealedCount(0);
    setFlippedCount(0);
    setScoredCount(0);
    setAnimDone(false);

    const timers: ReturnType<typeof setTimeout>[] = [];

    // ── 1. Reveal placements one by one, with a pause between word groups ────
    const wordGroups = groupByWord(sortedPlacements);
    let tileIndex = 0;
    let timeOffset = INITIAL_DELAY;

    wordGroups.forEach((group, groupIndex) => {
      group.forEach(() => {
        const i = tileIndex++;
        timers.push(setTimeout(() => setRevealedCount(i + 1), timeOffset));
        timeOffset += TILE_INTERVAL;
      });
      // Extra pause after each group except the last
      if (groupIndex < wordGroups.length - 1) timeOffset += WORD_PAUSE;
    });

    // afterPlacements = one TILE_INTERVAL past the last reveal + PAUSE_AFTER_PLACE
    const afterPlacements =
      (wordGroups.length > 0 ? timeOffset : INITIAL_DELAY + TILE_INTERVAL) + PAUSE_AFTER_PLACE;

    // ── 2. Staggered one-at-a-time flips ─────────────────────────────────────
    if (sortedConfiscated.length > 0) {
      sortedConfiscated.forEach((_, i) => {
        const flipStart = afterPlacements + i * FLIP_STAGGER;
        const flipEnd   = flipStart + FLIP_CSS_DURATION + FLIP_BUFFER;

        // Start the CSS flip animation
        timers.push(setTimeout(() => setFlippedCount(i + 1), flipStart));
        // Update the score once this tile's flip has settled
        timers.push(setTimeout(() => setScoredCount(i + 1), flipEnd));
      });

      const lastFlipEnd =
        afterPlacements +
        (sortedConfiscated.length - 1) * FLIP_STAGGER +
        FLIP_CSS_DURATION + FLIP_BUFFER;
      timers.push(setTimeout(() => setAnimDone(true), lastFlipEnd + DONE_DELAY));
    } else {
      timers.push(setTimeout(() => setAnimDone(true), afterPlacements));
    }

    return () => timers.forEach(clearTimeout);
  }, [animKey]); // eslint-disable-line react-hooks/exhaustive-deps — mount-only per key

  // ── Display board: boardBefore + revealed placements ─────────────────────────
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

  // ── Scoring board: displayBoard + ownership for completed flips ──────────────
  // scoredCount tracks flips that have finished animating so the score "ticks over"
  // at the moment the tile settles to its new colour, not when the flip starts.
  const scoringBoard = useMemo((): BoardState => {
    const b = displayBoard.map(r => r.map(c => ({ ...c })));
    for (let i = 0; i < scoredCount; i++) {
      const { col, row } = sortedConfiscated[i];
      if (b[row][col].tile) {
        b[row][col] = { ...b[row][col], tile: { ...b[row][col].tile!, owner: replay.player } };
      }
    }
    return b;
  }, [displayBoard, scoredCount, sortedConfiscated, replay.player]);

  // Push live score into the store so the score bar updates during animation
  useEffect(() => {
    setReplayScore(countScore(scoringBoard));
  }, [scoringBoard]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear score from store when overlay unmounts
  useEffect(() => () => { setReplayScore(null); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="replay-overlay">
      {/* Header */}
      <div className="replay-header">
        <span className="replay-header-label">{opponentName}&rsquo;s play</span>
        {!animDone && (
          <button className="replay-skip-btn" onClick={onDone}>Skip</button>
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

      {/* Completion buttons — shown after animation finishes */}
      {animDone && (
        <div className="replay-done-row">
          <button
            className="replay-done-btn replay-done-secondary"
            onClick={() => setAnimKey(k => k + 1)}
          >
            Watch again
          </button>
          <button className="replay-done-btn replay-done-primary" onClick={onDone}>
            Play
          </button>
        </div>
      )}
    </div>
  );
}
