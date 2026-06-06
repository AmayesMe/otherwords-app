/**
 * Pointer-event drag system — works on iOS Safari, Android, and desktop.
 * Replaces HTML5 drag-and-drop, which is unsupported on iOS.
 *
 * Usage:
 *   onPointerDown → call pointerDown()          (starts drag, captures pointer)
 *   onPointerMove → call pointerMove()          (moves ghost, enforces threshold)
 *   onPointerUp   → call pointerUp() → dispatch store action based on DropResult
 *   onPointerCancel → call pointerCancel()      (cleans up on OS-level cancel)
 *
 * Drop targets are detected via data attributes on the DOM:
 *   data-drop-col / data-drop-row   → board cell
 *   data-drop-rack                  → specific rack slot index
 *   data-drop-rack-area             → rack area (board→rack recall)
 */

import { createTileDragImage } from './dragImage';
import type { Player } from '../game/types';

const DRAG_THRESHOLD = 6; // px — below this, treat as a tap

// ─── Types ───────────────────────────────────────────────────────────────────

export type DragSource =
  | { type: 'rack'; tileId: string; slotIndex: number }
  | { type: 'board'; col: number; row: number };

export type DropTarget =
  | { type: 'cell'; col: number; row: number }
  | { type: 'rack-slot'; slotIndex: number }
  | { type: 'rack-area' }
  | null;

export interface DropResult {
  source: DragSource;
  target: DropTarget;
}

// ─── Module-level state (only one drag active at a time) ─────────────────────

interface ActiveDrag {
  source: DragSource;
  ghost: HTMLElement;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  el: HTMLElement;
}

let active: ActiveDrag | null = null;

// When a real drag completes we suppress the click that browsers fire afterward.
let suppressNextClick = false;

// ─── Public API ──────────────────────────────────────────────────────────────

/** Start a drag. Call from onPointerDown on a draggable tile. */
export function pointerDown(
  e: React.PointerEvent,
  source: DragSource,
  letter: string,
  owner: Player,
): void {
  if (active) return;
  e.preventDefault();  // Prevent Safari from starting a native drag-and-drop on text content
  e.stopPropagation();

  const el = e.currentTarget as HTMLElement;
  el.setPointerCapture(e.pointerId); // route all future events here

  // Safety net: if pointer capture is lost unexpectedly (Safari can break it),
  // clean up so the tile doesn't stay stuck in the dragging state.
  el.addEventListener('lostpointercapture', handleLostCapture, { once: true });

  // Ghost starts off-screen; repositioned in pointerMove once threshold crossed
  const ghost = createTileDragImage(letter, owner);
  ghost.style.zIndex = '9999';
  ghost.style.transform = 'translate(-50%, -50%)';
  document.body.appendChild(ghost);

  active = { source, ghost, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false, el };
}

/** Cleans up if pointer capture is dropped unexpectedly (Safari + pointer-events edge cases). */
function handleLostCapture(): void {
  if (!active) return;
  active.el.classList.remove('tile-dragging');
  active.ghost.remove();
  active = null;
}

/** Track movement and reveal ghost after threshold. Call from onPointerMove. */
export function pointerMove(e: React.PointerEvent): void {
  if (!active || e.pointerId !== active.pointerId) return;
  e.preventDefault(); // prevent scroll while dragging

  const dx = e.clientX - active.startX;
  const dy = e.clientY - active.startY;

  if (!active.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
    active.moved = true;
    active.el.classList.add('tile-dragging');
  }

  if (active.moved) {
    active.ghost.style.left = `${e.clientX}px`;
    active.ghost.style.top = `${e.clientY}px`;
  }
}

/**
 * End the drag. Returns a DropResult if movement exceeded the threshold
 * (a real drag), or null if it was a tap (let the click event handle it).
 * Call from onPointerUp.
 */
export function pointerUp(e: React.PointerEvent): DropResult | null {
  if (!active || e.pointerId !== active.pointerId) return null;

  const wasDrag = active.moved;
  active.el.removeEventListener('lostpointercapture', handleLostCapture);
  active.el.classList.remove('tile-dragging');
  active.ghost.remove();
  const saved = active;
  active = null;

  if (!wasDrag) return null; // tap — onClick will fire next

  // Suppress the click event browsers sometimes fire after a drag gesture
  suppressNextClick = true;
  setTimeout(() => { suppressNextClick = false; }, 300);

  // ghost has pointer-events:none, so elementFromPoint sees what's beneath it
  const hit = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
  if (!hit) return { source: saved.source, target: null };

  // Board cell?
  const cellEl = hit.closest('[data-drop-col]') as HTMLElement | null;
  if (cellEl) {
    return {
      source: saved.source,
      target: { type: 'cell', col: +cellEl.dataset.dropCol!, row: +cellEl.dataset.dropRow! },
    };
  }

  // Specific rack slot (check before rack-area — slot is inside rack)
  const slotEl = hit.closest('[data-drop-rack]') as HTMLElement | null;
  if (slotEl) {
    return { source: saved.source, target: { type: 'rack-slot', slotIndex: +slotEl.dataset.dropRack! } };
  }

  // Rack area generally (for board→rack recalls)
  const rackEl = hit.closest('[data-drop-rack-area]') as HTMLElement | null;
  if (rackEl) {
    return { source: saved.source, target: { type: 'rack-area' } };
  }

  return { source: saved.source, target: null };
}

/** Cancel drag (OS interrupted — e.g. incoming call). Call from onPointerCancel. */
export function pointerCancel(e: React.PointerEvent): void {
  if (!active || e.pointerId !== active.pointerId) return;
  active.el.removeEventListener('lostpointercapture', handleLostCapture);
  active.el.classList.remove('tile-dragging');
  active.ghost.remove();
  active = null;
}

/** Returns true (and clears the flag) if a real drag just finished — use to suppress onClick. */
export function shouldSuppressClick(): boolean {
  if (suppressNextClick) { suppressNextClick = false; return true; }
  return false;
}
