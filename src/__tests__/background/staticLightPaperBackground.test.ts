import { describe, expect, it } from 'vitest';

describe('StaticLightPaperBackground component', () => {
  const componentPath = ['..', '..', 'components', 'backgrounds', 'StaticLightPaperBackground.tsx'];

  it('lädt statisches SVG (Web) bzw. PNG (Native) mit cover, fixed und pointer-events none', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(path.join(__dirname, ...componentPath), 'utf8');
    expect(source).toContain('light-abstract-paper-background.png');
    expect(source).toContain('light-abstract-paper-background.svg');
    expect(source).toContain('backgroundSize: \'cover\'');
    expect(source).toContain('resizeMode="cover"');
    expect(source).toContain('pointerEvents="none"');
    expect(source).toContain("position: 'fixed'");
    expect(source).toContain("testID = 'static-light-paper-background'");
  });

  it('enthält keine Canvas- oder rAF-Animation', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(path.join(__dirname, ...componentPath), 'utf8');
    expect(source).not.toContain('requestAnimationFrame');
    expect(source).not.toContain('cancelAnimationFrame');
    expect(source).not.toContain('<canvas');
    expect(source).not.toContain('usePrefersReducedMotion');
  });
});

describe('GlobalAnimatedBackground static light wiring', () => {
  it('nutzt ausschließlich StaticLightPaperBackground im Light-Mode', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'components', 'ui', 'effects', 'globalanimatedbackground.tsx'),
      'utf8',
    );
    expect(source).toContain('StaticLightPaperBackground');
    expect(source).not.toContain('LightGalaxyOrbitNebulaBackground');
    expect(source).not.toContain('OfficePremiumGlassBackground');
    expect(source).not.toContain('LightSpaceOrbitGalaxyBackground');
    expect(source).not.toContain('useIsOfficeRoute');
  });
});

describe('OfficePremiumGlassBackground static alias', () => {
  it('delegiert an StaticLightPaperBackground ohne Animation', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'components', 'backgrounds', 'OfficePremiumGlassBackground.tsx'),
      'utf8',
    );
    expect(source).toContain('StaticLightPaperBackground');
    expect(source).not.toContain('requestAnimationFrame');
    expect(source).not.toContain('<canvas');
  });
});
