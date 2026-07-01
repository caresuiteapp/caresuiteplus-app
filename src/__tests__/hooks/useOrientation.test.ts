import { describe, expect, it, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  LANDSCAPE_REQUIRED_SCREENS,
  hasLandscapeSoftFallback,
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
import {
  isLandscapeDismissed,
  landscapeDismissStorageKey,
  setLandscapeDismissed,
} from '@/lib/orientation/landscapeDismissStore';
import {
  clearVisitWorkflowSnapshot,
  mergeVisitWorkflowSnapshot,
  readVisitWorkflowSnapshot,
  writeVisitWorkflowSnapshot,
} from '@/lib/portal/visitWorkflowPersistence';

describe('landscapeRequiredScreens config', () => {
  it('registers only signature, serviceRecordPreview, calendar, roster', () => {
    expect(Object.keys(LANDSCAPE_REQUIRED_SCREENS).sort()).toEqual(
      ['calendar', 'roster', 'serviceRecordPreview', 'signature'].sort(),
    );
    expect(LANDSCAPE_REQUIRED_SCREENS.signature).toBe('required');
    expect(LANDSCAPE_REQUIRED_SCREENS.serviceRecordPreview).toBe('preferred');
    expect(LANDSCAPE_REQUIRED_SCREENS.calendar).toBe('supported');
    expect(LANDSCAPE_REQUIRED_SCREENS.roster).toBe('supported');
    expect(LANDSCAPE_REQUIRED_SCREENS).not.toHaveProperty('visitExecution');
  });

  it('resolveLandscapeRequirement returns configured value', () => {
    expect(resolveLandscapeRequirement('signature')).toBe('required');
    expect(resolveLandscapeRequirement('roster')).toBe('supported');
  });

  it('signature has soft fallback — never blocks content', () => {
    expect(hasLandscapeSoftFallback('signature')).toBe(true);
    expect(hasLandscapeSoftFallback('roster')).toBe(false);
    expect(shouldBlockUntilLandscape('required', true, false, true)).toBe(false);
  });
});

describe('shouldShowLandscapeOverlay', () => {
  it('shows overlay for required/preferred/supported on mobile portrait only', () => {
    expect(shouldShowLandscapeOverlay('required', false, true, false)).toBe(true);
    expect(shouldShowLandscapeOverlay('preferred', false, true, false)).toBe(true);
    expect(shouldShowLandscapeOverlay('supported', false, true, false)).toBe(true);
    expect(shouldShowLandscapeOverlay('required', true, true, false)).toBe(false);
    expect(shouldShowLandscapeOverlay('required', false, false, false)).toBe(false);
    expect(shouldShowLandscapeOverlay('portrait', false, true, false)).toBe(false);
  });

  it('hides overlay when user dismissed for session', () => {
    expect(shouldShowLandscapeOverlay('preferred', false, true, true)).toBe(false);
  });
});

describe('shouldBlockUntilLandscape', () => {
  it('blocks only hard-required screens on mobile without bypass or soft fallback', () => {
    expect(shouldBlockUntilLandscape('required', true, false, false)).toBe(true);
    expect(shouldBlockUntilLandscape('required', true, false, true)).toBe(false);
    expect(shouldBlockUntilLandscape('preferred', true, false, false)).toBe(false);
    expect(shouldBlockUntilLandscape('required', false, false, false)).toBe(false);
    expect(shouldBlockUntilLandscape('required', true, true, false)).toBe(false);
  });
});

describe('resolveLandscapeOverlayVariant', () => {
  it('uses sheet for required lock-available and hint after lock failure or bypass', () => {
    expect(resolveLandscapeOverlayVariant('required', false, false)).toBe('sheet');
    expect(resolveLandscapeOverlayVariant('required', true, false)).toBe('hint');
    expect(resolveLandscapeOverlayVariant('required', false, true)).toBe('hint');
    expect(resolveLandscapeOverlayVariant('preferred', false, false)).toBe('hint');
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

describe('landscapeDismissStore', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    });
  });

  it('persists dismiss flag per scope in sessionStorage', () => {
    expect(isLandscapeDismissed('visit-123')).toBe(false);
    setLandscapeDismissed('visit-123');
    expect(isLandscapeDismissed('visit-123')).toBe(true);
    expect(sessionStorage.getItem(landscapeDismissStorageKey('visit-123'))).toBe('1');
    expect(isLandscapeDismissed('visit-456')).toBe(false);
  });
});

describe('visit workflow persistence', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    });
  });

  it('round-trips snapshot via sessionStorage', () => {
    const snapshot = mergeVisitWorkflowSnapshot('a1', '/portal/employee/assignments/a1/execute', {
      step: 'signature',
      awaitingSignature: true,
      signatureModalOpen: true,
    });
    writeVisitWorkflowSnapshot(snapshot);
    expect(readVisitWorkflowSnapshot('a1')).toMatchObject({
      visitId: 'a1',
      step: 'signature',
      awaitingSignature: true,
      signatureModalOpen: true,
    });
    clearVisitWorkflowSnapshot('a1');
    expect(readVisitWorkflowSnapshot('a1')).toBeNull();
  });
});

describe('orientation change does not navigate', () => {
  const root = path.join(__dirname, '..', '..');

  it('useOrientation only bumps state — no router or location side effects in source', () => {
    const source = readFileSync(path.join(root, 'hooks/useOrientation.ts'), 'utf8');
    expect(source).not.toMatch(/router\.(push|replace|back)/);
    expect(source).not.toMatch(/window\.location\.(reload|href|assign)/);
    expect(source).not.toMatch(/navigate\(/);
  });

  it('visit execution screen has no orientation gate or remount keys', () => {
    const source = readFileSync(
      path.join(root, 'screens/portal/EmployeePortalVisitExecutionScreen.tsx'),
      'utf8',
    );
    expect(source).not.toContain('OrientationGate');
    expect(source).not.toContain('screenKey="visitExecution"');
    expect(source).not.toMatch(/key=\{.*orientation/i);
    expect(source).toContain('useWorkflowPersistence');
  });
});
