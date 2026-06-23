import { describe, expect, it } from 'vitest';
import {
  LSOG_LAYER_IDS,
  lsogBaseGradient,
  lsogCanvasIntensity,
  lsogDeepStreaks,
  lsogNebulaFog,
  lsogOrbitArcs,
  lsogPlanets,
  lsogRedAccent,
  lsogRedEnergyPoints,
  lsogSmallBodies,
  lsogStarDust,
} from '@/design/tokens/lightSpaceOrbitGalaxy';

describe('lightSpaceOrbitGalaxy tokens', () => {
  it('definiert neun Pflicht-Layer-IDs', () => {
    expect(LSOG_LAYER_IDS).toHaveLength(9);
    expect(LSOG_LAYER_IDS).toContain('base-atmosphere');
    expect(LSOG_LAYER_IDS).toContain('nebula-fog');
    expect(LSOG_LAYER_IDS).toContain('deep-nebula-streaks');
    expect(LSOG_LAYER_IDS).toContain('planets-foreground');
    expect(LSOG_LAYER_IDS).toContain('small-celestial-bodies');
    expect(LSOG_LAYER_IDS).toContain('star-dust');
    expect(LSOG_LAYER_IDS).toContain('red-energy-accents');
    expect(LSOG_LAYER_IDS).toContain('orbit-arcs');
    expect(LSOG_LAYER_IDS).toContain('ui-readability-veil');
  });

  it('nutzt strukturierte Grautöne statt milchigem Weiß', () => {
    expect(lsogBaseGradient.join('')).not.toContain('F7FAFF');
    expect(lsogBaseGradient.join('')).not.toContain('EEF4FF');
    expect(lsogBaseGradient[0]).toMatch(/^#[89AB]/);
  });

  it('definiert Nebel-Fog mit sichtbarer Drift innerhalb ~10 s', () => {
    expect(lsogNebulaFog.length).toBeGreaterThanOrEqual(4);
    for (const fog of lsogNebulaFog) {
      expect(fog.driftX).toBeGreaterThanOrEqual(160);
      expect(fog.speed).toBeGreaterThanOrEqual(0.08);
    }
  });

  it('definiert dunkle Nebel-Streaks und Planeten mit Rot-Energie', () => {
    expect(lsogDeepStreaks.length).toBeGreaterThanOrEqual(4);
    expect(lsogPlanets.length).toBeGreaterThanOrEqual(2);
    for (const planet of lsogPlanets) {
      expect(planet.redEnergy).toBeGreaterThan(0.5);
      expect(planet.floatSpeed).toBeGreaterThanOrEqual(0.07);
    }
  });

  it('definiert kleine Himmelskörper, Sterne und rote Akzente', () => {
    expect(lsogSmallBodies.length).toBeGreaterThanOrEqual(5);
    expect(lsogStarDust.length).toBeGreaterThanOrEqual(18);
    expect(lsogRedEnergyPoints.length).toBeGreaterThanOrEqual(5);
    expect(lsogOrbitArcs.length).toBeGreaterThanOrEqual(3);
    expect(lsogCanvasIntensity.starOpacity).toBeGreaterThanOrEqual(0.5);
  });

  it('beschränkt Akzente auf tiefes Rot (kein Modul-Rainbow)', () => {
    expect(lsogRedAccent.core).toMatch(/rgba\(1[2-9]\d,/);
    expect(lsogRedAccent.glow).toMatch(/rgba\(/);
    const tokenSource = JSON.stringify({ lsogNebulaFog, lsogDeepStreaks, lsogOrbitArcs });
    expect(tokenSource).not.toMatch(/rgba\(80,200,255/);
    expect(tokenSource).not.toMatch(/rgba\(160,120,255/);
  });
});

describe('LightSpaceOrbitGalaxyBackground component', () => {
  it('exportiert testID und Canvas data-layers', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'components', 'backgrounds', 'LightSpaceOrbitGalaxyBackground.tsx'),
      'utf8',
    );
    expect(source).toContain('testID="light-space-orbit-galaxy-background"');
    expect(source).toContain('data-testid="lsog-space-orbit-canvas"');
    expect(source).toContain('LSOG_LAYER_IDS');
    expect(source).toContain('data-layers');
  });

  it('respektiert reduced-motion, pointer-events none und overflow hidden', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'components', 'backgrounds', 'LightSpaceOrbitGalaxyBackground.tsx'),
      'utf8',
    );
    expect(source).toContain('usePrefersReducedMotion');
    expect(source).toContain("pointerEvents: 'none'");
    expect(source).toContain("overflow: 'hidden'");
    expect(source).toContain('visibilitychange');
    expect(source).toContain('cancelAnimationFrame');
    expect(source).toContain('devicePixelRatio');
  });

  it('nutzt rAF ohne per-frame React state', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'components', 'backgrounds', 'LightSpaceOrbitGalaxyBackground.tsx'),
      'utf8',
    );
    expect(source).toContain('requestAnimationFrame');
    expect(source).toContain('particlesRef');
    expect(source).not.toMatch(/useState\([^)]*particle/i);
    expect(source).toContain('drawPlanet');
    expect(source).toContain('drawRedEnergyPoint');
  });
});

describe('GlobalAnimatedBackground wiring', () => {
  it('wählt LightSpaceOrbitGalaxyBackground für Nicht-Office-Routen', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'components', 'ui', 'effects', 'globalanimatedbackground.tsx'),
      'utf8',
    );
    expect(source).toContain('LightSpaceOrbitGalaxyBackground');
    expect(source).toContain('lsog');
    expect(source).toContain('OfficePremiumGlassBackground');
    expect(source).not.toContain('LightCosmicOrbitGalaxyBackground');
  });
});
