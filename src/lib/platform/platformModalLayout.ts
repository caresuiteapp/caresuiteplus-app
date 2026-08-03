export type PlatformModalLayoutVariant = 'center' | 'bottomSheet';

/** Honor each caller's requested height while preserving safe viewport margins. */
export function resolvePlatformModalMaxHeight(
  screenHeight: number,
  variant: PlatformModalLayoutVariant,
  maxHeightRatio: number,
  centerMargin = 32,
): number {
  const safeRatio = Math.min(0.94, Math.max(0.6, maxHeightRatio));
  if (variant === 'bottomSheet') return screenHeight * safeRatio;
  return Math.min(screenHeight * safeRatio, screenHeight - centerMargin);
}
