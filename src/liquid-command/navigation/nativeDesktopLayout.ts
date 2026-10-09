/** Geometry follows the available pane rather than the physical device name. */
export function nativeDesktopLayout(width: number, fontScale = 1) {
  const scale = Math.max(1, fontScale);
  const sidebar = width >= 980 * scale;
  const sidebarWidth = Math.min(360, Math.round(280 * scale));
  const padding = width < 600 ? 16 : 24;
  const gap = 16;
  const pane = Math.max(1, width - (sidebar ? sidebarWidth + gap : 0));
  const available = Math.max(1, pane - padding * 2);
  const columns = Math.max(1, Math.min(4, Math.floor((available + gap) / (230 * scale + gap))));
  return { sidebar, sidebarWidth, padding, gap, columns, cardWidth: Math.max(1, (available - gap * (columns - 1)) / columns) };
}

export function moveNativeDesktopWidget(ids: readonly string[], id: string, delta: -1 | 1) {
  const next = [...ids]; const from = next.indexOf(id); const to = from + delta;
  if (from < 0 || to < 0 || to >= next.length) return next;
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
