/** Reflow inside the measured workspace; never scale down the desktop or its text. */
export function resolveDesktopGridLayout(availableWidth: number, fontScale = 1, availableHeight = 0, slotCount = 12) {
  const width = Math.max(0, Number.isFinite(availableWidth) ? availableWidth : 0);
  const scale = Math.max(1, Number.isFinite(fontScale) ? fontScale : 1);
  const gap = 14;
  const minCardWidth = 240 * scale;
  const capacity = Math.max(1, Math.floor((width + gap) / (minCardWidth + gap)));
  // Twelve slots form complete rows; avoid a lone pair below two rows of five.
  const candidates = width >= 1900 * scale ? [6, 4, 3, 2, 1] : [4, 3, 2, 1];
  const columns = candidates.find(count => count <= capacity)!;
  const cardWidth = Math.max(0, Math.floor((width - gap * (columns - 1)) / columns * 100) / 100);
  const rows = Math.ceil(Math.max(1, slotCount) / columns);
  const labelHeight = Math.ceil(48 * scale + 16); // room for two readable title lines
  const minImageHeight = 72;
  const maxImageHeight = Math.min(180, Math.max(minImageHeight, cardWidth * 0.55));
  const rowBudget = (availableHeight - 24 - gap * (rows - 1)) / rows;
  const imageHeight = Math.floor(Math.max(minImageHeight, Math.min(maxImageHeight,
    availableHeight > 0 ? rowBudget - labelHeight - 12 : maxImageHeight)));
  const cardHeight = labelHeight + imageHeight + 12;
  return { columns, rows, gap, cardWidth, cardHeight, labelHeight, imageHeight,
    contentHeight: rows * cardHeight + gap * (rows - 1) + 24 };
}
