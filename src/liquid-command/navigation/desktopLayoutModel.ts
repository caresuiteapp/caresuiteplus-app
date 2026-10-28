/** Web CSS and native layout use the same card thresholds and reserved label space. */
export function desktopGridMetrics(fontScale: number, mobile: boolean, hasSuggestions: boolean) {
  const scale = Math.max(1, Number.isFinite(fontScale) ? fontScale : 1);
  const gap = mobile ? 10 : 14;
  const minimum = (mobile && !hasSuggestions ? 135 : 240) * scale;
  const labelHeight = Math.ceil((mobile ? 32 : 48) * scale + (mobile ? 12 : 16));
  return { scale, gap, minimum, labelHeight };
}

export function desktopGridColumns(available: number, minimum: number, gap: number, scale: number) {
  if (available >= Math.max(1900 * scale, 6 * minimum + 5 * gap)) return 6;
  return Math.max(1, Math.min(4, Math.floor((available + gap) / (minimum + gap))));
}

export function defaultDesktopWidgetIds<T extends { id: string }>(widgets: readonly T[], area: string, defaults: readonly string[], capacity: number) {
  return widgets.filter(widget => widget.id === 'document-catalog' || defaults.includes(widget.id) || !['office', 'assist'].includes(area)).slice(0, capacity).map(widget => widget.id);
}
