import './Rack.css';
import { useState } from 'react';
import { Tile } from '../Tile/Tile';
import { useGameStore } from '../../store/gameStore';
import { createTileDragImage } from '../../utils/dragImage';
import type { DragData } from '../../store/gameStore';

export function Rack() {
  const { getCurrentRack, currentPlayer, recallTile, recallAllTiles, moveRackTileToSlot } = useGameStore();
  const slots = getCurrentRack();
  const [draggingSlot, setDraggingSlot] = useState<number | null>(null);

  function handleTileDragStart(e: React.DragEvent, tileId: string, slotIndex: number, letter: string) {
    setDraggingSlot(slotIndex);
    const data: DragData = { type: 'rack', tileId, slotIndex };
    e.dataTransfer.setData('text/plain', JSON.stringify(data));
    e.dataTransfer.effectAllowed = 'move';

    // Replace broken 3D ghost with a flat custom image
    const ghost = createTileDragImage(letter, currentPlayer);
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 25, 25);
    setTimeout(() => ghost.remove(), 0);
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
      // Drag within rack — swap slots
      moveRackTileToSlot(data.tileId, data.slotIndex, toIndex);
    } else if (data.type === 'board') {
      // Drag board tile back to rack slot — recall
      recallTile(data.col, data.row);
    }
  }

  return (
    <div className="rack-wrapper">
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
                isDragging={draggingSlot === i}
                onDragStart={e => handleTileDragStart(e, slot.id, i, slot.isWild ? '★' : slot.letter)}
                onDragEnd={() => setDraggingSlot(null)}
              />
            )}
          </div>
        ))}
      </div>
      <div className="turn-controls">
        <button className="btn btn-secondary" onClick={recallAllTiles}>Reset Turn</button>
        <button className="btn btn-primary">End Turn</button>
      </div>
    </div>
  );
}
