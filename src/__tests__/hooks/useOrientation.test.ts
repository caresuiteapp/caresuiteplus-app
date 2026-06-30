import { describe, expect, it } from 'vitest';
import {
  LANDSCAPE_REQUIRED_SCREENS,
  resolveLandscapeOverlayVariant,
  resolveLandscapeRequirement,
  shouldBlockUntilLandscape,
  shouldShowLandscapeOverlay,
} from '@/config/landscapeRequiredScreens';
import {
  buildOrientationSnapshot,
  detectIsLandscape,
  matchesLandscapeMediaQuery,
  readScreenOrientationType,
} from '@/lib/orientation/detectOrientation';

describe('landscapeRequiredScreens config', () => {
  it('registers signature as required and visit execution as preferred', () => {
    expect(LANDSCAPE_REQUIRED_SCREENS.signature).toBe('required');
    expect(LANDSCAPE_REQUIRED_SCREENS.visitExecution).toBe('preferred');
    expect(LANDSCAPE_REQUIRED_SCREENS.calendar).toBe('supported');
  });

  it('resolveLandscapeRequirement returns configured value', () => {
    expect(resolveLandscapeRequirement('signature')).toBe('required');
    expect(resolveLandscapeRequirement('tables')).toBe('supported');
  });
});

describe('shouldShowLandscapeOverlay', () => {
  it('shows overlay for required/preferred on mobile portrait only', () => {
    expect(shouldShowLandscapeOverlay('required', false, true, false)).toBe(true);
    expect(shouldShowLandscapeOverlay('preferred', false, true, false)).toBe(true);
    expect(shouldShowLandscapeOverlay('required', true, true, false)).toBe(false);
    expect(shouldShowLandscapeOverlay('required', false, false, false)).toBe(false);
    expect(shouldShowLandscapeOverlay('supported', false, true, false)).toBe(false);
    expect(shouldShowLandscapeOverlay('portrait', false, true, false)).toBe(false);
  });

  it('hides overlay when user dismissed the banner', () => {
    expect(shouldShowLandscapeOverlay('preferred', false, true, true)).toBe(false);
  });
});

describe('shouldBlockUntilLandscape', () => {
  it('blocks only required screens on mobile without bypass', () => {
    expect(shouldBlockUntilLandscape('required', true, false)).toBe(true);
    expect(shouldBlockUntilLandscape('preferred', true, false)).toBe(false);
    expect(shouldBlockUntilLandscape('required', false, false)).toBe(false);
    expect(shouldBlockUntilLandscape('required', true, true)).toBe(false);
  });
});

describe('resolveLandscapeOverlayVariant', () => {
  it('uses banner for preferred and hint after lock failure on required', () => {
    expect(resolveLandscapeOverlayVariant('preferred', false, false)).toBe('banner');
    expect(resolveLandscapeOverlayVariant('required', false, false)).toBe('blocking');
    expect(resolveLandscapeOverlayVariant('required', true, false)).toBe('hint');
    expect(resolveLandscapeOverlayVariant('required', false, true)).toBe('hint');
  });
});

describe('detectIsLandscape', () => {
  it('uses orientation type when provided', () => {
    expect(detectIsLandscape(300, 800, 'landscape-primary')).toBe(true);
    expect(detectIsLandscape(800, 300, 'portrait-primary')).toBe(false);
  });

  it('falls back to width > height when type unknown', () => {
    expect(detectIsLandscape(900, 400, 'unknown')).toBe(true);
    expect(detectIsLandscape(400, 900, 'unknown')).toBe(false);
  });
});

describe('buildOrientationSnapshot', () => {
  it('includes dimensions and landscape flag', () => {
    const snapshot = buildOrientationSnapshot(800, 400);
    expect(snapshot.width).toBe(800);
    expect(snapshot.height).toBe(400);
    expect(typeof snapshot.isLandscape).toBe('boolean');
    expect(snapshot.orientationType).toBe(readScreenOrientationType());
  });
});

describe('matchesLandscapeMediaQuery', () => {
  it('returns null in node test environment', () => {
    expect(matchesLandscapeMediaQuery()).toBeNull();
  });
});
