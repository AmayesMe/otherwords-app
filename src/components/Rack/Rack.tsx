import './Rack.css';
import { Tile } from '../Tile/Tile';
import type { Player, RackTile } from '../../game/types';

interface RackProps {
  tiles: RackTile[];
  player: Player;
  maxSize?: number;
}

export function Rack({ tiles, player, maxSize = 7 }: RackProps) {
  const slots = Array.from({ length: Math.max(maxSize, tiles.length) });

  return (
    <div className="rack-wrapper">
      <div className="rack">
        {slots.map((_, i) => {
          const tile = tiles[i];
          return (
            <div key={i} className="rack-slot">
              {tile && (
                <Tile
                  letter={tile.isWild ? '★' : tile.letter}
                  owner={player}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="turn-controls">
        <button className="btn btn-secondary">Reset Turn</button>
        <button className="btn btn-primary">End Turn</button>
      </div>
    </div>
  );
}
