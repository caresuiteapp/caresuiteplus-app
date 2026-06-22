import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  llganAuroraWisps,
  llganBaseGradient,
  llganNebulaClouds,
  llganPearlescentGlows,
  llganStarDust,
  resolveLlganCanvasIntensity,
  type LlganAuroraWisp,
  type LlganNebulaCloud,
  type LlganPearlescentGlow,
} from '@/design/tokens/lightLiquidGlassAuroraNebula';
import { usePrefersReducedMotion } from '@/hooks/useprefersreducedmotion';
import {
  buildExtendedStarrySky,
  drawAnimatedStarrySky,
  resolveStarrySkyCount,
  type StarrySkyStar,
} from './lightStarrySkyCanvas';

export type LightLiquidGlassAuroraNebulaBackgroundProps = {
  animated?: boolean;
  dimmed?: boolean;
};

const BODY_BG_STYLE_ID = 'caresuite-llgan-body-bg';

function ensureWebDocumentTransparent() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById(BODY_BG_STYLE_ID)) return;
  const tag = document.createElement('style');
  tag.id = BODY_BG_STYLE_ID;
  tag.textContent = `
    html, body, #root, [data-expo-root] {
      background: transparent !important;
      background-color: transparent !important;
    }
  `;
  document.head.appendChild(tag);
}

const LLGAN_CANVAS_INTENSITY = resolveLlganCanvasIntensity('dashboard');
const LLGAN_CORNER_WISP_IDS = new Set(['wisp-tl', 'wisp-tr', 'wisp-br', 'wisp-feather-tl', 'wisp-feather-tr', 'wisp-feather-br']);

function hashCloudSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

type CloudBlob = { ox: number; oy: number; r: number; a: number };

function cloudBlobLayout(cloudId: string): CloudBlob[] {
  const seed = hashCloudSeed(cloudId);
  return Array.from({ length: 7 }, (_, i) => ({
    ox: Math.sin(seed * 0.017 + i * 2.13) * (0.22 + i * 0.06),
    oy: Math.cos(seed * 0.013 + i * 1.83) * (0.18 + i * 0.05),
    r: 0.38 + (i % 3) * 0.14 + (seed % 11) * 0.004,
    a: 0.42 + (i % 2) * 0.18,
  }));
}

function cubicBezierPoint(
  t: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
) {
  const u = 1 - t;
  return {
    x: u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
    y: u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
  };
}

function parallaxScale(layerDepth: number, animate: boolean): number {
  return animate ? 0.55 + layerDepth * 0.45 : 1;
}

