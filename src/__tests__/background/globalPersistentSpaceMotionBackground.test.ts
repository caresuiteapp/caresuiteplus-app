import { describe, expect, it } from 'vitest';
import { BACKGROUND_LOOP_MS, getBackgroundPhase } from '@/lib/background/backgroundTime';
import {
  PSM_BAND_COUNT,
  PSM_CURVE_COUNT,
  PSM_LARGE_COUNT,
  PSM_LINE_COUNT,
  PSM_LOOP_MS,
  PSM_MEDIUM_COUNT,
  PSM_NEBULA_COUNT,
  PSM_RING_COUNT,
  PSM_SCENE,
  PSM_SMALL_COUNT,
  psmCircleAt,
  psmCircleAtElapsed,
  psmLineAt,
  psmMotionOffset,
} from '@/design/tokens/persistentSpaceMotionScene';

describe('backgroundTime', () => {
  it('LOOP_DAUER beträgt 240000 ms', () => {
    expect(BACKGROUND_LOOP_MS).toBe(240_000);
    expect(PSM_LOOP_MS).toBe(240_000);
  });

  it('liefert Phase zwischen 0 und 2π', () => {
    const phase = getBackgroundPhase();
    expect(phase).toBeGreaterThanOrEqual(0);
    expect(phase).toBeLessThanOrEqual(Math.PI * 2 + 0.001);
  });
});

describe('persistentSpaceMotionScene', () => {
  const W = 1440;
  const H = 900;

  it('definiert Light-Paper Element-Counts', () => {
    expect(PSM_SCENE.cornerDiscs).toHaveLength(PSM_LARGE_COUNT);
    expect(PSM_SCENE.cornerDiscs.length).toBe(4);
    expect(PSM_SCENE.mediumDiscs).toHaveLength(PSM_MEDIUM_COUNT);
    expect(PSM_SCENE.mediumDiscs.length).toBe(5);
    expect(PSM_SCENE.buttonDots).toHaveLength(PSM_SMALL_COUNT);
    expect(PSM_SCENE.buttonDots.length).toBe(13);
    expect(PSM_SCENE.bands).toHaveLength(PSM_BAND_COUNT);
    expect(PSM_SCENE.bands.length).toBe(5);
    expect(PSM_SCENE.rings).toHaveLength(PSM_RING_COUNT);
    expect(PSM_SCENE.rings.length).toBe(4);
    expect(PSM_SCENE.curves).toHaveLength(PSM_CURVE_COUNT);
    expect(PSM_SCENE.curves.length).toBe(3);
    expect(PSM_SCENE.lines).toHaveLength(PSM_LINE_COUNT);
    expect(PSM_SCENE.nebulas).toHaveLength(PSM_NEBULA_COUNT);
    expect(PSM_SCENE.nebulas.length).toBe(0);
  });

  it('Config ist deterministisch (gleiche Werte bei erneutem Import)', () => {
    const first = PSM_SCENE.cornerDiscs[0].bx;
    expect(PSM_SCENE.cornerDiscs[0].bx).toBe(first);
  });

  it('t=0 und t=240000 erzeugen nahtlose Kreis-Positionen', () => {
    const circle = PSM_SCENE.largeCircles[0];
    const at0 = psmCircleAtElapsed(circle, W, H, 0);
    const atEnd = psmCircleAtElapsed(circle, W, H, 240_000);
    expect(at0.x).toBeCloseTo(atEnd.x, 4);
    expect(at0.y).toBeCloseTo(atEnd.y, 4);
    expect(at0.scale).toBeCloseTo(atEnd.scale, 4);
    expect(at0.opacity).toBeCloseTo(atEnd.opacity, 4);
  });

  it('t=30000 und t=120000 erzeugen andere Positionen als t=0', () => {
    const circle = PSM_SCENE.largeCircles[0];
    const at0 = psmCircleAtElapsed(circle, W, H, 0);
    const at30 = psmCircleAtElapsed(circle, W, H, 30_000);
    const at120 = psmCircleAtElapsed(circle, W, H, 120_000);
    expect(at30.x).not.toBeCloseTo(at0.x, 1);
    expect(at120.y).not.toBeCloseTo(at0.y, 1);
  });

  it('3s Drift ist sichtbar groß (≥3px) für große Kreise', () => {
    const circle = PSM_SCENE.largeCircles[0];
    const at0 = psmCircleAtElapsed(circle, W, H, 0);
    const at3 = psmCircleAtElapsed(circle, W, H, 3_000);
    const drift = Math.hypot(at3.x - at0.x, at3.y - at0.y);
    expect(drift).toBeGreaterThan(3);
  });

  it('Bänder und Kurven haben eigene Bewegungsamplituden', () => {
    const bandAmps = new Set(PSM_SCENE.bands.map((b) => b.ampX));
    expect(bandAmps.size).toBeGreaterThan(1);
    for (const band of PSM_SCENE.bands) {
      expect(band.ampX).toBeGreaterThan(0);
      expect(band.d.length).toBeGreaterThan(10);
    }
    for (const curve of PSM_SCENE.curves) {
      expect(curve.ampX).toBeGreaterThan(0);
      expect(curve.dots.length).toBeGreaterThan(0);
    }
  });

  it('psmMotionOffset ist nahtlos über volle Phase', () => {
    const motion = PSM_SCENE.cornerDiscs[0];
    const at0 = psmMotionOffset(motion, 0);
    const atEnd = psmMotionOffset(motion, Math.PI * 2);
    expect(at0.dx).toBeCloseTo(atEnd.dx, 4);
    expect(at0.dy).toBeCloseTo(atEnd.dy, 4);
  });

  it('Opacity bleibt über definierte Mindestgrenze', () => {
    const phase = Math.PI;
    for (const c of [...PSM_SCENE.largeCircles, ...PSM_SCENE.mediumCircles]) {
      const { opacity } = psmCircleAt(c, W, H, phase);
      expect(opacity).toBeGreaterThanOrEqual(0.85);
      expect(opacity).toBeLessThanOrEqual(1);
    }
    for (const p of PSM_SCENE.smallParticles) {
      const { opacity } = psmCircleAt(p, W, H, phase);
      expect(opacity).toBeGreaterThanOrEqual(0.85);
    }
  });

  it('Linien-Opacity nicht hart 0', () => {
    for (let i = 0; i <= 8; i += 1) {
      const phase = (i / 8) * Math.PI * 2;
      for (const line of PSM_SCENE.lines) {
        const { opacity } = psmLineAt(line, W, H, phase);
        expect(opacity).toBeGreaterThanOrEqual(0.75);
      }
    }
  });
});

