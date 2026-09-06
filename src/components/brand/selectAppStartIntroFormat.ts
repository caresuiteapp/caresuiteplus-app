const aspectRatios = [
  { family: 'phone', ratio: 16 / 9 },
  { family: 'tablet43', ratio: 4 / 3 },
  { family: 'tablet1610', ratio: 16 / 10 },
] as const;

type IntroFamily = typeof aspectRatios[number]['family'];
export type AppStartIntroFormat = `${IntroFamily}-${'portrait' | 'landscape'}`;

/** Fit the actual window, including tablets/foldables and split-screen use. */
export function selectAppStartIntroFormat(width: number, height: number): AppStartIntroFormat {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 'phone-portrait';
  }
  const ratio = Math.max(width, height) / Math.min(width, height);
  const closest = aspectRatios.reduce((best, candidate) =>
    Math.abs(candidate.ratio - ratio) < Math.abs(best.ratio - ratio) ? candidate : best);
  return `${closest.family}-${width > height ? 'landscape' : 'portrait'}`;
}
