import './Cell.css';
import { Tile } from '../Tile/Tile';
import type { CellState } from '../../game/types';

interface CellProps {
  state: CellState;
  col: number;
  row: number;
  isCenter: boolean;
  isCurrentTurnTile?: boolean;
}

const BONUS_LABELS: Record<number, string> = { 1: '+1', 2: '+2', 3: '+3' };
const BONUS_CLASS: Record<number, string> = { 1: 'bonus-1', 2: 'bonus-2', 3: 'bonus-3' };

export function Cell({ state, col, row, isCenter, isCurrentTurnTile = false }: CellProps) {
  const { tile, bonus, bonusUsed } = state;
  const showBonus = bonus && !tile && !bonusUsed;
  const showPip = bonus && bonusUsed && tile;

  return (
    <div
      className={[
        'cell',
        showBonus && BONUS_CLASS[bonus!],
      ].filter(Boolean).join(' ')}
      data-col={col}
      data-row={row}
    >
      {!tile && isCenter && <span className="center-star">★</span>}
      {showBonus && <span className="bonus-label">{BONUS_LABELS[bonus!]}</span>}
      {tile && (
        <Tile
          letter={tile.isWild && tile.wildLetter ? tile.wildLetter : tile.letter}
          owner={tile.owner}
          isNew={isCurrentTurnTile}
        />
      )}
      {showPip && <span className="bonus-pip">{BONUS_LABELS[bonus!]}</span>}
    </div>
  );
}
