import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('System Design Consistency V36.2', () => {
  it('keeps shared KPI cards on the canonical dark HealthOS surface', () => {
    const source = read('src/components/ui/PremiumKpiCard.tsx');

    expect(source).toContain('systemLiquidGlass.panelStrong');
    expect(source).toContain("csHealthosComponent: 'kpi-card'");
    expect(source).toContain('systemLiquidGlass.text.secondary');
    expect(source).toContain('systemLiquidGlass.text.muted');
    expect(source).not.toContain('CareLightKpiCard');
    expect(source).not.toContain("variant === 'light'");
    expect(source).not.toContain('glassFx.surface');
  });

  it('keeps shared sections dark and readable in every module', () => {
    const source = read('src/components/ui/SectionPanel.tsx');

    expect(source).toContain('systemLiquidGlass.panel');
    expect(source).toContain('systemLiquidGlass.text.primary');
    expect(source).toContain('systemLiquidGlass.text.secondary');
    expect(source).not.toContain('lightGlassShell');
  });

  it('uses readable system contrast for dashboard actions', () => {
    const source = read('src/components/layout/platform/actiontoolbar.tsx');

    expect(source).toContain('systemLiquidGlass.text.onAccent');
    expect(source).toContain('systemLiquidGlass.text.primary');
    expect(source).not.toContain('resolveLightPrimaryButtonStyle');
  });

  it('does not render a second breadcrumb inside the Assist page', () => {
    const screen = read('src/screens/assist/AssistIndexScreen.tsx');
    const operations = read('src/components/healthos/assist/HealthOSAssistOperationsView.tsx');

    expect(screen).not.toContain('HealthOSBreadcrumbs');
    expect(operations).toContain('variant="glass"');
    expect(operations).not.toContain('cardVariant');
  });

  it('routes legacy CareLight dashboard primitives into the canonical system', () => {
    const kpi = read('src/components/ui/CareLightKpiCard.tsx');
    const section = read('src/components/ui/CareLightSection.tsx');
    const tile = read('src/components/ui/CareLightModuleTile.tsx');
    const pageHeader = read('src/components/layout/CareLightPageHeader.tsx');
    const screenHeader = read('src/components/layout/CareLightScreenHeader.tsx');

    expect(kpi).toContain('<PremiumKpiCard');
    expect(section).toContain('<SectionPanel');
    expect(tile).toContain('systemLiquidGlass.card');
    expect(pageHeader).toContain('systemLiquidGlass.text.primary');
    expect(screenHeader).toContain('<ScreenHeader');
  });
});
