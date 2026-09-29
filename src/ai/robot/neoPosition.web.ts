/** Drag-only position management, independent of microphone and speech state. */
export function makeNeoDraggable(host: HTMLElement, button: HTMLButtonElement, storageKey: string, onDrag: () => void) {
  let saved: { x: number; y: number } | null = null;
  let drag: { id: number; x: number; y: number; left: number; top: number; moved: boolean } | null = null;
  let suppressClickUntil = 0;
  const limits = () => ({ x: Math.max(0, innerWidth - host.offsetWidth - 16), y: Math.max(0, innerHeight - host.offsetHeight - 16) });
  const position = (left: number, top: number) => {
    const max = limits();
    host.style.left = `${8 + Math.min(max.x, Math.max(0, left - 8))}px`;
    host.style.top = `${8 + Math.min(max.y, Math.max(0, top - 8))}px`;
    host.style.transform = 'none';
  };
  const defaultPosition = () => {
    const anchor = document.querySelector<HTMLElement>('[aria-label^="Kontomenü von "]');
    const bar = anchor?.getBoundingClientRect();
    let top = bar && bar.height > 0 && bar.top < 160 ? bar.top + bar.height / 2 - host.offsetHeight / 2 : innerWidth <= 540 ? 20 : 28;
    let left = (innerWidth - host.offsetWidth) / 2;
    const controls = anchor?.parentElement?.getBoundingClientRect();
    if (controls && controls.height > 0 && controls.height <= 150 && controls.top < 160 && left < controls.right && left + host.offsetWidth > controls.left) {
      if (controls.left >= host.offsetWidth + 24) left = controls.left - host.offsetWidth - 16;
      else if (controls.right + host.offsetWidth + 24 <= innerWidth) left = controls.right + 16;
      else top = controls.bottom + 12;
    }
    position(left, top);
  };
  const restore = () => { if (saved) { const max = limits(); position(8 + saved.x * max.x, 8 + saved.y * max.y); } else defaultPosition(); };
  const save = () => {
    const rect = host.getBoundingClientRect(), max = limits();
    saved = { x: max.x ? Math.min(1, Math.max(0, (rect.left - 8) / max.x)) : 0, y: max.y ? Math.min(1, Math.max(0, (rect.top - 8) / max.y)) : 0 };
    try { localStorage.setItem(storageKey, JSON.stringify(saved)); } catch { /* storage disabled */ }
  };
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (data && Number.isFinite(data.x) && Number.isFinite(data.y) && data.x >= 0 && data.x <= 1 && data.y >= 0 && data.y <= 1) saved = data;
  } catch { /* invalid or unavailable storage */ }
  restore();
  button.style.touchAction = 'none';
  const down = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClickUntil = 0;
    const rect = host.getBoundingClientRect();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, moved: false };
    button.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return;
    const x = event.clientX - drag.x, y = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(x, y) < 7) return;
    if (!drag.moved) { drag.moved = true; onDrag(); }
    event.preventDefault(); button.style.cursor = 'grabbing'; position(drag.left + x, drag.top + y);
  };
  const up = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return;
    if (drag.moved) { save(); suppressClickUntil = performance.now() + 400; }
    drag = null; button.style.cursor = 'grab';
    if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
  };
  const click = (event: MouseEvent) => {
    if (event.detail !== 0 && performance.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
  };
  const key = (event: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
    event.preventDefault(); onDrag();
    if (event.key === 'Home') {
      saved = null; defaultPosition();
      try { localStorage.removeItem(storageKey); } catch { /* storage disabled */ }
      return;
    }
    const rect = host.getBoundingClientRect(), step = event.shiftKey ? 40 : 10;
    position(rect.left + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), rect.top + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0)); save();
  };
  button.style.cursor = 'grab';
  button.addEventListener('pointerdown', down); button.addEventListener('pointermove', move);
  button.addEventListener('pointerup', up); button.addEventListener('pointercancel', up);
  button.addEventListener('click', click, true); button.addEventListener('keydown', key);
  window.addEventListener('resize', restore);
  const anchor = document.querySelector<HTMLElement>('[aria-label^="Kontomenü von "]');
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => { if (!saved) defaultPosition(); });
  if (anchor) observer?.observe(anchor);
  return () => {
    button.removeEventListener('pointerdown', down); button.removeEventListener('pointermove', move);
    button.removeEventListener('pointerup', up); button.removeEventListener('pointercancel', up);
    button.removeEventListener('click', click, true); button.removeEventListener('keydown', key); window.removeEventListener('resize', restore); observer?.disconnect();
  };
}
