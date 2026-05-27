import './Tile.css';
import type { Player, BonusValue } from '../../game/types';

interface TileProps {
  letter: string;
  owner: Player;
  isFlipping?: boolean;
  isNew?: boolean;
  isDragging?: boolean;
  bonusValue?: BonusValue | null;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onClick?: () => void;
  className?: string;
}

export function Tile({
  letter, owner, isFlipping = false, isNew = false, isDragging = false,
  draggable = false, onDragStart, onDragEnd, onClick, className = '',
}: TileProps) {
  const isP1 = owner === 'player1';
  return (
    <div
      className={['tile-container', isNew && 'tile-new', isDragging && 'tile-dragging', className].filter(Boolean).join(' ')}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      style={{ cursor: draggable ? 'grab' : onClick ? 'pointer' : 'default' }}
    >
      <div className={`tile-inner${isFlipping ? ' tile-flipping' : ''}`}>
        <div className={`tile-face tile-front ${isP1 ? 'tile-p1' : 'tile-p2'}`}>{letter}</div>
        <div className={`tile-face tile-back  ${isP1 ? 'tile-p2' : 'tile-p1'}`}>{letter}</div>
        <div className={`tile-edge tile-edge-top    ${isP1 ? 'edge-p1' : 'edge-p2'}`} />
        <div className={`tile-edge tile-edge-bottom ${isP1 ? 'edge-p1' : 'edge-p2'}`} />
        <div className={`tile-edge tile-edge-left   ${isP1 ? 'edge-p1' : 'edge-p2'}`} />
        <div className={`tile-edge tile-edge-right  ${isP1 ? 'edge-p1' : 'edge-p2'}`} />
      </div>
    </div>
  );
}
