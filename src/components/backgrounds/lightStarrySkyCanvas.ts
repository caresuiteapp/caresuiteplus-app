export type StarrySkyStar = {
  nx: number;
  ny: number;
  radius: number;
  baseOpacity: number;
  twinkleSpeed: number;
  glowRadius: number;
  layerDepth: number;
  phase: number;
  /** 0–1 — helle Sterne mit sanftem Kreuz-Glint */
  sparkle?: number;
  driftX?: number;
  driftY?: number;
};

export type StarrySkyPalette = 'aurora' | 'pearl';

export type DrawStarrySkyOptions = {
  animate: boolean;
  starOpacity: number;
  palette: StarrySkyPalette;
  parallaxScale: (layerDepth: number, animate: boolean) => number;
};

function hashSeed(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/** Ergänzt statische Sterne um deterministische Feld-Sterne. */
export function buildExtendedStarrySky(
  base: readonly StarrySkyStar[],
  extraCount: number,
  seedKey: string,
): StarrySkyStar[] {
  if (extraCount <= 0) {
    return base.map((star) => ({
      ...star,
      sparkle: star.sparkle ?? (star.baseOpacity > 0.4 ? 0.55 : 0.15),
    }));
  }

  const rand = createSeededRandom(hashSeed(seedKey));
  const extras: StarrySkyStar[] = [];

  for (let i = 0; i < extraCount; i += 1) {
    extras.push({
      nx: rand(),
      ny: rand(),
      radius: 0.4 + rand() * 0.85,
      baseOpacity: 0.26 + rand() * 0.24,
      twinkleSpeed: 0.035 + rand() * 0.09,
      glowRadius: 2 + rand() * 4.2,
      layerDepth: 0.84 + rand() * 0.14,
      phase: rand() * Math.PI * 2,
      sparkle: rand(),
      driftX: 8 + rand() * 18,
      driftY: 6 + rand() * 14,
    });
  }

  return [
    ...base.map((star) => ({
      ...star,
      sparkle: star.sparkle ?? (star.baseOpacity > 0.4 ? 0.6 : 0.12),
      driftX: star.driftX ?? 10 + (star.nx * 14) % 12,
      driftY: star.driftY ?? 8 + (star.ny * 12) % 10,
    })),
    ...extras,
  ];
}

function drawSparkleGlint(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  alpha: number,
) {
  const arm = size * 2.8;
  ctx.strokeStyle = `rgba(255,255,255,${(alpha * 0.35).toFixed(3)})`;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(x - arm, y);
  ctx.lineTo(x + arm, y);
  ctx.moveTo(x, y - arm);
  ctx.lineTo(x, y + arm);
  ctx.stroke();
}

/** Animierter Sternenhimmel — Twinkle, Drift, pulsierender Glow, optionale Glints. */
export function drawAnimatedStarrySky(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  stars: readonly StarrySkyStar[],
  options: DrawStarrySkyOptions,
): void {
  if (!Array.isArray(stars)) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn(
        '[drawAnimatedStarrySky] expected stars array, received',
        stars === null ? 'null' : typeof stars,
      );
    }
    return;
  }

  const { animate, starOpacity, palette, parallaxScale } = options;
  const glowInner =
    palette === 'aurora' ? 'rgba(185,215,255,' : 'rgba(228,232,238,';

  for (const star of stars) {
    const ps = parallaxScale(star.layerDepth, animate);
    const driftX = star.driftX ?? 12;
    const driftY = star.driftY ?? 10;
    const px = animate
      ? Math.sin(t * (0.08 + star.twinkleSpeed * 0.35) + star.phase) * driftX * ps * 0.22
      : 0;
    const py = animate
      ? Math.cos(t * (0.07 + star.twinkleSpeed * 0.3) + star.phase * 1.1) * driftY * ps * 0.18
      : 0;

    const twinkleWave = animate
      ? 0.5 + 0.5 * Math.sin(t * star.twinkleSpeed + star.phase)
      : 0.72;
    const twinkle = animate ? 0.22 + 0.48 * twinkleWave : star.baseOpacity;
    const alpha = Math.max(
      0.14,
      Math.min(0.72, twinkle * star.baseOpacity * starOpacity),
    );

    const x = star.nx * w + px;
    const y = star.ny * h + py;
    const pulse = animate ? 0.82 + 0.18 * Math.sin(t * star.twinkleSpeed * 0.85 + star.phase) : 1;
    const glowR = star.glowRadius * pulse;

    ctx.save();

    const glow = ctx.createRadialGradient(x, y, 0, x, y, glowR);
    glow.addColorStop(0, `${glowInner}${(alpha * 0.62).toFixed(3)})`);
    glow.addColorStop(0.45, `${glowInner}${(alpha * 0.18).toFixed(3)})`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, glowR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, star.radius, 0, Math.PI * 2);
    ctx.fill();

    if ((star.sparkle ?? 0) > 0.62 && alpha > 0.28) {
      drawSparkleGlint(ctx, x, y, star.radius + 0.4, alpha * (star.sparkle ?? 0.5));
    }

    ctx.restore();
  }
}

export function resolveStarrySkyCount(
  width: number,
  baseCount: number,
): { starCount: number; extraCount: number } {
  if (width < 768) {
    return { starCount: Math.min(baseCount, 20), extraCount: 12 };
  }
  if (width < 1280) {
    return { starCount: Math.min(baseCount, 28), extraCount: 20 };
  }
  return { starCount: baseCount, extraCount: 32 };
}
