import './Cell.css';
import { Tile } from '../Tile/Tile';
import { useGameStore } from '../../store/gameStore';
import { pointerDown, pointerMove, pointerUp, pointerCancel, shouldSuppressClick } from '../../utils/pointerDrag';
import type { CellState } from '../../game/types';

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
  const { moveTile, recallTile, isCurrentTurnTile, currentPlayer } = useGameStore();
  const isThisTurn = isCurrentTurnTile(col, row);
  const showBonus = bonus && !tile && !bonusUsed;
  const showPip   = bonus && bonusUsed && tile;

  function handleTileClick() {
    if (shouldSuppressClick()) return; // ignore click fired after a drag gesture
    if (isThisTurn) recallTile(col, row);
  }

  return (
    <div
      className={['cell', showBonus && BONUS_CLASS[bonus!]].filter(Boolean).join(' ')}
      data-drop-col={col}
      data-drop-row={row}
    >
      {!tile && isCenter && <span className="center-star">★</span>}
      {showBonus && <span className="bonus-label">{BONUS_LABELS[bonus!]}</span>}

      {tile && (
        <Tile
          letter={tile.wildLetter ?? (tile.isWild ? '' : tile.letter)}
          isWild={tile.isWild}
          owner={tile.owner}
          isNew={isThisTurn}
          onPointerDown={isThisTurn ? e => pointerDown(e, { type: 'board', col, row }, tile.wildLetter ?? tile.letter, currentPlayer) : undefined}
          onPointerMove={isThisTurn ? e => pointerMove(e) : undefined}
          onPointerUp={isThisTurn ? e => {
            const result = pointerUp(e);
            if (!result) return; // was a tap — onClick handles recall
            const { source, target } = result;
            if (source.type !== 'board') return;
            if (target?.type === 'cell') {
              // Dropped on a board cell
              if (target.col !== source.col || target.row !== source.row) {
                moveTile(source.col, source.row, target.col, target.row);
              }
            } else {
              // Dropped on rack or off-board — recall
              recallTile(source.col, source.row);
            }
          } : undefined}
          onPointerCancel={isThisTurn ? e => pointerCancel(e) : undefined}
          onClick={handleTileClick}
        />
      )}

      {showPip && <span className="bonus-pip">{BONUS_LABELS[bonus!]}</span>}
    </div>
  );
}
