import { describe, expect, it } from 'vitest';
import {
  LPB_ANIMATED_ELEMENT_COUNT,
  LPB_CYCLE_S,
  lightPaperAnimLayers,
  lightPaperBackgroundAnimatedSvg,
  lightPaperBackgroundAnimationCss,
} from '@/design/tokens/lightPaperBackgroundAnimated';

describe('lightPaperBackgroundAnimated token', () => {
  it('definiert 120s Zyklus und 34 unabhängige Layer', () => {
    expect(LPB_CYCLE_S).toBe(120);
    expect(LPB_ANIMATED_ELEMENT_COUNT).toBe(34);
    expect(lightPaperAnimLayers).toHaveLength(34);
  });

  it('SVG enthält SMIL animateTransform pro Layer (stabile Browser-Animation)', () => {
    const smilCount = (lightPaperBackgroundAnimatedSvg.match(/<animateTransform/g) ?? []).length;
    expect(smilCount).toBe(34);
    expect(lightPaperBackgroundAnimatedSvg).toContain('calcMode="spline"');
    expect(lightPaperBackgroundAnimatedSvg).toContain('repeatCount="indefinite"');
  });

  it('CSS enthält Layout-Regeln für SVG-Host', () => {
    expect(lightPaperBackgroundAnimationCss).toContain('.lpb-root svg');
    expect(lightPaperBackgroundAnimationCss).toContain('.lpb-layer');
    expect(lightPaperBackgroundAnimationCss).not.toContain('@keyframes lpb-kf-dot-0');
  });

  it('Layer haben spürbare Drift-Amplituden für sichtbare 120s Bewegung', () => {
    const corner = lightPaperAnimLayers.find((layer) => layer.id === 'corner-0');
    expect(corner).toBeDefined();
    expect(Math.hypot(corner!.dx, corner!.dy)).toBeGreaterThan(100);
  });
});

describe('AnimatedLightPaperBackground component', () => {
  const componentPath = ['..', '..', 'components', 'backgrounds', 'AnimatedLightPaperBackground.tsx'];

  it('nutzt einmaliges SVG-Mount mit SMIL statt rAF innerHTML fights', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(path.join(__dirname, ...componentPath), 'utf8');
    expect(source).toContain('lightPaperBackgroundAnimatedSvg');
    expect(source).toContain('usePrefersReducedMotion');
    expect(source).toContain('StaticLightPaperBackground');
    expect(source).toContain('WebDomHost');
    expect(source).toContain("createElement('div'");
    expect(source).toContain('pauseAnimations');
    expect(source).toContain('unpauseAnimations');
    expect(source).toContain('visibilitychange');
    expect(source).toContain('lpb-root--paused');
    expect(source).not.toContain('requestAnimationFrame');
    expect(source).not.toContain('startSvgLayerMotion');
    expect(source).not.toContain('lpb-root--overlay');
    expect(source).not.toContain('static-base');
  });
});

describe('GlobalAnimatedBackground animated light wiring', () => {
  it('deaktiviert die globale Canvas-Dauerschleife auch bei animated=true', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'components', 'ui', 'effects', 'globalanimatedbackground.tsx'),
      'utf8',
    );
    expect(source).toContain('StaticLightPaperBackground');
    expect(source).not.toContain('GlobalPersistentSpaceMotionBackground');
    expect(source).not.toContain('requestAnimationFrame');
    expect(source).not.toContain('<canvas');
  });
});