function drawBaseGradient(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w * 0.55, h);
  g.addColorStop(0, '#EEF6FF');
  g.addColorStop(0.25, '#EAF4FF');
  g.addColorStop(0.5, '#E3EEFF');
  g.addColorStop(0.72, '#EDE8FF');
  g.addColorStop(1, '#E8F0FF');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawNebulaCloud(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  cloud: LlganNebulaCloud,
  animate: boolean,
) {
  const ps = parallaxScale(cloud.layerDepth, animate);
  const driftScale = animate ? ps : 0;
  const cx =
    cloud.bx * w +
    driftScale *
      (Math.sin(t * cloud.speed + cloud.phase) * cloud.driftX +
        Math.cos(t * cloud.speed * 0.58 + cloud.phase) * cloud.driftX * 0.32);
  const cy =
    cloud.by * h +
    driftScale *
      (Math.cos(t * cloud.speed * 0.86 + cloud.phase) * cloud.driftY +
        Math.sin(t * cloud.speed * 0.5 + cloud.phase * 1.2) * cloud.driftY * 0.38);
  const breathe = animate ? 1 + cloud.breathe * Math.sin(t * cloud.speed * 1.1 + cloud.phase) : 1;
  const baseRx = cloud.radiusX * w * breathe;
  const baseRy = cloud.radiusY * h * breathe;
  const opacity =
    cloud.baseOpacity * LLGAN_CANVAS_INTENSITY.nebulaOpacity +
    (animate ? Math.sin(t * cloud.speed * 0.7 + cloud.phase) * 0.04 : 0);

  const blobs = cloudBlobLayout(cloud.id);
  ctx.save();
  ctx.filter = 'blur(42px)';

  for (const blob of blobs) {
    const bx = cx + blob.ox * baseRx;
    const by = cy + blob.oy * baseRy;
    const r = Math.max(baseRx, baseRy) * blob.r;
    const alpha = Math.max(0.28, Math.min(0.88, opacity * blob.a));

    ctx.globalAlpha = alpha;
    const radial = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    radial.addColorStop(0, cloud.inner);
    radial.addColorStop(0.38, cloud.mid);
    radial.addColorStop(0.68, cloud.outer);
    radial.addColorStop(1, 'transparent');
    ctx.fillStyle = radial;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.filter = 'none';
  ctx.restore();
}

function drawAuroraWisp(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  wisp: LlganAuroraWisp,
  animate: boolean,
) {
  const ps = parallaxScale(wisp.layerDepth, animate);
  const cx =
    wisp.bx * w +
    (animate ? ps * Math.sin(t * wisp.speed + wisp.phase) * wisp.driftX : 0);
  const cy =
    wisp.by * h +
    (animate ? ps * Math.cos(t * wisp.speed * 0.9 + wisp.phase) * wisp.driftY : 0);
  const len = wisp.length * w * 0.5;
  const angle =
    wisp.angle + (animate ? Math.sin(t * wisp.speed * 0.4 + wisp.phase) * 0.06 : 0);
  const curve = 0.42 + Math.sin(wisp.phase * 1.3) * 0.12;

  const dx = Math.cos(angle) * len;
  const dy = Math.sin(angle) * len;
  const px = -Math.sin(angle) * len * curve;
  const py = Math.cos(angle) * len * curve;

  const x0 = cx - dx;
  const y0 = cy - dy;
  const x1 = cx - dx * 0.35 + px;
  const y1 = cy - dy * 0.35 + py;
  const x2 = cx + dx * 0.35 + px * 0.55;
  const y2 = cy + dy * 0.35 + py * 0.55;
  const x3 = cx + dx;
  const y3 = cy + dy;

  const cornerBoost = LLGAN_CORNER_WISP_IDS.has(wisp.id) ? 1.18 : 1;
  const steps = 16;

  ctx.save();
  ctx.filter = 'blur(18px)';

  for (let i = 0; i <= steps; i += 1) {
    const s = i / steps;
    const p = cubicBezierPoint(s, x0, y0, x1, y1, x2, y2, x3, y3);
    const fade = Math.sin(s * Math.PI);
    const r = wisp.thickness * h * (0.55 + fade * 1.35);
    const alpha = Math.min(
      0.72,
      fade * 0.55 * LLGAN_CANVAS_INTENSITY.wispOpacity * cornerBoost,
    );

    ctx.globalAlpha = alpha;
    const radial = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    radial.addColorStop(0, wisp.color);
    radial.addColorStop(0.45, wisp.color.replace(/[\d.]+\)$/, '0.08)'));
    radial.addColorStop(1, 'transparent');
    ctx.fillStyle = radial;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.filter = 'none';
  ctx.restore();
}

function drawStarDust(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  stars: readonly StarrySkyStar[],
  animate: boolean,
) {
  if (!Array.isArray(stars)) return;
  drawAnimatedStarrySky(ctx, w, h, t, stars, {
    animate,
    starOpacity: LLGAN_CANVAS_INTENSITY.starOpacity,
    palette: 'aurora',
    parallaxScale,
  });
}

function drawPearlescentGlow(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  pearl: LlganPearlescentGlow,
  animate: boolean,
) {
  const ps = parallaxScale(pearl.layerDepth, animate);
  const cx = pearl.bx * w;
  const cy = pearl.by * h;
  const pulse = animate
    ? 0.85 + 0.15 * Math.sin(t * pearl.pulseSpeed + pearl.phase)
    : 1;
  const r = pearl.radius * Math.min(w, h) * pulse * ps;

  ctx.save();
  ctx.globalAlpha = 0.55;
  const radial = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  radial.addColorStop(0, pearl.inner);
  radial.addColorStop(0.55, pearl.outer);
  radial.addColorStop(1, 'transparent');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Layer 5 — ruhige Mitte, weiche Ecken für backdrop-blur (keine Diagonalbänder). */
function drawFrostedGlassDepthLayer(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const veil = LLGAN_CANVAS_INTENSITY.centerVeilAlpha;
  const center = ctx.createRadialGradient(w * 0.5, h * 0.44, 0, w * 0.5, h * 0.44, w * 0.52);
  center.addColorStop(0, `rgba(247,250,255,${(veil * 1.1).toFixed(3)})`);
  center.addColorStop(0.5, `rgba(238,246,255,${(veil * 0.45).toFixed(3)})`);
  center.addColorStop(0.78, 'rgba(234,244,255,0.01)');
  center.addColorStop(1, 'rgba(234,244,255,0)');
  ctx.fillStyle = center;
  ctx.fillRect(0, 0, w, h);

  const corners = [
    { x: 0, y: 0, c: 'rgba(183,216,255,0.10)' },
    { x: w, y: 0, c: 'rgba(202,184,255,0.09)' },
    { x: 0, y: h, c: 'rgba(183,216,255,0.08)' },
    { x: w, y: h, c: 'rgba(243,221,251,0.08)' },
  ];
  for (const corner of corners) {
    const g = ctx.createRadialGradient(corner.x, corner.y, 0, corner.x, corner.y, w * 0.28);
    g.addColorStop(0, corner.c);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

function AuroraNebulaCanvas({
  animate,
  starCount,
}: {
  animate: boolean;
  starCount: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let starField: StarrySkyStar[] = [];

    const rebuildStars = (viewportWidth: number) => {
      const { starCount: resolvedStarCount, extraCount } = resolveStarrySkyCount(
        viewportWidth,
        llganStarDust.length,
      );
      starField = buildExtendedStarrySky(
        llganStarDust.slice(0, resolvedStarCount),
        extraCount,
        'llgan-stars',
      );
    };

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(parent.clientWidth * dpr);
      canvas.height = Math.floor(parent.clientHeight * dpr);
      canvas.style.width = `${parent.clientWidth}px`;
      canvas.style.height = `${parent.clientHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rebuildStars(parent.clientWidth);
    };

    resize();
    window.addEventListener('resize', resize);

    let frame = 0;

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const t = (Date.now() - startRef.current) / 1000;

      drawBaseGradient(ctx, w, h);

      for (const cloud of llganNebulaClouds) {
        drawNebulaCloud(ctx, w, h, t, cloud, animate);
      }

      for (const wisp of llganAuroraWisps) {
        drawAuroraWisp(ctx, w, h, t, wisp, animate);
      }

      for (const pearl of llganPearlescentGlows) {
        drawPearlescentGlow(ctx, w, h, t, pearl, animate);
      }

      drawFrostedGlassDepthLayer(ctx, w, h);

      drawStarDust(ctx, w, h, t, starField, animate);

      frame += 1;
      if (frame % 120 === 0) {
        const snap = llganNebulaClouds
          .map((c) => {
            const ps = parallaxScale(c.layerDepth, animate);
            const cx =
              c.bx * w + ps * Math.sin(t * c.speed + c.phase) * c.driftX;
            const cy =
              c.by * h + ps * Math.cos(t * c.speed * 0.86 + c.phase) * c.driftY;
            return `${c.id}:${Math.round(cx)},${Math.round(cy)}`;
          })
          .join('|');
        canvas.dataset.llganSnapshot = snap;
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [animate, starCount]);

  if (Platform.OS !== 'web') return null;

  return (
    <canvas
      ref={canvasRef}
      data-testid="llgan-aurora-nebula-canvas"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
      aria-hidden
    />
  );
}

/**
 * Light Liquid Glass Aurora Nebula — globaler animierter Hintergrund.
 * Layer: Nebula Clouds, Aurora Wisps, Star Dust, Pearlescent Glow, Frosted Depth.
 */
export function LightLiquidGlassAuroraNebulaBackground({
  animated = true,
  dimmed = false,
}: LightLiquidGlassAuroraNebulaBackgroundProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { width } = useWindowDimensions();
  const shouldAnimate = animated && !prefersReducedMotion;
  const { starCount } = resolveStarrySkyCount(width, llganStarDust.length);

  useEffect(() => {
    ensureWebDocumentTransparent();
  }, []);

  if (Platform.OS === 'web') {
    return (
      <View
        style={styles.root}
        pointerEvents="none"
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="light-liquid-glass-aurora-nebula-background"
      >
        <AuroraNebulaCanvas animate={shouldAnimate} starCount={starCount} />
        {dimmed ? <View style={styles.dimOverlay} pointerEvents="none" /> : null}
      </View>
    );
  }

  return (
    <View
      style={styles.root}
      pointerEvents="none"
      aria-hidden
      testID="light-liquid-glass-aurora-nebula-background"
    >
      <LinearGradient colors={[...llganBaseGradient]} style={StyleSheet.absoluteFillObject} />
      {dimmed ? <View style={styles.dimOverlay} pointerEvents="none" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 0,
    backgroundColor: '#EAF4FF',
    ...(Platform.OS === 'web'
      ? ({
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
        } as const)
      : null),
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(247,250,255,0.28)',
  },
});
