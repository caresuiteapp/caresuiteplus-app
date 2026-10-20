/** Dev-only guard against render storms — zero production overhead. */
const IS_DEV =
  typeof __DEV__ !== 'undefined'
    ? __DEV__
    : typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';

type RenderWindow = { count: number; windowStart: number };

const windows = new Map<string, RenderWindow>();

const DEFAULT_WINDOW_MS = 1000;
const DEFAULT_MAX_RENDERS = 30;

export type RenderGuardOptions = {
  label: string;
  windowMs?: number;
  maxRenders?: number;
};

export function guardDevRender(options: RenderGuardOptions): void {
  if (!IS_DEV || typeof console === 'undefined') return;

  const { label, windowMs = DEFAULT_WINDOW_MS, maxRenders = DEFAULT_MAX_RENDERS } = options;
  const now = Date.now();
  const current = windows.get(label);

  if (!current || now - current.windowStart > windowMs) {
    windows.set(label, { count: 1, windowStart: now });
    return;
  }

  current.count += 1;
  if (current.count === maxRenders + 1) {
    console.warn(
      `[CareSuite perf] render storm: "${label}" exceeded ${maxRenders} renders in ${windowMs}ms`,
    );
  }
}

export function resetRenderGuard(): void {
  if (!IS_DEV) return;
  windows.clear();
}
