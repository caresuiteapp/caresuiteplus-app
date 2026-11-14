import { desktopGridColumns, desktopGridMetrics } from './desktopLayoutModel';

/** Geometry matches the Web pane, including the navigation and suggestion widths. */
export function nativeDesktopLayout(width: number, fontScale = 1, hasSuggestions = false) {
  const mobile = width < 900;
  const { scale, gap, minimum, labelHeight } = desktopGridMetrics(fontScale, mobile, hasSuggestions);
  const sidebar = width >= 900 * scale;
  const sidebarWidth = Math.round(260 * scale);
  const rail = Math.min(38, Math.max(24, Math.round(width * .026)));
  const padding = rail + 3;
  const framePadding = mobile ? 12 : 20;
  const workareaGap = sidebar ? 18 : 0;
  const pane = Math.max(1, width - framePadding * 2 - (sidebar ? sidebarWidth + workareaGap : 0));
  const available = Math.max(1, pane - padding * 2);
  const columns = desktopGridColumns(available, minimum, gap, scale);
  return { mobile, sidebar, sidebarWidth, framePadding, padding, rail, gap, workareaGap, columns, labelHeight, cardWidth: Math.max(1, (available - gap * (columns - 1)) / columns) };
}
