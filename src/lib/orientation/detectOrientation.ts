export type OrientationType =
  | 'portrait-primary'
  | 'portrait-secondary'
  | 'landscape-primary'
  | 'landscape-secondary'
  | 'unknown';

export type OrientationSnapshot = {
  isLandscape: boolean;
  orientationType: OrientationType;
  width: number;
  height: number;
  angle: number | null;
};

/** Read Screen Orientation API type when available. */
export function readScreenOrientationType(): OrientationType {
  if (typeof screen === 'undefined') return 'unknown';
  const type = screen.orientation?.type;
  if (
    type === 'portrait-primary' ||
    type === 'portrait-secondary' ||
    type === 'landscape-primary' ||
    type === 'landscape-secondary'
  ) {
    return type;
  }
  return 'unknown';
}

/** True when matchMedia landscape query matches (web). */
export function matchesLandscapeMediaQuery(): boolean | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  return window.matchMedia('(orientation: landscape)').matches;
}

/** Detect landscape: matchMedia → screen.orientation.type → width > height. */
export function detectIsLandscape(
  width: number,
  height: number,
  orientationType?: OrientationType,
): boolean {
  const media = matchesLandscapeMediaQuery();
  if (media !== null) return media;

  if (orientationType && orientationType !== 'unknown') {
    return orientationType.startsWith('landscape');
  }

  const type = readScreenOrientationType();
  if (type !== 'unknown') {
    return type.startsWith('landscape');
  }

  return width > height;
}

export function buildOrientationSnapshot(width: number, height: number): OrientationSnapshot {
  const orientationType = readScreenOrientationType();
  const angle =
    typeof screen !== 'undefined' && typeof screen.orientation?.angle === 'number'
      ? screen.orientation.angle
      : null;

  return {
    isLandscape: detectIsLandscape(width, height, orientationType),
    orientationType,
    width,
    height,
    angle,
  };
}
