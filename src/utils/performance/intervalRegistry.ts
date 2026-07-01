/** Dev-only interval/timer registry — zero production overhead. */
const IS_DEV =
  typeof __DEV__ !== 'undefined'
    ? __DEV__
    : typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';

type IntervalEntry = {
  label: string;
  intervalMs: number;
  createdAt: number;
  id: ReturnType<typeof setInterval>;
};

const intervals = new Map<number, IntervalEntry>();
let nextHandle = 1;

export function registerDevInterval(
  label: string,
  intervalMs: number,
  id: ReturnType<typeof setInterval>,
): number {
  if (!IS_DEV) return 0;
  const handle = nextHandle++;
  intervals.set(handle, { label, intervalMs, createdAt: Date.now(), id });
  return handle;
}

export function unregisterDevInterval(handle: number): void {
  if (!IS_DEV) return;
  intervals.delete(handle);
}

export function getDevIntervalRegistry(): ReadonlyMap<number, IntervalEntry> {
  if (!IS_DEV) return new Map();
  return intervals;
}

export function logDevIntervals(): void {
  if (!IS_DEV || typeof console === 'undefined') return;
  if (intervals.size === 0) {
    console.info('[CareSuite perf] no tracked intervals');
    return;
  }
  console.info(
    '[CareSuite perf] intervals:',
    [...intervals.values()].map((e) => `${e.label}@${e.intervalMs}ms`),
  );
}
