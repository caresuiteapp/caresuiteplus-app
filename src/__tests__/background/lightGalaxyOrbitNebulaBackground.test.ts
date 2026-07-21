import { describe, expect, it } from 'vitest';
import {
  LGON_LAYER_IDS,
  lgoonBaseGradient,
  lgoonCanvasIntensity,
  lgoonDeepStreaks,
  lgoonFarNebulaBlobs,
  lgoonMainPlanet,
  lgoonOrbitArcs,
  lgoonRedAccent,
  lgoonRedEnergyPoints,
  lgoonSecondaryPlanets,
  lgoonSmallBodies,
  lgoonStarDust,
} from '@/design/tokens/lightGalaxyOrbitNebula';

const lgoonPlanets = [lgoonMainPlanet, ...lgoonSecondaryPlanets];

describe('lightGalaxyOrbitNebula tokens', () => {
  it('definiert zehn Pflicht-Layer-IDs (A–J)', () => {
    expect(LGON_LAYER_IDS).toHaveLength(10);
    expect(LGON_LAYER_IDS).toContain('layer-a-base-atmosphere');
    expect(LGON_LAYER_IDS).toContain('layer-b-far-nebula');
    expect(LGON_LAYER_IDS).toContain('layer-c-deep-nebula');
    expect(LGON_LAYER_IDS).toContain('layer-d-main-planet');
    expect(LGON_LAYER_IDS).toContain('layer-e-secondary-planets');
    expect(LGON_LAYER_IDS).toContain('layer-f-small-bodies');
    expect(LGON_LAYER_IDS).toContain('layer-g-red-energy');
    expect(LGON_LAYER_IDS).toContain('layer-h-star-dust');
    expect(LGON_LAYER_IDS).toContain('layer-i-orbit-arcs');
    expect(LGON_LAYER_IDS).toContain('layer-j-readability-veil');
  });

  it('nutzt strukturierte Grautöne statt milchigem Weiß', () => {
    expect(lgoonBaseGradient.join('')).not.toContain('F7FAFF');
    expect(lgoonBaseGradient.join('')).not.toContain('EEF4FF');
    expect(lgoonBaseGradient[0]).toMatch(/^#[89AB]/);
  });

  it('definiert Far-Nebula-Blobs mit unterschiedlichen Bewegungsvektoren', () => {
    expect(lgoonFarNebulaBlobs.length).toBeGreaterThanOrEqual(4);
    const flowVectors = lgoonFarNebulaBlobs.map((b) => `${b.flowVx},${b.flowVy}`);
    const uniqueVectors = new Set(flowVectors);
    expect(uniqueVectors.size).toBeGreaterThanOrEqual(3);
    for (const blob of lgoonFarNebulaBlobs) {
      expect(blob.ampX).toBeGreaterThanOrEqual(160);
      expect(blob.freqX).toBeGreaterThanOrEqual(0.08);
    }
  });

  it('definiert Deep-Nebula-Streaks mit Flow-Feld (andere Phase als B)', () => {
    expect(lgoonDeepStreaks.length).toBeGreaterThanOrEqual(4);
    for (const streak of lgoonDeepStreaks) {
      expect(streak.flowSpeed).not.toBe(0);
      expect(streak.freqA).not.toBe(streak.freqB);
    }
  });

  it('definiert Planeten mit unabhängiger Float- und Licht-Animation', () => {
    expect(lgoonPlanets.length).toBeGreaterThanOrEqual(2);
    for (const planet of lgoonPlanets) {
      expect(planet.redEnergy).toBeGreaterThan(0.3);
      expect(planet.floatFreqX).not.toBe(planet.floatFreqY);
      expect(planet.lightShiftSpeed).toBeGreaterThan(0);
    }
  });

  it('definiert kleine Himmelskörper, Sterne und rote Akzente', () => {
    expect(lgoonSmallBodies.length).toBeGreaterThanOrEqual(5);
    expect(lgoonStarDust.length).toBeGreaterThanOrEqual(18);
    expect(lgoonRedEnergyPoints.length).toBeGreaterThanOrEqual(5);
    expect(lgoonOrbitArcs.length).toBeGreaterThanOrEqual(3);
    expect(lgoonCanvasIntensity.starOpacity).toBeGreaterThanOrEqual(0.5);
  });

  it('beschränkt Akzente auf tiefes Rot (kein Modul-Rainbow)', () => {
    expect(lgoonRedAccent.core).toMatch(/rgba\(1[2-9]\d,/);
    expect(lgoonRedAccent.glow).toMatch(/rgba\(/);
    const tokenSource = JSON.stringify({ lgoonFarNebulaBlobs, lgoonDeepStreaks, lgoonOrbitArcs });
    expect(tokenSource).not.toMatch(/rgba\(80,200,255/);
    expect(tokenSource).not.toMatch(/rgba\(160,120,255/);
  });
});

describe('LightGalaxyOrbitNebulaBackground component', () => {
  const componentPath = ['..', '..', 'components', 'backgrounds', 'LightGalaxyOrbitNebulaBackground.tsx'];

  it('exportiert testID und zehn Layer-testIDs', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(path.join(__dirname, ...componentPath), 'utf8');
    expect(source).toContain('testID="light-galaxy-orbit-nebula-background"');
    expect(source).toContain('data-testid="lgoon-layer-a-base-atmosphere"');
    expect(source).toContain('testId="lgoon-layer-b-far-nebula"');
    expect(source).toContain('testId="lgoon-layer-c-deep-nebula"');
    expect(source).toContain('testId="lgoon-layer-d-main-planet"');
    expect(source).toContain('testId="lgoon-layer-e-secondary-planets"');
    expect(source).toContain('testId="lgoon-layer-f-small-bodies"');
    expect(source).toContain('testId="lgoon-layer-g-red-energy"');
    expect(source).toContain('testId="lgoon-layer-h-star-dust"');
    expect(source).toContain('testId="lgoon-layer-i-orbit-arcs"');
    expect(source).toContain('data-testid="lgoon-layer-j-readability-veil"');
  });

  it('hat keinen Single-Root-Pan auf der gesamten Szene', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(path.join(__dirname, ...componentPath), 'utf8');
    expect(source).not.toMatch(/scenePan|wallpaperPan|rootPan|translateX\(sin/i);
    expect(source).not.toContain('parallaxScale');
    expect(source).toContain('data-motion-engine="independent-layers"');
    expect(source).toContain('useIndependentCanvasLoop');
  });

  it('respektiert reduced-motion, pointer-events none und overflow hidden', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(path.join(__dirname, ...componentPath), 'utf8');
    expect(source).toContain('usePrefersReducedMotion');
    expect(source).toContain("pointerEvents: 'none'");
    expect(source).toContain("overflow: 'hidden'");
    expect(source).toContain('visibilitychange');
    expect(source).toContain('cancelAnimationFrame');
    expect(source).toContain('devicePixelRatio');
    expect(source).toContain('prefers-reduced-motion');
  });

  it('nutzt separate rAF-Loops pro Layer ohne React-State pro Frame', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(path.join(__dirname, ...componentPath), 'utf8');
    expect(source).toContain('requestAnimationFrame');
    expect(source).not.toMatch(/useState\([^)]*particle/i);
    expect(source).toContain('nebulaBlobPosition');
    expect(source).toContain('planetPosition');
    expect(source).toContain('streakPosition');
  });

  it('trennt Nebel- und Planeten-Bewegungsfunktionen', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(path.join(__dirname, ...componentPath), 'utf8');
    expect(source).toContain('/** Layer B — Lissajous');
    expect(source).toContain('/** Layer C — Flow-field');
    expect(source).toContain('/** Layer D/E — Figure-8');
    expect(source).not.toContain('drawBaseAtmosphere');
  });
});

describe('GlobalAnimatedBackground wiring', () => {
  it('nutzt den kanonischen statischen Light-Paper-Hintergrund', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'components', 'ui', 'effects', 'globalanimatedbackground.tsx'),
      'utf8',
    );
    expect(source).toContain('StaticLightPaperBackground');
    expect(source).not.toContain('GlobalPersistentSpaceMotionBackground');
    expect(source).not.toContain('LightGalaxyOrbitNebulaBackground');
    expect(source).not.toContain('LightSpaceOrbitGalaxyBackground');
  });
});
