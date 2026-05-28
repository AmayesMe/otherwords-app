import './Rack.css';
import { Tile } from '../Tile/Tile';
import { useGameStore } from '../../store/gameStore';
import { pointerDown, pointerMove, pointerUp, pointerCancel } from '../../utils/pointerDrag';

export function Rack() {
  const { getCurrentRack, currentPlayer, recallAllTiles, moveRackTileToSlot, placeTile, shuffleRack, endTurn, turnError, isMyTurn, tileBag } = useGameStore();
  const slots = getCurrentRack();
  const canPlay = isMyTurn();
  const bagCount = tileBag.length;

  return (
    <div className="rack-wrapper">
      <div className="rack-row">
        {/* Tile bag counter */}
        <div className="bag-count" title={`${bagCount} tile${bagCount === 1 ? '' : 's'} remaining in bag`}>
          <svg className="bag-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M7 5C7 3.343 8.343 2 10 2s3 1.343 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <path d="M5.5 5h9l1.5 10.5A1.5 1.5 0 0 1 14.5 17h-9A1.5 1.5 0 0 1 4 15.5L5.5 5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
          <span className="bag-count-num">{bagCount}</span>
        </div>

        {/* data-drop-rack-area lets board tiles detect a drop on the rack (→ recall) */}
        <div className="rack" data-drop-rack-area>
          {slots.map((slot, i) => (
            <div
              key={i}
              className="rack-slot"
              data-drop-rack={i}
            >
              {slot && (
                <Tile
                  letter={slot.isWild ? '' : slot.letter}
                  owner={currentPlayer}
                  isWild={slot.isWild}
                  onPointerDown={canPlay ? e => pointerDown(
                    e,
                    { type: 'rack', tileId: slot.id, slotIndex: i },
                    slot.isWild ? '' : slot.letter,
                    currentPlayer,
                  ) : undefined}
                  onPointerMove={canPlay ? e => pointerMove(e) : undefined}
                  onPointerUp={canPlay ? e => {
                    const result = pointerUp(e);
                    if (!result) return;
                    const { source, target } = result;
                    if (source.type !== 'rack') return;
                    if (target?.type === 'cell') {
                      placeTile(source.tileId, source.slotIndex, target.col, target.row);
                    } else if (target?.type === 'rack-slot') {
                      moveRackTileToSlot(source.tileId, source.slotIndex, target.slotIndex);
                    }
                  } : undefined}
                  onPointerCancel={canPlay ? e => pointerCancel(e) : undefined}
                />
              )}
            </div>
          ))}
        </div>
        <button className="btn btn-icon" onClick={shuffleRack} title="Shuffle tiles">⇄</button>
      </div>
      {turnError && <div className="turn-error">{turnError}</div>}
      <div className="turn-controls">
        <button className="btn btn-secondary" onClick={recallAllTiles} disabled={!canPlay}>Reset Turn</button>
        <button className="btn btn-primary" onClick={endTurn} disabled={!canPlay}>End Turn</button>
      </div>
    </div>
  );
}
