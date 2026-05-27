import './Rack.css';
import { useRef } from 'react';
import { Tile } from '../Tile/Tile';
import { useGameStore } from '../../store/gameStore';
import { createTileDragImage } from '../../utils/dragImage';
import type { DragData } from '../../store/gameStore';

export function Rack() {
  const { getCurrentRack, currentPlayer, recallTile, recallAllTiles, moveRackTileToSlot, shuffleRack, endTurn, turnError } = useGameStore();
  const slots = getCurrentRack();
  const dragRef = useRef<{ el: HTMLElement; timer: ReturnType<typeof setTimeout> } | null>(null);

  function handleTileDragStart(e: React.DragEvent, tileId: string, slotIndex: number, letter: string) {
    const el = e.currentTarget as HTMLElement;
    const timer = setTimeout(() => el.classList.add('tile-dragging'), 0);
    dragRef.current = { el, timer };

    const data: DragData = { type: 'rack', tileId, slotIndex };
    e.dataTransfer.setData('text/plain', JSON.stringify(data));
    e.dataTransfer.effectAllowed = 'move';

    const ghost = createTileDragImage(letter, currentPlayer);
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 25, 25);
    setTimeout(() => ghost.remove(), 0);
  }

  function handleTileDragEnd() {
    if (dragRef.current) {
      clearTimeout(dragRef.current.timer);
      dragRef.current.el.classList.remove('tile-dragging');
      dragRef.current = null;
    }
  }

  function handleSlotDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleSlotDrop(e: React.DragEvent, toIndex: number) {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    const data = JSON.parse(raw) as DragData;

    if (data.type === 'rack') {
      moveRackTileToSlot(data.tileId, data.slotIndex, toIndex);
    } else if (data.type === 'board') {
      recallTile(data.col, data.row);
    }
  }

  return (
    <div className="rack-wrapper">
      <div className="rack-row">
        <div className="rack">
          {slots.map((slot, i) => (
            <div
              key={i}
              className="rack-slot"
              onDragOver={handleSlotDragOver}
              onDrop={e => handleSlotDrop(e, i)}
            >
              {slot && (
                <Tile
                  letter={slot.isWild ? '★' : slot.letter}
                  owner={currentPlayer}
                  draggable
                  onDragStart={e => handleTileDragStart(e, slot.id, i, slot.isWild ? '★' : slot.letter)}
                  onDragEnd={handleTileDragEnd}
                />
              )}
            </div>
          ))}
        </div>
        <button className="btn btn-icon" onClick={shuffleRack} title="Shuffle tiles">⇄</button>
      </div>
      {turnError && <div className="turn-error">{turnError}</div>}
      <div className="turn-controls">
        <button className="btn btn-secondary" onClick={recallAllTiles}>Reset Turn</button>
        <button className="btn btn-primary" onClick={endTurn}>End Turn</button>
      </div>
    </div>
  );
}
