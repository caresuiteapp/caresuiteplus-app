import { describe, expect, it } from 'vitest';
import {
  opgbAuroraWisps,
  opgbBaseColors,
  opgbBaseGradient,
  opgbBokehDust,
  opgbCanvasIntensity,
  opgbDiffuseGlows,
  opgbNebulaClouds,
  opgbStarDust,
} from '@/design/tokens/officePremiumGlassBackground';
import { resolveMainModuleFromPath } from '@/lib/navigation/resolvemainmodule';

describe('officePremiumGlassBackground tokens', () => {
  it('definiert helle Pearl-/Eisblau-Basisfarben', () => {
    expect(opgbBaseColors.pearlWhite).toBe('#F9FBFF');
    expect(opgbBaseColors.iceBlue).toBe('#E8F2FF');
    expect(opgbBaseColors.lavender).toBe('#EDE8FF');
    expect(opgbBaseColors.blush).toBe('#F8EEF2');
    expect(opgbBaseColors.silverGray).toBe('#E4E8EE');
  });

  it('definiert 6 weiche Nebula-Clouds mit langsamer Drift', () => {
    expect(opgbNebulaClouds).toHaveLength(6);
    for (const cloud of opgbNebulaClouds) {
      expect(cloud.driftX).toBeLessThanOrEqual(95);
      expect(cloud.speed).toBeLessThanOrEqual(0.025);
      expect(cloud.inner).not.toMatch(/rgba\(4,/);
    }
  });

  it('definiert dezente Wisps, Glows und Bokeh', () => {
    expect(opgbAuroraWisps.length).toBeGreaterThanOrEqual(3);
    expect(opgbDiffuseGlows.length).toBeGreaterThanOrEqual(3);
    expect(opgbBokehDust.length).toBeGreaterThanOrEqual(4);
    for (const wisp of opgbAuroraWisps) {
      expect(wisp.thickness).toBeLessThanOrEqual(0.04);
    }
  });

  it('definiert silbrigen Sternenhimmel mit reduzierter Opazität', () => {
    expect(opgbStarDust.length).toBeGreaterThanOrEqual(20);
    expect(opgbCanvasIntensity.starOpacity).toBe(0.58);
    expect(opgbCanvasIntensity.nebulaOpacity).toBeGreaterThanOrEqual(1);
  });

  it('Base-Gradient startet mit Pearl White', () => {
    expect(opgbBaseGradient[0]).toBe(opgbBaseColors.pearlWhite);
    expect(opgbBaseGradient.length).toBeGreaterThanOrEqual(4);
  });
});

describe('useIsOfficeRoute path resolution', () => {
  it('erkennt /office und /business/office', () => {
    expect(resolveMainModuleFromPath('/office/clients')).toBe('office');
    expect(resolveMainModuleFromPath('/business/office/clients')).toBe('office');
    expect(resolveMainModuleFromPath('/assist')).toBe('assist');
  });
});

describe('OfficePremiumGlassBackground component wiring', () => {
  it('GlobalAnimatedBackground nutzt statischen Light-Paper-Hintergrund für alle Light-Routen', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'components', 'ui', 'effects', 'globalanimatedbackground.tsx'),
      'utf8',
    );
    expect(source).toContain('StaticLightPaperBackground');
    expect(source).not.toContain('OfficePremiumGlassBackground');
    expect(source).not.toContain('useIsOfficeRoute');
  });

  it('OfficePremiumGlassBackground delegiert an StaticLightPaperBackground', async () => {
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
