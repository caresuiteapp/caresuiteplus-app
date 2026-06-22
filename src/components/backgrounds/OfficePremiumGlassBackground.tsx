import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  opgbAuroraWisps,
  opgbBaseGradient,
  opgbBokehDust,
  opgbCanvasIntensity,
  opgbDiffuseGlows,
  opgbNebulaClouds,
  opgbStarDust,
  type OpgbAuroraWisp,
  type OpgbBokehDust,
  type OpgbDiffuseGlow,
  type OpgbNebulaCloud,
} from '@/design/tokens/officePremiumGlassBackground';
import { usePrefersReducedMotion } from '@/hooks/useprefersreducedmotion';
import {
  buildExtendedStarrySky,
  drawAnimatedStarrySky,
  resolveStarrySkyCount,
  type StarrySkyStar,
} from './lightStarrySkyCanvas';

export type OfficePremiumGlassBackgroundProps = {
  animated?: boolean;
  dimmed?: boolean;
};

const BODY_BG_STYLE_ID = 'caresuite-opgb-body-bg';

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
  return Array.from({ length: 6 }, (_, i) => ({
    ox: Math.sin(seed * 0.017 + i * 2.13) * (0.2 + i * 0.05),
    oy: Math.cos(seed * 0.013 + i * 1.83) * (0.16 + i * 0.04),
    r: 0.36 + (i % 3) * 0.12 + (seed % 11) * 0.003,
    a: 0.38 + (i % 2) * 0.16,
  }));
}

function parallaxScale(layerDepth: number, animate: boolean): number {
  return animate ? 0.5 + layerDepth * 0.42 : 1;
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

function drawAmbientBase(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w * 0.5, h);
  g.addColorStop(0, opgbBaseGradient[0]);
  g.addColorStop(0.2, opgbBaseGradient[1]);
  g.addColorStop(0.45, opgbBaseGradient[2]);
  g.addColorStop(0.68, opgbBaseGradient[3]);
  g.addColorStop(1, opgbBaseGradient[4]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const warmBlush = ctx.createRadialGradient(w * 0.12, h * 0.22, 0, w * 0.12, h * 0.22, w * 0.42);
  warmBlush.addColorStop(0, 'rgba(252,228,236,0.42)');
  warmBlush.addColorStop(0.55, 'rgba(248,238,242,0.14)');
  warmBlush.addColorStop(1, 'transparent');
  ctx.fillStyle = warmBlush;
  ctx.fillRect(0, 0, w, h);

  const coolLavender = ctx.createRadialGradient(w * 0.88, h * 0.18, 0, w * 0.88, h * 0.18, w * 0.38);
  coolLavender.addColorStop(0, 'rgba(220,210,255,0.36)');
  coolLavender.addColorStop(0.6, 'rgba(237,232,255,0.12)');
  coolLavender.addColorStop(1, 'transparent');
  ctx.fillStyle = coolLavender;
  ctx.fillRect(0, 0, w, h);

  const wash = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, w * 0.58);
  wash.addColorStop(0, 'rgba(249,251,255,0.22)');
  wash.addColorStop(0.55, 'rgba(245,247,250,0.05)');
  wash.addColorStop(1, 'transparent');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
}

