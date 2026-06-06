import './Rack.css';
import { useState } from 'react';
import { Tile } from '../Tile/Tile';
import { useGameStore } from '../../store/gameStore';
import { pointerDown, pointerMove, pointerUp, pointerCancel } from '../../utils/pointerDrag';

const ROW_SIZE = 7; // max tiles per rack row

export function Rack() {
  const {
    getCurrentRack, currentPlayer, myRole, recallAllTiles, moveRackTileToSlot,
    placeTile, shuffleRack, endTurn, passTurn, turnError, isMyTurn, tileBag,
    currentTurnPlacements, bagClosed,
  } = useGameStore();
  const slots   = getCurrentRack();
  const canPlay = isMyTurn();
  const bagCount = tileBag.length;
  const hasTilesPlaced = Object.keys(currentTurnPlacements).length > 0;

  // Split into up to two rows when the rack holds more than ROW_SIZE tiles
  const row1 = slots.slice(0, ROW_SIZE);
  const row2 = slots.slice(ROW_SIZE); // empty array when ≤ 7 tiles

  const [confirmingPass, setConfirmingPass] = useState(false);

  function handleEndTurn() {
    if (!hasTilesPlaced) {
      setConfirmingPass(true);
    } else {
      endTurn();
    }
  }

  function confirmPass() {
    setConfirmingPass(false);
    passTurn();
  }

  function cancelPass() {
    setConfirmingPass(false);
  }

  /** Render a single rack slot at a given absolute slot index. */
  function renderSlot(slot: ReturnType<typeof getCurrentRack>[number], slotIndex: number) {
    return (
      <div
        key={slotIndex}
        className="rack-slot"
        data-drop-rack={slotIndex}
      >
        {slot && (
          <Tile
            letter={slot.isWild ? '' : slot.letter}
            owner={myRole ?? currentPlayer}
            isWild={slot.isWild}
            onPointerDown={canPlay ? e => pointerDown(
              e,
              { type: 'rack', tileId: slot.id, slotIndex },
              slot.isWild ? '' : slot.letter,
              myRole ?? currentPlayer,
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
    );
  }

  return (
    <div className="rack-wrapper">
      {/* Second row — only rendered when rack holds more than ROW_SIZE tiles */}
      {row2.length > 0 && (
        <div className="rack rack-overflow-row" data-drop-rack-area>
          {row2.map((slot, i) => renderSlot(slot, ROW_SIZE + i))}
        </div>
      )}

      <div className="rack-row">
        {/* Bag icon + count */}
        <div
          className={`bag-count${bagClosed ? ' bag-count-closed' : ''}`}
          title={bagClosed ? 'Bag is closed — no more draws' : `${bagCount} tile${bagCount === 1 ? '' : 's'} remaining in bag`}
        >
          <svg className="bag-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M7 5C7 3.343 8.343 2 10 2s3 1.343 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <path d="M5.5 5h9l1.5 10.5A1.5 1.5 0 0 1 14.5 17h-9A1.5 1.5 0 0 1 4 15.5L5.5 5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
          {bagClosed ? (
            /* Lock icon — bag is sealed */
            <svg className="bag-closed-icon" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <rect x="2" y="5.5" width="8" height="5.5" rx="1" fill="currentColor" opacity="0.7"/>
              <path d="M4 5.5V4a2 2 0 1 1 4 0v1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          ) : (
            <span className="bag-count-num">{bagCount}</span>
          )}
        </div>

        {/* Primary rack row — data-drop-rack-area lets board drops snap to rack */}
        <div className="rack" data-drop-rack-area>
          {row1.map((slot, i) => renderSlot(slot, i))}
        </div>

        <button className="btn btn-icon" onClick={shuffleRack} title="Shuffle tiles">⇄</button>
      </div>

      {canPlay && turnError && <div className="turn-error">{turnError}</div>}

      {/* Pass confirmation replaces the buttons only during the local player's turn.
          Turn controls use visibility:hidden (not conditional render) when not my turn
          so the rack keeps a constant height and the board never shifts between states. */}
      {canPlay && confirmingPass ? (
        <div className="pass-confirm">
          <span className="pass-confirm-text">Pass your turn?</span>
          <div className="pass-confirm-btns">
            <button className="btn btn-pass-yes" onClick={confirmPass}>Pass</button>
            <button className="btn btn-secondary" onClick={cancelPass}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="turn-controls" style={{ visibility: canPlay ? 'visible' : 'hidden' }}>
          <button className="btn btn-secondary" onClick={recallAllTiles} disabled={!hasTilesPlaced}>Reset</button>
          <button className="btn btn-primary" onClick={handleEndTurn}>End Turn</button>
        </div>
      )}
    </div>
  );
}
