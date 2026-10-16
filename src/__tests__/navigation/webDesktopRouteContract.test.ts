import { describe, expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
import { safeWebReturnPath } from '@/lib/navigation/webLoginReturn';
import { isHealthOSContextualPopupRoute, resolveHealthOSPopupFallbackPath } from '@/lib/navigation/healthosRoutePresentation';
import { isLiquidCommandRoutePath } from '@/liquid-command/navigation/isLiquidCommandRoute';
import { isDesktopWorkspace, isMobileWorkspace } from '@/design/web/mobileWorkspaceDensity';
import { formatWebFontScaleLabel, workspaceEffectiveScale } from '@/design/web/webFontScaleConfig';

describe('Canonical desktop route continuity', () => {
  it('retains a safe complete desktop address but rejects a lookalike or external redirect', () => {
    expect(safeWebReturnPath('/Desktop?area=decisions#widgets')).toBe('/Desktop?area=decisions#widgets');
    expect(safeWebReturnPath('/Desktop-other')).toBeNull();
    expect(safeWebReturnPath('//example.com/Desktop')).toBeNull();
    expect(safeWebReturnPath('/Desktop\\other')).toBeNull();
  });
  it('renders the desktop as a full Liquid page without module popup chrome', () => {
    expect(isLiquidCommandRoutePath('/Desktop')).toBe(true);
    expect(isHealthOSContextualPopupRoute('/Desktop')).toBe(false);
    expect(isHealthOSContextualPopupRoute('Desktop')).toBe(false);
    expect(isHealthOSContextualPopupRoute('/assist/assignments')).toBe(true);
  });
  it('returns to the desktop without history and keeps concrete record parents intact', () => {
    expect(resolveHealthOSPopupFallbackPath('/assist')).toBe('/Desktop');
    expect(resolveHealthOSPopupFallbackPath('/business/unknown')).toBe('/Desktop');
    expect(resolveHealthOSPopupFallbackPath('/assist/assignments/one/edit')).toBe('/assist/assignments/one');
  });
  it('preserves the desktop 100% baseline and compact layout after canonical navigation', () => {
    expect(isDesktopWorkspace('/Desktop', 1440)).toBe(true);
    expect(isMobileWorkspace('/Desktop', 800)).toBe(true);
    expect(isDesktopWorkspace('/Desktop', 800)).toBe(false);
    expect(workspaceEffectiveScale(1, true, isDesktopWorkspace('/Desktop', 1440))).toBe(0.81);
    expect(formatWebFontScaleLabel(1)).toBe('100%');
  });
});
