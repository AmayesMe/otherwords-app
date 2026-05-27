import './Tile.css';
import type { Player, BonusValue } from '../../game/types';

interface TileProps {
  letter: string;
  owner: Player;
  isFlipping?: boolean;
  isNew?: boolean;
  isStacked?: boolean;
  bonusValue?: BonusValue | null;
  className?: string;
  style?: React.CSSProperties;
}

export function Tile({ letter, owner, isFlipping = false, isNew = false, className = '' }: TileProps) {
  const isP1 = owner === 'player1';
  return (
    <div className={['tile-container', isNew && 'tile-new', className].filter(Boolean).join(' ')}>
      <div className={`tile-inner${isFlipping ? ' tile-flipping' : ''}`}>
        <div className={`tile-face tile-front ${isP1 ? 'tile-p1' : 'tile-p2'}`}>{letter}</div>
        <div className={`tile-face tile-back ${isP1 ? 'tile-p2' : 'tile-p1'}`}>{letter}</div>
        <div className={`tile-edge tile-edge-top    ${isP1 ? 'edge-p1' : 'edge-p2'}`} />
        <div className={`tile-edge tile-edge-bottom ${isP1 ? 'edge-p1' : 'edge-p2'}`} />
        <div className={`tile-edge tile-edge-left   ${isP1 ? 'edge-p1' : 'edge-p2'}`} />
        <div className={`tile-edge tile-edge-right  ${isP1 ? 'edge-p1' : 'edge-p2'}`} />
      </div>
    </div>
  );
}
