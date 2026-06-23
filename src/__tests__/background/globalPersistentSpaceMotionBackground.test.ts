import { describe, expect, it } from 'vitest';
import { BACKGROUND_LOOP_MS, getBackgroundPhase } from '@/lib/background/backgroundTime';
import {
  PSM_LARGE_COUNT,
  PSM_LINE_COUNT,
  PSM_LOOP_MS,
  PSM_MEDIUM_COUNT,
  PSM_NEBULA_COUNT,
  PSM_SCENE,
  PSM_SMALL_COUNT,
  psmCircleAt,
  psmCircleAtElapsed,
  psmLineAt,
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

  it('definiert Pflicht-Element-Counts', () => {
    expect(PSM_SCENE.largeCircles).toHaveLength(PSM_LARGE_COUNT);
    expect(PSM_SCENE.largeCircles.length).toBeGreaterThanOrEqual(6);
    expect(PSM_SCENE.mediumCircles).toHaveLength(PSM_MEDIUM_COUNT);
    expect(PSM_SCENE.mediumCircles.length).toBeGreaterThanOrEqual(10);
    expect(PSM_SCENE.smallParticles).toHaveLength(PSM_SMALL_COUNT);
    expect(PSM_SCENE.smallParticles.length).toBeGreaterThanOrEqual(24);
    expect(PSM_SCENE.lines).toHaveLength(PSM_LINE_COUNT);
    expect(PSM_SCENE.lines.length).toBeGreaterThanOrEqual(12);
    expect(PSM_SCENE.nebulas).toHaveLength(PSM_NEBULA_COUNT);
    expect(PSM_SCENE.nebulas.length).toBeGreaterThanOrEqual(2);
  });

  it('Config ist deterministisch (gleiche Werte bei erneutem Import)', () => {
    const first = PSM_SCENE.largeCircles[0].bx;
    expect(PSM_SCENE.largeCircles[0].bx).toBe(first);
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

  it('große und kleine Kreise haben unterschiedliche Geschwindigkeiten', () => {
    const largeSpeeds = new Set(PSM_SCENE.largeCircles.map((c) => c.speedX));
    const smallSpeeds = new Set(PSM_SCENE.smallParticles.map((c) => c.speedX));
    const maxLarge = Math.max(...largeSpeeds);
    const minSmall = Math.min(...smallSpeeds);
    expect(minSmall).toBeGreaterThan(maxLarge);
  });

  it('Linien haben eigene Bewegungsparameter', () => {
    const lines = PSM_SCENE.lines;
    const rotSpeeds = new Set(lines.map((l) => l.rotSpeed));
    expect(rotSpeeds.size).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.ampX).toBeGreaterThan(0);
      expect(line.rotAmp).toBeGreaterThan(0);
    }
  });

  it('Opacity bleibt über definierte Mindestgrenze', () => {
    const phase = Math.PI;
    for (const c of [...PSM_SCENE.largeCircles, ...PSM_SCENE.mediumCircles]) {
      const { opacity } = psmCircleAt(c, W, H, phase);
      expect(opacity).toBeGreaterThanOrEqual(0.18);
      expect(opacity).toBeLessThanOrEqual(0.55);
    }
    for (const p of PSM_SCENE.smallParticles) {
      const { opacity } = psmCircleAt(p, W, H, phase);
      expect(opacity).toBeGreaterThanOrEqual(0.18);
    }
  });

  it('Linien-Opacity nicht hart 0', () => {
    for (let i = 0; i <= 8; i += 1) {
      const phase = (i / 8) * Math.PI * 2;
      for (const line of PSM_SCENE.lines) {
        const { opacity } = psmLineAt(line, W, H, phase);
        expect(opacity).toBeGreaterThanOrEqual(0.12);
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

  it('markiert persistent-space-canvas Engine und 240s Loop', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(path.join(__dirname, ...componentPath), 'utf8');
    expect(source).toContain('persistent-space-canvas');
    expect(source).toContain('PSM_LOOP_MS');
    expect(source).toContain('data-loop-ms');
    expect(source).toContain('usePrefersReducedMotion');
    expect(source).toContain('StaticLightPaperBackground');
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
