/** Size cards from the available workspace, including the user's text size. */
export function resolveDesktopGridLayout(availableWidth: number, fontScale = 1) {
  const width = Math.max(0, Number.isFinite(availableWidth) ? availableWidth : 0);
  const scale = Math.max(1, Number.isFinite(fontScale) ? fontScale : 1);
  const gap = 20;
  const minCardWidth = 300 * scale;
  const columns = Math.max(1, Math.min(6, Math.floor((width + gap) / (minCardWidth + gap))));
  return { columns, gap, cardWidth: Math.max(0, (width - gap * (columns - 1)) / columns) };
}
