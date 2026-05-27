import './Tile.css';
import type { Player, BonusValue } from '../../game/types';

interface TileProps {
  letter: string;
  owner: Player;
  isWild?: boolean;
  isFlipping?: boolean;
  isNew?: boolean;
  bonusValue?: BonusValue | null;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onPointerCancel?: (e: React.PointerEvent) => void;
  onClick?: () => void;
  className?: string;
}

export function Tile({
  letter, owner, isWild = false, isFlipping = false, isNew = false,
  onPointerDown, onPointerMove, onPointerUp, onPointerCancel,
  onClick, className = '',
}: TileProps) {
  const isP1 = owner === 'player1';
  const isDraggable = !!onPointerDown;
  return (
    <div
      className={['tile-container', isNew && 'tile-new', className].filter(Boolean).join(' ')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={onClick}
      style={{ cursor: isDraggable ? 'grab' : onClick ? 'pointer' : 'default' }}
    >
      <div className={`tile-inner${isFlipping ? ' tile-flipping' : ''}`}>
        <div className={`tile-face tile-front ${isP1 ? 'tile-p1' : 'tile-p2'}`}>
          {/* Assigned wild: show letter dimmed. Unassigned wild: show centre dot only. */}
          {isWild && letter
            ? <span style={{ opacity: 0.3 }}>{letter}</span>
            : letter}
          {isWild && !letter && <span className="tile-wild-dot" />}
        </div>
        <div className={`tile-face tile-back  ${isP1 ? 'tile-p2' : 'tile-p1'}`}>{letter}</div>
        <div className={`tile-edge tile-edge-top    ${isP1 ? 'edge-p1' : 'edge-p2'}`} />
        <div className={`tile-edge tile-edge-bottom ${isP1 ? 'edge-p1' : 'edge-p2'}`} />
        <div className={`tile-edge tile-edge-left   ${isP1 ? 'edge-p1' : 'edge-p2'}`} />
        <div className={`tile-edge tile-edge-right  ${isP1 ? 'edge-p1' : 'edge-p2'}`} />
      </div>
    </div>
  );
}
