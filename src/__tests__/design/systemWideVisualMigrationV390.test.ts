import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('HealthOS system-wide visual migration V39.0', () => {
  it('uses one canonical list hero instead of theme-dependent parallel worlds', () => {
    const premium = read('src/components/ui/PremiumListHeroFrame.tsx');
    const legacy = read('src/components/ui/CareLightListHeroFrame.tsx');
    const text = read('src/design/tokens/carelightadaptive.ts');

    expect(premium).toContain('systemLiquidGlass.panelStrong');
    expect(premium).toContain("csHealthosComponent: 'list-overview'");
    expect(premium).not.toContain('useThemeMode');
    expect(premium).not.toContain('CareLightListHeroFrame');
    expect(legacy).toContain('<PremiumListHeroFrame');
    expect(text).toContain('systemLiquidGlass.text.primary');
  });

  it('collapses legacy headers, dashboards and list rows into canonical primitives', () => {
    expect(read('src/components/layout/CareLightScreenHeader.tsx')).toContain('<ScreenHeader');
    expect(read('src/components/layout/platform/moduledashboardshell.tsx')).toContain('<ScreenShell');
    expect(read('src/components/ui/CareLightListItem.tsx')).toContain('<PremiumListRow');
    expect(read('src/components/ui/PremiumListRow.tsx')).toContain(
      "csHealthosComponent: 'list-row'",
    );
  });

  it('keeps page content flat and reserves overlays for contextual interaction', () => {
    const subpage = read('src/components/layout/C14vSubpageShell.tsx');
    const filter = read('src/components/ui/ListFilterSelect.tsx');
    const modal = read('src/components/layout/platform/platformmodal.tsx');

    expect(subpage).not.toContain('useAuroraGlassPanelStyle');
    expect(filter).toContain('<PlatformModal');
    expect(filter).not.toContain('<Modal');
    expect(modal).toContain("csHealthosComponent: 'modal'");
  });

  it('marks shared controls for the system-wide web contract', () => {
    const files = [
      ['src/components/ui/PremiumCard.tsx', 'card'],
      ['src/components/ui/PremiumKpiCard.tsx', 'kpi-card'],
      ['src/components/ui/PremiumButton.tsx', 'button'],
      ['src/components/ui/FilterChip.tsx', 'filter-chip'],
      ['src/components/ui/SegmentedTabs.tsx', 'tab'],
      ['src/components/ui/PremiumDataTable.tsx', 'table'],
      ['src/components/ui/PremiumInput.tsx', 'input'],
      ['src/components/ui/SectionPanel.tsx', 'section'],
    ] as const;

    for (const [path, marker] of files) {
      const source = read(path);
      expect(source).toContain('csHealthosComponent');
      expect(source).toContain(marker);
    }
  });

  it('ships a recursive route audit as a required release check', () => {
    const audit = read('scripts/audit-healthos-page-migration.mjs');
    const pkg = read('package.json');

    expect(audit).toContain('resolveLocalImport');
    expect(audit).toContain('canonicalShellRoutes');
    expect(audit).toContain('missingShellRoutes');
    expect(pkg).toContain('"audit:ui:migration"');
  });
});
