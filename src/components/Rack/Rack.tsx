import './Rack.css';
import { Tile } from '../Tile/Tile';
import { useGameStore } from '../../store/gameStore';
import { pointerDown, pointerMove, pointerUp, pointerCancel } from '../../utils/pointerDrag';

export function Rack() {
  const { getCurrentRack, currentPlayer, recallAllTiles, moveRackTileToSlot, placeTile, shuffleRack, endTurn, turnError } = useGameStore();
  const slots = getCurrentRack();

  return (
    <div className="rack-wrapper">
      <div className="rack-row">
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
                  onPointerDown={e => pointerDown(
                    e,
                    { type: 'rack', tileId: slot.id, slotIndex: i },
                    slot.isWild ? '' : slot.letter,
                    currentPlayer,
                  )}
                  onPointerMove={e => pointerMove(e)}
                  onPointerUp={e => {
                    const result = pointerUp(e);
                    if (!result) return; // tap — no action for rack tiles on tap
                    const { source, target } = result;
                    if (source.type !== 'rack') return;
                    if (target?.type === 'cell') {
                      placeTile(source.tileId, source.slotIndex, target.col, target.row);
                    } else if (target?.type === 'rack-slot') {
                      moveRackTileToSlot(source.tileId, source.slotIndex, target.slotIndex);
                    }
                    // Dropped off-board or on rack-area with no specific slot → do nothing
                  }}
                  onPointerCancel={e => pointerCancel(e)}
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
