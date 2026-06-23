import { describe, expect, it } from 'vitest';
import {
  LCOG_LAYER_IDS,
  lcogAuroraWisps,
  lcogBaseGradient,
  lcogCanvasIntensity,
  lcogGalaxyClouds,
  lcogLightPaths,
  lcogOrbitRings,
  lcogStarDust,
  resolveLcogModuleAccentRgba,
} from '@/design/tokens/lightCosmicOrbitGalaxy';
import { resolveMainModuleFromPath } from '@/lib/navigation/resolvemainmodule';

describe('lightCosmicOrbitGalaxy tokens', () => {
  it('definiert neun sichtbare Layer-IDs', () => {
    expect(LCOG_LAYER_IDS).toHaveLength(9);
    expect(LCOG_LAYER_IDS).toContain('base-gradient');
    expect(LCOG_LAYER_IDS).toContain('galaxy-clouds');
    expect(LCOG_LAYER_IDS).toContain('orbit-rings');
    expect(LCOG_LAYER_IDS).toContain('star-dust');
    expect(LCOG_LAYER_IDS).toContain('particles');
    expect(LCOG_LAYER_IDS).toContain('aurora-wisps');
    expect(LCOG_LAYER_IDS).toContain('light-paths');
    expect(LCOG_LAYER_IDS).toContain('comet-streaks');
    expect(LCOG_LAYER_IDS).toContain('vignette');
  });

  it('definiert tiefere Cosmic-Basisfarben statt milchigem Weiß', () => {
    expect(lcogBaseGradient[0]).toMatch(/^#[CD]/);
    expect(lcogBaseGradient.join('')).not.toContain('F7FAFF');
  });

  it('definiert Galaxy-Clouds mit sichtbarer Drift-Amplitude', () => {
    expect(lcogGalaxyClouds.length).toBeGreaterThanOrEqual(6);
    for (const cloud of lcogGalaxyClouds) {
      expect(cloud.driftX).toBeGreaterThanOrEqual(150);
      expect(cloud.speed).toBeGreaterThanOrEqual(0.06);
    }
  });

  it('definiert Orbit-Ringe mit Rotation', () => {
    expect(lcogOrbitRings.length).toBeGreaterThanOrEqual(4);
    for (const ring of lcogOrbitRings) {
      expect(ring.speed).not.toBe(0);
      expect(ring.opacity).toBeGreaterThan(0);
    }
  });

  it('definiert Wisps, Light-Paths und Sterne', () => {
    expect(lcogAuroraWisps.length).toBeGreaterThanOrEqual(4);
    expect(lcogLightPaths.length).toBeGreaterThanOrEqual(4);
    expect(lcogStarDust.length).toBeGreaterThanOrEqual(18);
    expect(lcogCanvasIntensity.starOpacity).toBeGreaterThanOrEqual(0.55);
  });

  it('liefert Modul-Akzent-RGBA für alle Hauptmodule', () => {
    const modules = ['assist', 'office', 'pflege', 'stationaer', 'beratung', 'akademie', 'zentrale'] as const;
    for (const mod of modules) {
      const rgba = resolveLcogModuleAccentRgba(mod);
      expect(rgba).toMatch(/^rgba\(\d+,\d+,\d+,/);
    }
  });
});

describe('LightCosmicOrbitGalaxyBackground component', () => {
  it('exportiert testID und Canvas data-layers', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'components', 'backgrounds', 'LightCosmicOrbitGalaxyBackground.tsx'),
      'utf8',
    );
    expect(source).toContain('testID="light-cosmic-orbit-galaxy-background"');
    expect(source).toContain('data-testid="lcog-cosmic-orbit-canvas"');
    expect(source).toContain('LCOG_LAYER_IDS');
    expect(source).toContain('data-layers');
  });

  it('respektiert reduced-motion, pointer-events none und overflow hidden', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'components', 'backgrounds', 'LightCosmicOrbitGalaxyBackground.tsx'),
      'utf8',
    );
    expect(source).toContain('usePrefersReducedMotion');
    expect(source).toContain('pointerEvents: \'none\'');
    expect(source).toContain('overflow: \'hidden\'');
    expect(source).toContain('visibilitychange');
    expect(source).toContain('cancelAnimationFrame');
    expect(source).toContain('devicePixelRatio');
  });

  it('nutzt rAF ohne per-frame React state für Partikel', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'components', 'backgrounds', 'LightCosmicOrbitGalaxyBackground.tsx'),
      'utf8',
    );
    expect(source).toContain('requestAnimationFrame');
    expect(source).toContain('particlesRef');
    expect(source).toContain('cometsRef');
    expect(source).not.toMatch(/useState\([^)]*particle/i);
  });
});

describe('GlobalAnimatedBackground wiring', () => {
  it('wählt LightCosmicOrbitGalaxyBackground für Nicht-Office-Routen', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'components', 'ui', 'effects', 'globalanimatedbackground.tsx'),
      'utf8',
    );
    expect(source).toContain('LightCosmicOrbitGalaxyBackground');
    expect(source).toContain('lcog');
    expect(source).toContain('OfficePremiumGlassBackground');
  });

  it('Modul-Routen werden für Akzent-Tints aufgelöst', () => {
    expect(resolveMainModuleFromPath('/assist')).toBe('assist');
    expect(resolveMainModuleFromPath('/stationaer')).toBe('stationaer');
    expect(resolveMainModuleFromPath('/pflege')).toBe('pflege');
    expect(resolveMainModuleFromPath('/beratung')).toBe('beratung');
    expect(resolveMainModuleFromPath('/akademie')).toBe('akademie');
    expect(resolveMainModuleFromPath('/office')).toBe('office');
  });
});
