import './Rack.css';
import { Tile } from '../Tile/Tile';
import { useGameStore } from '../../store/gameStore';

export function Rack() {
  const { getCurrentRack, currentPlayer, recallTile, recallAllTiles } = useGameStore();
  const tiles = getCurrentRack();

  function handleTileDragStart(e: React.DragEvent, tileId: string) {
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'rack', tileId }));
    e.dataTransfer.effectAllowed = 'move';
  }

  // Dropping a board tile onto the rack recalls it
  function handleRackDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleRackDrop(e: React.DragEvent) {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    const data = JSON.parse(raw) as { type: string; col?: number; row?: number };
    if (data.type === 'board' && data.col !== undefined && data.row !== undefined) {
      recallTile(data.col, data.row);
    }
  }

  return (
    <div className="rack-wrapper">
      <div className="rack" onDragOver={handleRackDragOver} onDrop={handleRackDrop}>
        {tiles.map(tile => (
          <div key={tile.id} className="rack-slot">
            <Tile
              letter={tile.isWild ? '★' : tile.letter}
              owner={currentPlayer}
              draggable
              onDragStart={e => handleTileDragStart(e, tile.id)}
            />
          </div>
        ))}
        {/* Empty slots to fill rack up to 7 */}
        {Array.from({ length: Math.max(0, 7 - tiles.length) }).map((_, i) => (
          <div key={`empty-${i}`} className="rack-slot rack-slot-empty" />
        ))}
      </div>
      <div className="turn-controls">
        <button className="btn btn-secondary" onClick={recallAllTiles}>Reset Turn</button>
        <button className="btn btn-primary">End Turn</button>
      </div>
    </div>
  );
}
