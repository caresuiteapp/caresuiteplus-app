/** German nav badge label for unread/new counts (e.g. "1 Neu", "3 Neu"). */
export function formatNavBadgeLabel(count: number): string | undefined {
  if (count <= 0) return undefined;
  if (count === 1) return '1 Neu';
  return `${count} Neu`;
}
