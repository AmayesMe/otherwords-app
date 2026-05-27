export function createTileDragImage(letter: string, owner: 'player1' | 'player2'): HTMLElement {
  const size = 50;
  const el = document.createElement('div');
  el.style.cssText = [
    `width:${size}px`, `height:${size}px`,
    `background:${owner === 'player1' ? '#111111' : '#F2F0EB'}`,
    `color:${owner === 'player1' ? '#FFFFFF' : '#111111'}`,
    'display:flex', 'align-items:center', 'justify-content:center',
    `font-size:${Math.round(size * 0.54)}px`,
    'font-weight:800', "font-family:'Inter',system-ui,sans-serif",
    `border-radius:3px`,
    'position:fixed', 'top:-9999px', 'left:-9999px',
    'pointer-events:none',
  ].join(';');
  el.textContent = letter;
  return el;
}
