import { useEffect, useRef, useState } from 'react';
import { PanResponder, type LayoutRectangle, type ScrollView, type View } from 'react-native';

export const NATIVE_DESKTOP_SCROLL_PADDING = 10;

type Point = { x: number; y: number };
type Drag = Point & { id: string; slot: number | null };
type ActiveDrag = { id: string; point: Point; edge: number; timer?: ReturnType<typeof setTimeout>; scrollTimer?: ReturnType<typeof setInterval> };

export function useNativeDesktopPlacement(page: number, pageCount: number, onPage: (page: number) => void, onPlace: (id: string, slot: number) => void) {
  const viewport = useRef<View>(null);
  const scroll = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const pendingId = useRef<string | null>(null);
  const contentHeight = useRef(0);
  const cells = useRef(new Map<number, LayoutRectangle>());
  const bounds = useRef<LayoutRectangle | null>(null);
  const current = useRef<ActiveDrag | null>(null);
  const latest = useRef({ page, pageCount, onPage, onPlace });
  latest.current = { page, pageCount, onPage, onPlace };
  const [drag, setDrag] = useState<Drag | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  useEffect(() => () => {
    clearTimeout(current.current?.timer);
    clearInterval(current.current?.scrollTimer);
  }, []);

  const targetAt = (point: Point) => {
    const viewportBounds = bounds.current;
    if (!viewportBounds) return null;
    const x = point.x - viewportBounds.x;
    const viewportY = point.y - viewportBounds.y;
    if (x < 0 || x > viewportBounds.width || viewportY < 0 || viewportY > viewportBounds.height) return null;
    const y = viewportY + scrollOffset.current - NATIVE_DESKTOP_SCROLL_PADDING;
    for (const [index, cell] of cells.current) {
      if (x >= cell.x && x <= cell.x + cell.width && y >= cell.y && y <= cell.y + cell.height) return index;
    }
    return null;
  };

  const update = (active: ActiveDrag, point: Point) => {
    active.point = point;
    const viewportBounds = bounds.current;
    if (!viewportBounds) return;
    const x = point.x - viewportBounds.x;
    const y = point.y - viewportBounds.y;
    const edge = y < 0 || y > viewportBounds.height ? 0 : x < 0 ? -1 : x > viewportBounds.width ? 1 : 0;
    if (edge !== active.edge) {
      clearTimeout(active.timer);
      active.edge = edge;
      if (edge) {
        active.timer = setTimeout(() => {
          const { page, pageCount, onPage } = latest.current;
          const next = page + edge;
          if (next >= 0 && next < pageCount) onPage(next);
        }, 550);
      }
    }
    setDrag({ id: active.id, x, y, slot: targetAt(point) });
  };

  const stop = () => {
    const active = current.current;
    if (!active) return;
    current.current = null;
    bounds.current = null;
    clearTimeout(active.timer);
    clearInterval(active.scrollTimer);
    setMovingId(null);
    setDrag(null);
    return active;
  };

  const latestUpdate = useRef({ update, stop, targetAt });
  latestUpdate.current = { update, stop, targetAt };
  const responder = useRef<ReturnType<typeof PanResponder.create> | null>(null);
  if (!responder.current) {
    responder.current = PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, state) => Boolean(pendingId.current && Math.hypot(state.dx, state.dy) >= 7),
      onPanResponderGrant: (event, state) => {
        const id = pendingId.current;
        if (!id) return;
        const point = { x: state.moveX || event.nativeEvent.pageX, y: state.moveY || event.nativeEvent.pageY };
        const active: ActiveDrag = { id, point, edge: 0 };
        current.current = active;
        setMovingId(id);
        viewport.current?.measure((_x, _y, width, height, x, y) => {
          if (current.current !== active) return;
          bounds.current = { x, y, width, height };
          latestUpdate.current.update(active, active.point);
        });
        active.scrollTimer = setInterval(() => {
          const viewportBounds = bounds.current;
          if (!viewportBounds) return;
          const x = active.point.x - viewportBounds.x;
          const y = active.point.y - viewportBounds.y;
          if (x < 0 || x > viewportBounds.width || y < 0 || y > viewportBounds.height) return;
          const step = y < 28 ? -14 : y > viewportBounds.height - 28 ? 14 : 0;
          const next = Math.min(Math.max(0, contentHeight.current - viewportBounds.height), Math.max(0, scrollOffset.current + step));
          if (next === scrollOffset.current) return;
          scrollOffset.current = next;
          scroll.current?.scrollTo({ y: next, animated: false });
          latestUpdate.current.update(active, active.point);
        }, 32);
      },
      onPanResponderMove: (_event, { moveX: x, moveY: y }) => { if (current.current) latestUpdate.current.update(current.current, { x, y }); },
      onPanResponderRelease: (event, { moveX, moveY }) => {
        const target = latestUpdate.current.targetAt({ x: moveX || event.nativeEvent.pageX, y: moveY || event.nativeEvent.pageY });
        const active = latestUpdate.current.stop();
        if (active && target !== null) latest.current.onPlace(active.id, target);
      },
      onPanResponderTerminate: () => latestUpdate.current.stop(),
      onPanResponderTerminationRequest: () => false,
    });
  }

  return {
    drag, movingId, viewport, scroll, cells, scrollOffset, contentHeight,
    handlers: responder.current.panHandlers,
    prepare: (id: string) => { pendingId.current = id; },
    clearPending: () => { pendingId.current = null; },
  };
}
