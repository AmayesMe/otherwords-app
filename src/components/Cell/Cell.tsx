import './Cell.css';
import { useState } from 'react';
import { Tile } from '../Tile/Tile';
import { useGameStore } from '../../store/gameStore';
import { createTileDragImage } from '../../utils/dragImage';
import type { CellState } from '../../game/types';
import type { DragData } from '../../store/gameStore';

interface CellProps {
  state: CellState;
  col: number;
  row: number;
  isCenter: boolean;
}

const BONUS_LABELS: Record<number, string> = { 1: '+1', 2: '+2', 3: '+3' };
const BONUS_CLASS: Record<number, string>  = { 1: 'bonus-1', 2: 'bonus-2', 3: 'bonus-3' };

export function Cell({ state, col, row, isCenter }: CellProps) {
  const { tile, bonus, bonusUsed } = state;
  const { placeTile, moveTile, recallTile, isCurrentTurnTile, currentPlayer } = useGameStore();
  const [isDraggingOut, setIsDraggingOut] = useState(false);
  const isThisTurn = isCurrentTurnTile(col, row);
  const showBonus = bonus && !tile && !bonusUsed;
  const showPip   = bonus && bonusUsed && tile;

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    const data = JSON.parse(raw) as DragData;

    if (data.type === 'rack') {
      placeTile(data.tileId, data.slotIndex, col, row);
    } else if (data.type === 'board') {
      if (data.col !== col || data.row !== row) {
        moveTile(data.col, data.row, col, row);
      }
    }
  }

  function handleTileClick() {
    if (isThisTurn) recallTile(col, row);
  }

  function handleTileDragStart(e: React.DragEvent) {
    if (!isThisTurn) { e.preventDefault(); return; }
    setTimeout(() => setIsDraggingOut(true), 0);
    const data: DragData = { type: 'board', col, row };
    e.dataTransfer.setData('text/plain', JSON.stringify(data));
    e.dataTransfer.effectAllowed = 'move';

    if (tile) {
      const ghost = createTileDragImage(tile.letter, currentPlayer);
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 25, 25);
      setTimeout(() => ghost.remove(), 0);
    }
  }

  function handleTileDragEnd() {
    setIsDraggingOut(false);
  }

  return (
    <div
      className={['cell', showBonus && BONUS_CLASS[bonus!]].filter(Boolean).join(' ')}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {!tile && isCenter && <span className="center-star">★</span>}
      {showBonus && <span className="bonus-label">{BONUS_LABELS[bonus!]}</span>}

      {tile && (
        <Tile
          letter={tile.isWild && tile.wildLetter ? tile.wildLetter : tile.letter}
          owner={tile.owner}
          isNew={isThisTurn}
          draggable={isThisTurn}
          isDragging={isDraggingOut}
          onDragStart={handleTileDragStart}
          onDragEnd={handleTileDragEnd}
          onClick={handleTileClick}
        />
      )}

      {showPip && <span className="bonus-pip">{BONUS_LABELS[bonus!]}</span>}
    </div>
  );
}
