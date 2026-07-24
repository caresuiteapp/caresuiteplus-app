import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isHealthOSContextualPopupRoute,
  resolveHealthOSPopupFallbackPath,
} from '@/lib/navigation/healthosRoutePresentation';

const root = process.cwd();

function walkTsx(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = join(directory, entry);
    return statSync(absolute).isDirectory() ? walkTsx(absolute) : absolute.endsWith('.tsx') ? [absolute] : [];
  });
}

const routeFiles = walkTsx(join(root, 'app'));
const screenFiles = walkTsx(join(root, 'src/screens'));
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('HealthOS system-wide UI contract V37.0', () => {
  it('classifies every application route into page or contextual popup presentation', () => {
    const classifications = routeFiles.map((file) => {
      const route = relative(root, file).replace(/\\/g, '/');
      return { route, popup: isHealthOSContextualPopupRoute(route) };
    });

    expect(classifications).toHaveLength(routeFiles.length);
    expect(classifications.length).toBeGreaterThanOrEqual(600);
    expect(classifications.filter((item) => item.popup).length).toBeGreaterThan(100);
  });

  it('keeps sequential portal workflows as pages and record actions as popups', () => {
    expect(isHealthOSContextualPopupRoute('/assist/einsaetze/[id]')).toBe(true);
    expect(isHealthOSContextualPopupRoute('/business/office/clients/[id]/edit')).toBe(true);
    expect(isHealthOSContextualPopupRoute('/assist/nachweise/review')).toBe(true);
    expect(isHealthOSContextualPopupRoute('/office/appointments/create')).toBe(true);
    expect(isHealthOSContextualPopupRoute('/office/messages/compose')).toBe(true);
    expect(isHealthOSContextualPopupRoute('/portal/employee/assignments/[id]/execute')).toBe(false);
    expect(isHealthOSContextualPopupRoute('/auth/business-login')).toBe(false);
  });

  it('provides a deterministic close target for direct popup URLs', () => {
    expect(resolveHealthOSPopupFallbackPath('/business/office/clients/123/edit')).toBe(
      '/business/office/clients/123',
    );
    expect(resolveHealthOSPopupFallbackPath('/assist/nachweise/review')).toBe('/assist/nachweise');
  });

  it('enforces the popup presenter at navigator and shared shell level', () => {
    const rootLayout = read('app/_layout.tsx');
    const shell = read('src/components/layout/ScreenShell.tsx');

    expect(rootLayout).toContain('isHealthOSContextualPopupRoute(route.name)');
    expect(rootLayout).toContain("presentation: contextualPopup ? 'transparentModal' : 'card'");
    expect(shell).toContain('screen-shell-contextual-popup');
    expect(shell).toContain('<PlatformModal');
  });

  it('uses one canonical component family for filters, tabs, cards and tables', () => {
    const filters = read('src/components/ui/FilterChip.tsx');
    const tabs = read('src/components/ui/SegmentedTabs.tsx');
    const cards = read('src/components/ui/PremiumCard.tsx');
    const kpis = read('src/components/ui/PremiumKpiCard.tsx');
    const tables = read('src/design/tokens/auroraGlass.ts');

    expect(filters).toContain('systemLiquidGlass.chip');
    expect(tabs).toContain('systemLiquidGlass.chipActive');
    expect(cards).toContain('spatialCareGradients.nightGlass');
    expect(kpis).toContain('systemLiquidGlass.panelStrong');
    expect(kpis).toContain("csHealthosComponent: 'kpi-card'");
    expect(tables).not.toContain("solidSurface ? '#FAFBFC'");
  });

  it('includes every actual screen in the recurring audit scope', () => {
    expect(screenFiles.length).toBeGreaterThanOrEqual(400);
    expect(screenFiles.every((file) => file.endsWith('.tsx'))).toBe(true);
  });
});
