const DRAG_SCROLL_EDGE_PX = 96;
const DRAG_SCROLL_MAX_STEP_PX = 24;

function scrollableAncestors(element: Element | null): HTMLElement[] {
  if (
    typeof window === 'undefined'
    || typeof document === 'undefined'
    || typeof HTMLElement === 'undefined'
  ) {
    return [];
  }
  const ancestors: HTMLElement[] = [];
  let current = element instanceof HTMLElement ? element.parentElement : null;
  while (current) {
    const style = window.getComputedStyle(current);
    const scrollable =
      /(auto|scroll)/.test(style.overflowY)
      && current.scrollHeight > current.clientHeight + 1;
    if (scrollable) ancestors.push(current);
    current = current.parentElement;
  }
  const root = document.scrollingElement;
  if (root instanceof HTMLElement && !ancestors.includes(root)) ancestors.push(root);
  return ancestors;
}

export function calculateAssignmentDragScrollDelta(
  pointerY: number,
  top: number,
  bottom: number,
): number {
  if (pointerY < top + DRAG_SCROLL_EDGE_PX) {
    const strength = Math.min(1, (top + DRAG_SCROLL_EDGE_PX - pointerY) / DRAG_SCROLL_EDGE_PX);
    return -Math.max(4, Math.round(strength * DRAG_SCROLL_MAX_STEP_PX));
  }
  if (pointerY > bottom - DRAG_SCROLL_EDGE_PX) {
    const strength = Math.min(1, (pointerY - (bottom - DRAG_SCROLL_EDGE_PX)) / DRAG_SCROLL_EDGE_PX);
    return Math.max(4, Math.round(strength * DRAG_SCROLL_MAX_STEP_PX));
  }
  return 0;
}

export function autoScrollAssignmentProfileDrag(pointerX: number, pointerY: number): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const pointedElement = document.elementFromPoint(pointerX, pointerY);
  const candidates = scrollableAncestors(pointedElement);

  for (const candidate of candidates) {
    const isDocumentScroller = candidate === document.scrollingElement;
    const rect = isDocumentScroller
      ? { top: 0, bottom: window.innerHeight }
      : candidate.getBoundingClientRect();
    const visibleTop = Math.max(0, rect.top);
    const visibleBottom = Math.min(window.innerHeight, rect.bottom);
    const delta = calculateAssignmentDragScrollDelta(pointerY, visibleTop, visibleBottom);
    if (!delta) continue;

    const canScrollUp = delta < 0 && candidate.scrollTop > 0;
    const canScrollDown =
      delta > 0
      && candidate.scrollTop + candidate.clientHeight < candidate.scrollHeight - 1;
    if (!canScrollUp && !canScrollDown) continue;

    candidate.scrollBy({ top: delta, behavior: 'auto' });
    return true;
  }

  return false;
}
