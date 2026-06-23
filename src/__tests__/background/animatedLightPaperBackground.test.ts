import { describe, expect, it } from 'vitest';
import {
  LPB_ANIMATED_ELEMENT_COUNT,
  LPB_CYCLE_S,
  lightPaperAnimLayers,
  lightPaperBackgroundAnimationCss,
} from '@/design/tokens/lightPaperBackgroundAnimated';

describe('lightPaperBackgroundAnimated token', () => {
  it('definiert 120s Zyklus und 34 unabhängige Layer', () => {
    expect(LPB_CYCLE_S).toBe(120);
    expect(LPB_ANIMATED_ELEMENT_COUNT).toBe(34);
    expect(lightPaperAnimLayers).toHaveLength(34);
  });

  it('CSS nutzt ease-in-out, 120s Dauer und reduced-motion Fallback', () => {
    expect(lightPaperBackgroundAnimationCss).toContain('120s ease-in-out infinite');
    expect(lightPaperBackgroundAnimationCss).toContain('@keyframes lpb-kf-dot-0');
    expect(lightPaperBackgroundAnimationCss).toContain('prefers-reduced-motion: reduce');
    expect(lightPaperBackgroundAnimationCss).toContain('animation-play-state: paused');
    expect(lightPaperBackgroundAnimationCss).toContain('translate3d');
    expect(lightPaperBackgroundAnimationCss).toContain('lpb-root--overlay .lpb-base-wash');
  });

  it('Layer-Keyframes kehren bei 0% und 100% glatt zum Ursprung zurück', () => {
    expect(lightPaperBackgroundAnimationCss).toMatch(
      /0%, 100% \{ transform: translate3d\(0, 0, 0\) scale\(1\); \}/,
    );
  });
});

describe('AnimatedLightPaperBackground component', () => {
  const componentPath = ['..', '..', 'components', 'backgrounds', 'AnimatedLightPaperBackground.tsx'];

  it('nutzt inline SVG mit CSS-Animation auf Web und Static-Fallback sonst', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(path.join(__dirname, ...componentPath), 'utf8');
    expect(source).toContain('lightPaperBackgroundAnimatedSvg');
    expect(source).toContain('lightPaperBackgroundAnimationCss');
    expect(source).toContain('usePrefersReducedMotion');
    expect(source).toContain('StaticLightPaperBackground');
    expect(source).toContain('WebDomHost');
    expect(source).toContain("createElement('div'");
    expect(source).toContain('applyLayerAnimations');
    expect(source).toContain('lightPaperAnimLayers');
    expect(source).toContain('visibilitychange');
    expect(source).toContain('lpb-root--paused');
    expect(source).toContain('cycleS={LPB_CYCLE_S}');
    expect(source).not.toContain('lpb-root--overlay');
    expect(source).not.toContain('static-base');
  });
});

describe('GlobalAnimatedBackground animated light wiring', () => {
  it('nutzt AnimatedLightPaperBackground im Light-Mode', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'components', 'ui', 'effects', 'globalanimatedbackground.tsx'),
      'utf8',
    );
    expect(source).toContain('AnimatedLightPaperBackground');
    expect(source).toContain('StaticLightPaperBackground');
    expect(source).toContain('animated ?');
  });
});
