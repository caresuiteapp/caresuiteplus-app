import { describe, expect, it } from 'vitest';
import {
  galaxyGradients,
  resolveGalaxyGradientColors,
  type GalaxyGradientKey,
} from '@/design/tokens/galaxy';

describe('galaxyGradients', () => {
  it('dashboardHero is a multi-stop color array for LinearGradient', () => {
    expect(Array.isArray(galaxyGradients.dashboardHero)).toBe(true);
    expect(galaxyGradients.dashboardHero.length).toBeGreaterThanOrEqual(2);
    for (const stop of galaxyGradients.dashboardHero) {
      expect(typeof stop).toBe('string');
      expect(stop.length).toBeGreaterThan(0);
    }
  });

  it('resolveGalaxyGradientColors returns dashboardHero stops', () => {
    expect(resolveGalaxyGradientColors('dashboardHero')).toEqual(galaxyGradients.dashboardHero);
  });

  it('resolveGalaxyGradientColors falls back when key is missing at runtime', () => {
    const missing = 'missingHero' as GalaxyGradientKey;
    const gradients = galaxyGradients as Record<string, readonly string[] | undefined>;
    const saved = gradients[missing];
    delete gradients[missing];

    expect(resolveGalaxyGradientColors(missing)).toEqual(galaxyGradients.accent);

    if (saved !== undefined) {
      gradients[missing] = saved;
    }
  });

  it('modalHeader is a multi-stop colorful gradient for LinearGradient', () => {
    expect(Array.isArray(galaxyGradients.modalHeader)).toBe(true);
    expect(galaxyGradients.modalHeader.length).toBeGreaterThanOrEqual(2);
    for (const stop of galaxyGradients.modalHeader) {
      expect(typeof stop).toBe('string');
      expect(stop.length).toBeGreaterThan(0);
    }
  });

  it('resolveGalaxyGradientColors returns modalHeader stops', () => {
    expect(resolveGalaxyGradientColors('modalHeader')).toEqual(galaxyGradients.modalHeader);
  });

  it('GradientModalHeader uses safe gradient resolver', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'components', 'layout', 'platform', 'gradientmodalheader.tsx'),
      'utf8',
    );
    expect(source).toContain("resolveGalaxyGradientColors('modalHeader')");
    expect(source).not.toContain('[...galaxyGradients.modalHeader]');
  });
});
