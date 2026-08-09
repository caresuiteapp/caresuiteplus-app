import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('HealthOS system-wide visible transformation V40.0', () => {
  it('renders a visibly branded spatial stage instead of a flat dark background', () => {
    const css = read('src/design/web/healthOSPageContractCss.ts');

    expect(css).toContain('--cs-healthos-night: #071225');
    expect(css).toContain('body::before');
    expect(css).toContain('radial-gradient(circle at 7% 8%');
    expect(css).toContain('background-attachment: fixed');
    expect(css).toContain('@keyframes cs-healthos-rail');
  });

  it('gives the canonical work surface an illuminated glass identity', () => {
    const surface = read('src/components/layout/HealthOSPageSurface.tsx');
    const css = read('src/design/web/healthOSPageContractCss.ts');

    expect(surface).toContain('styles.ambientTop');
    expect(surface).toContain('styles.ambientBottom');
    expect(surface).toContain('styles.lightRail');
    expect(css).toContain('[data-cs-healthos-page="surface"]::before');
    expect(css).toContain('blur(34px) saturate(1.35)');
  });

  it('transforms shared headers, cards, tables, rows and modals visibly', () => {
    const css = read('src/design/web/healthOSPageContractCss.ts');
    const header = read('src/components/layout/ScreenHeader.tsx');

    expect(header).toContain("csHealthosComponent: 'screen-header'");
    expect(css).toContain("content: 'HEALTHOS'");
    expect(css).toContain('[data-cs-healthos-component="module-tile"]:hover');
    expect(css).toContain('[data-cs-healthos-component="list-row"]:hover');
    expect(css).toContain('[data-cs-healthos-component="modal"]');
    expect(css).toContain('translateY(-3px)');
  });

  it('uses the navy, electric-blue and white product identity in shared tokens', () => {
    const liquid = read('src/design/tokens/systemLiquidGlass.ts');
    const spatial = read('src/design/tokens/spatialCareSuite.ts');

    expect(liquid).toContain("navy: '#031127'");
    expect(liquid).toContain("electricBlue: '#1683FF'");
    expect(liquid).toContain("white: '#FFFFFF'");
    expect(spatial).toContain("office: '#1683FF'");
    expect(spatial).not.toContain("office: '#FF9B52'");
  });

  it('adds physical light depth to high-frequency overview components', () => {
    const kpi = read('src/components/ui/PremiumKpiCard.tsx');
    const hero = read('src/components/ui/PremiumListHeroFrame.tsx');
    const glass = read('src/design/web/applyLlganGlassDom.tsx');

    expect(kpi).toContain('styles.ambientGlow');
    expect(kpi).toContain('styles.horizon');
    expect(hero).toContain('styles.ambientGlow');
    expect(hero).toContain('styles.lightRail');
    expect(glass).toContain('rgba(105,232,255,.24)');
  });
});
