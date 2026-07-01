/** Dev-only render counter — zero production overhead. */
const IS_DEV =
  typeof __DEV__ !== 'undefined'
    ? __DEV__
    : typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';

const renderCounts = new Map<string, number>();

export function trackDevRender(label: string): number {
  if (!IS_DEV) return 0;
  const next = (renderCounts.get(label) ?? 0) + 1;
  renderCounts.set(label, next);
  return next;
}

export function getDevRenderCounts(): ReadonlyMap<string, number> {
  if (!IS_DEV) return new Map();
  return renderCounts;
}

export function resetDevRenderCounts(): void {
  if (!IS_DEV) return;
  renderCounts.clear();
}

export function logDevRenderCounts(topN = 10): void {
  if (!IS_DEV || typeof console === 'undefined') return;
  const sorted = [...renderCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN);
  if (sorted.length === 0) return;
  console.info('[CareSuite perf] top renders:', Object.fromEntries(sorted));
}
