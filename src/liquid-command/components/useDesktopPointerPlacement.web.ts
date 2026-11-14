import { useEffect, useRef, useState, type PointerEvent } from 'react';

type Point = { x: number; y: number };
type Drag = Point & { id: string; slot: number | null };
type Pointer = {
  id: string;
  pointerId: number;
  start: Point;
  point: Point;
  dragging: boolean;
  arrow: HTMLButtonElement | null;
  hoverTimer?: ReturnType<typeof setTimeout>;
  scrollTimer?: ReturnType<typeof setInterval>;
};

export function useDesktopPointerPlacement(onPlace: (id: string, slot: number) => void) {
  const frame = useRef<HTMLDivElement>(null);
  const pointer = useRef<Pointer | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  useEffect(() => () => {
    clearTimeout(pointer.current?.hoverTimer);
    clearInterval(pointer.current?.scrollTimer);
  }, []);

  const begin = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    if (event.button !== 0 || pointer.current) return;
    const start = { x: event.clientX, y: event.clientY };
    pointer.current = { id, pointerId: event.pointerId, start, point: start, dragging: false, arrow: null };
  };

  const hit = ({ x, y }: Point) => {
    const element = document.elementFromPoint(x, y);
    return element && frame.current?.contains(element) ? element : null;
  };
  const slotAt = (element: Element | null) => {
    const cell = element?.closest<HTMLElement>('[data-cs-desktop-slot]');
    return cell ? Number(cell.dataset.csDesktopSlot) : null;
  };

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const active = pointer.current;
    if (!active || event.pointerId !== active.pointerId) return;
    const point = { x: event.clientX, y: event.clientY };
    if (!active.dragging) {
      if (Math.hypot(point.x - active.start.x, point.y - active.start.y) < 7) return;
      active.dragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      // Scrolling the viewport keeps offscreen positions reachable during a touch or mouse drag.
      active.scrollTimer = setInterval(() => {
        const viewport = frame.current?.querySelector<HTMLElement>('[data-cs-desktop-widget-viewport]');
        if (!viewport) return;
        const bounds = viewport.getBoundingClientRect();
        const { x, y } = active.point;
        if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) return;
        const step = y < bounds.top + 28 ? -16 : y > bounds.bottom - 28 ? 16 : 0;
        if (step === 0) return;
        const previous = viewport.scrollTop;
        viewport.scrollTop += step;
        if (previous !== viewport.scrollTop) setDrag({ ...active.point, id: active.id, slot: slotAt(hit(active.point)) });
      }, 32);
    }
    event.preventDefault();
    active.point = point;
    const element = hit(point);
    const arrow = element?.closest<HTMLButtonElement>('[data-cs-desktop-page-arrow]') ?? null;
    if (active.arrow !== arrow) {
      clearTimeout(active.hoverTimer);
      active.arrow = arrow;
      if (arrow && !arrow.disabled) {
        active.hoverTimer = setTimeout(() => {
          arrow.click();
          setDrag({ ...active.point, id: active.id, slot: null });
        }, 550);
      }
    }
    setDrag({ ...point, id: active.id, slot: slotAt(element) });
  };

  const finish = (event: PointerEvent<HTMLDivElement>, drop: boolean) => {
    const active = pointer.current;
    if (!active || event.pointerId !== active.pointerId) return;
    pointer.current = null;
    clearTimeout(active.hoverTimer);
    clearInterval(active.scrollTimer);
    if (!active.dragging) return;
    setDrag(null);
    if (drop) {
      const slot = slotAt(hit({ x: event.clientX, y: event.clientY }));
      if (slot !== null) onPlace(active.id, slot);
    }
  };

  return {
    frame, drag, begin, move, finish,
    leave: () => { if (!pointer.current?.dragging) pointer.current = null; },
  };
}