describe('GlobalPersistentSpaceMotionBackground component', () => {
  const componentPath = ['..', '..', 'components', 'backgrounds', 'GlobalPersistentSpaceMotionBackground.tsx'];

  it('nutzt requestAnimationFrame, visibilitychange und cleanup', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(path.join(__dirname, ...componentPath), 'utf8');
    expect(source).toContain('requestAnimationFrame');
    expect(source).toContain('cancelAnimationFrame');
    expect(source).toContain('visibilitychange');
    expect(source).toContain('getBackgroundPhase');
    expect(source).toContain('pointerEvents: \'none\'');
    expect(source).not.toMatch(/useState\([^)]*particle/i);
  });

  it('zeichnet Light-Paper Szene mit Path2D und psmMotionOffset', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(path.join(__dirname, ...componentPath), 'utf8');
    expect(source).toContain('persistent-space-canvas');
    expect(source).toContain('PSM_LOOP_MS');
    expect(source).toContain('data-loop-ms');
    expect(source).toContain('psmMotionOffset');
    expect(source).toContain('Path2D');
    expect(source).toContain('cornerDiscs');
    expect(source).toContain('buttonDots');
    expect(source).toContain('usePrefersReducedMotion');
    expect(source).toContain('StaticLightPaperBackground');
    expect(source).not.toContain('drawNebulaLayer');
  });
});

describe('GlobalAnimatedBackground wiring', () => {
  it('nutzt GlobalPersistentSpaceMotionBackground im Light-Mode', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'components', 'ui', 'effects', 'globalanimatedbackground.tsx'),
      'utf8',
    );
    expect(source).toContain('GlobalPersistentSpaceMotionBackground');
    expect(source).toContain('StaticLightPaperBackground');
    expect(source).not.toContain('AnimatedLightPaperBackground');
  });

  it('Root-Layout hat keinen Route-Key auf Background', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(path.join(__dirname, '..', '..', '..', 'app', '_layout.tsx'), 'utf8');
    expect(source).toContain('GlobalAnimatedBackground');
    expect(source).not.toMatch(/key=\{.*route/i);
    expect(source).not.toMatch(/key=\{.*module/i);
  });
});

describe('backgroundTime global basis', () => {
  it('exportiert globale Startzeit-Konstante', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'background', 'backgroundTime.ts'),
      'utf8',
    );
    expect(source).toContain('__careSuiteBackgroundStartTime');
    expect(source).toContain('globalThis');
  });
});