function drawNebulaCloud(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  cloud: OpgbNebulaCloud,
  animate: boolean,
) {
  const ps = parallaxScale(cloud.layerDepth, animate);
  const driftScale = animate ? ps : 0;
  const cx =
    cloud.bx * w +
    driftScale *
      (Math.sin(t * cloud.speed + cloud.phase) * cloud.driftX +
        Math.cos(t * cloud.speed * 0.52 + cloud.phase) * cloud.driftX * 0.28);
  const cy =
    cloud.by * h +
    driftScale *
      (Math.cos(t * cloud.speed * 0.78 + cloud.phase) * cloud.driftY +
        Math.sin(t * cloud.speed * 0.44 + cloud.phase * 1.15) * cloud.driftY * 0.32);
  const breathe = animate ? 1 + cloud.breathe * Math.sin(t * cloud.speed * 0.9 + cloud.phase) : 1;
  const baseRx = cloud.radiusX * w * breathe;
  const baseRy = cloud.radiusY * h * breathe;
  const opacity =
    cloud.baseOpacity * opgbCanvasIntensity.nebulaOpacity +
    (animate ? Math.sin(t * cloud.speed * 0.55 + cloud.phase) * 0.025 : 0);

  const blobs = cloudBlobLayout(cloud.id);
  ctx.save();
  ctx.filter = 'blur(48px)';

  for (const blob of blobs) {
    const bx = cx + blob.ox * baseRx;
    const by = cy + blob.oy * baseRy;
    const r = Math.max(baseRx, baseRy) * blob.r;
    const alpha = Math.max(0.22, Math.min(0.72, opacity * blob.a));

    ctx.globalAlpha = alpha;
    const radial = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    radial.addColorStop(0, cloud.inner);
    radial.addColorStop(0.4, cloud.mid);
    radial.addColorStop(0.72, cloud.outer);
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
  wisp: OpgbAuroraWisp,
  animate: boolean,
) {
  const ps = parallaxScale(wisp.layerDepth, animate);
  const cx =
    wisp.bx * w + (animate ? ps * Math.sin(t * wisp.speed + wisp.phase) * wisp.driftX : 0);
  const cy =
    wisp.by * h + (animate ? ps * Math.cos(t * wisp.speed * 0.85 + wisp.phase) * wisp.driftY : 0);
  const len = wisp.length * w * 0.48;
  const angle =
    wisp.angle + (animate ? Math.sin(t * wisp.speed * 0.35 + wisp.phase) * 0.04 : 0);
  const curve = 0.38 + Math.sin(wisp.phase * 1.2) * 0.1;

  const dx = Math.cos(angle) * len;
  const dy = Math.sin(angle) * len;
  const px = -Math.sin(angle) * len * curve;
  const py = Math.cos(angle) * len * curve;

  const x0 = cx - dx;
  const y0 = cy - dy;
  const x1 = cx - dx * 0.35 + px;
  const y1 = cy - dy * 0.35 + py;
  const x2 = cx + dx * 0.35 + px * 0.5;
  const y2 = cy + dy * 0.35 + py * 0.5;
  const x3 = cx + dx;
  const y3 = cy + dy;

  ctx.save();
  ctx.filter = 'blur(22px)';

  for (let i = 0; i <= 14; i += 1) {
    const s = i / 14;
    const p = cubicBezierPoint(s, x0, y0, x1, y1, x2, y2, x3, y3);
    const fade = Math.sin(s * Math.PI);
    const r = wisp.thickness * h * (0.5 + fade * 1.2);
    const alpha = Math.min(0.48, fade * 0.42 * opgbCanvasIntensity.wispOpacity);

    ctx.globalAlpha = alpha;
    const radial = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    radial.addColorStop(0, wisp.color);
    radial.addColorStop(0.5, wisp.color.replace(/[\d.]+\)$/, '0.05)'));
    radial.addColorStop(1, 'transparent');
    ctx.fillStyle = radial;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.filter = 'none';
  ctx.restore();
}

function drawDiffuseGlow(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  glow: OpgbDiffuseGlow,
  animate: boolean,
) {
  const ps = parallaxScale(glow.layerDepth, animate);
  const cx = glow.bx * w;
  const cy = glow.by * h;
  const pulse = animate
    ? 0.88 + 0.12 * Math.sin(t * glow.pulseSpeed + glow.phase)
    : 1;
  const r = glow.radius * Math.min(w, h) * pulse * ps;

  ctx.save();
  ctx.globalAlpha = opgbCanvasIntensity.glowOpacity;
  const radial = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  radial.addColorStop(0, glow.inner);
  radial.addColorStop(0.6, glow.outer);
  radial.addColorStop(1, 'transparent');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawBokehDust(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  bokeh: OpgbBokehDust,
  animate: boolean,
) {
  const ps = parallaxScale(bokeh.layerDepth, animate);
  const cx =
    bokeh.bx * w +
    (animate ? ps * Math.sin(t * bokeh.speed + bokeh.phase) * bokeh.driftX : 0);
  const cy =
    bokeh.by * h +
    (animate ? ps * Math.cos(t * bokeh.speed * 0.9 + bokeh.phase) * bokeh.driftY : 0);
  const r = bokeh.radius * Math.min(w, h);

  ctx.save();
  ctx.filter = 'blur(28px)';
  ctx.globalAlpha = bokeh.baseOpacity * opgbCanvasIntensity.bokehOpacity;
  const radial = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  radial.addColorStop(0, bokeh.color);
  radial.addColorStop(1, 'transparent');
  ctx.fillStyle = radial;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
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
    starOpacity: opgbCanvasIntensity.starOpacity,
    palette: 'pearl',
    parallaxScale,
  });
}

