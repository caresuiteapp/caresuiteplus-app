/** Seamless 240-second loop duration for global space motion background. */
export const BACKGROUND_LOOP_MS = 240_000;

const GLOBAL_KEY = '__careSuiteBackgroundStartTime';

type CareSuiteBackgroundGlobal = typeof globalThis & {
  __careSuiteBackgroundStartTime?: number;
};

function readGlobalStartTime(): number | undefined {
  return (globalThis as CareSuiteBackgroundGlobal)[GLOBAL_KEY];
}

function writeGlobalStartTime(value: number): void {
  (globalThis as CareSuiteBackgroundGlobal)[GLOBAL_KEY] = value;
}

/** Monotonic clock for canvas animation (ms within current loop). */
export function getBackgroundElapsedMs(): number {
  const existing = readGlobalStartTime();
  if (existing == null) {
    const now = performance.now();
    writeGlobalStartTime(now);
    return 0;
  }
  return (performance.now() - existing) % BACKGROUND_LOOP_MS;
}

/**
 * Phase angle 0..2π for the 240s loop. Integer speed multipliers keep motion seamless.
 * @param speedMultiplier 0 = frozen frame; 1 = normal; use small values for reduced motion.
 */
export function getBackgroundPhase(speedMultiplier = 1): number {
  if (speedMultiplier <= 0) return 0;
  const elapsed = getBackgroundElapsedMs() * speedMultiplier;
  const loopMs = BACKGROUND_LOOP_MS;
  return ((elapsed % loopMs) / loopMs) * Math.PI * 2;
}

/** Seconds elapsed in current loop (for motion helpers that expect time in seconds). */
export function getBackgroundLoopSeconds(speedMultiplier = 1): number {
  if (speedMultiplier <= 0) return 0;
  return (getBackgroundElapsedMs() * speedMultiplier) / 1000;
}

/** Test helper — reset global start to simulate phase at elapsed ms. */
export function __resetBackgroundStartForTests(elapsedMs = 0): void {
  writeGlobalStartTime(performance.now() - elapsedMs);
}