function drawFrostedDepth(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const veil = opgbCanvasIntensity.centerVeilAlpha;
  const center = ctx.createRadialGradient(w * 0.5, h * 0.46, 0, w * 0.5, h * 0.46, w * 0.54);
  center.addColorStop(0, `rgba(249,251,255,${(veil * 2.2).toFixed(3)})`);
  center.addColorStop(0.55, `rgba(245,247,250,${(veil * 0.85).toFixed(3)})`);
  center.addColorStop(0.82, 'rgba(249,251,255,0.008)');
  center.addColorStop(1, 'rgba(249,251,255,0)');
  ctx.fillStyle = center;
  ctx.fillRect(0, 0, w, h);

  const corners = [
    { x: 0, y: 0, c: 'rgba(232,242,255,0.07)' },
    { x: w, y: 0, c: 'rgba(237,232,255,0.06)' },
    { x: 0, y: h, c: 'rgba(248,238,242,0.06)' },
    { x: w, y: h, c: 'rgba(228,232,238,0.06)' },
  ];
  for (const corner of corners) {
    const g = ctx.createRadialGradient(corner.x, corner.y, 0, corner.x, corner.y, w * 0.26);
    g.addColorStop(0, corner.c);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

function OfficePremiumCanvas({
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
        opgbStarDust.length,
      );
      starField = buildExtendedStarrySky(
        opgbStarDust.slice(0, resolvedStarCount),
        extraCount,
        'opgb-stars',
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

      drawAmbientBase(ctx, w, h);

      for (const cloud of opgbNebulaClouds) {
        drawNebulaCloud(ctx, w, h, t, cloud, animate);
      }

      for (const glow of opgbDiffuseGlows) {
        drawDiffuseGlow(ctx, w, h, t, glow, animate);
      }

      for (const wisp of opgbAuroraWisps) {
        drawAuroraWisp(ctx, w, h, t, wisp, animate);
      }

      for (const bokeh of opgbBokehDust) {
        drawBokehDust(ctx, w, h, t, bokeh, animate);
      }

      drawFrostedDepth(ctx, w, h);

      drawStarDust(ctx, w, h, t, starField, animate);

      frame += 1;
      if (frame % 120 === 0) {
        const snap = opgbNebulaClouds
          .map((c) => {
            const ps = parallaxScale(c.layerDepth, animate);
            const cx = c.bx * w + ps * Math.sin(t * c.speed + c.phase) * c.driftX;
            const cy = c.by * h + ps * Math.cos(t * c.speed * 0.78 + c.phase) * c.driftY;
            return `${c.id}:${Math.round(cx)},${Math.round(cy)}`;
          })
          .join('|');
        canvas.dataset.opgbSnapshot = snap;
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
      data-testid="office-premium-glass-canvas"
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
 * Office Premium Glass Background — helle Glassmorphism-Atmosphäre mit
 * Pearl/Eisblau/Lavendel/Blush/Silber, sanfter Aurora-Bewegung und Sternenhimmel.
 */
export function OfficePremiumGlassBackground({
  animated = true,
  dimmed = false,
}: OfficePremiumGlassBackgroundProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { width } = useWindowDimensions();
  const shouldAnimate = animated && !prefersReducedMotion;
  const { starCount } = resolveStarrySkyCount(width, opgbStarDust.length);

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
        testID="office-premium-glass-background"
        nativeID="caresuite-office-premium-glass-bg"
      >
        <OfficePremiumCanvas animate={shouldAnimate} starCount={starCount} />
        {dimmed ? <View style={styles.dimOverlay} pointerEvents="none" /> : null}
      </View>
    );
  }

  return (
    <View
      style={styles.root}
      pointerEvents="none"
      aria-hidden
      testID="office-premium-glass-background"
    >
      <LinearGradient colors={[...opgbBaseGradient]} style={StyleSheet.absoluteFillObject} />
      {dimmed ? <View style={styles.dimOverlay} pointerEvents="none" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 0,
    backgroundColor: opgbBaseGradient[0],
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
    backgroundColor: 'rgba(249,251,255,0.22)',
  },
});
