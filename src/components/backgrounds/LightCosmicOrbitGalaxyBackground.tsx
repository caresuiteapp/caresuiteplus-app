import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname } from 'expo-router';
import {
  LCOG_LAYER_IDS,
  lcogAuroraWisps,
  lcogBaseGradient,
  lcogCanvasIntensity,
  lcogGalaxyClouds,
  lcogLightPaths,
  lcogOrbitRings,
  lcogStarDust,
  resolveLcogModuleAccentRgba,
  type LcogAuroraWisp,
  type LcogGalaxyCloud,
  type LcogLightPath,
  type LcogOrbitRing,
} from '@/design/tokens/lightCosmicOrbitGalaxy';
import { resolveMainModuleFromPath } from '@/lib/navigation/resolvemainmodule';
import { usePrefersReducedMotion } from '@/hooks/useprefersreducedmotion';
import {
  buildExtendedStarrySky,
  drawAnimatedStarrySky,
  resolveStarrySkyCount,
  type StarrySkyStar,
} from './lightStarrySkyCanvas';

export type LightCosmicOrbitGalaxyBackgroundProps = {
  animated?: boolean;
  dimmed?: boolean;
};

const BODY_BG_STYLE_ID = 'caresuite-lcog-body-bg';

type FloatingParticle = {
  nx: number;
  ny: number;
  size: number;
  speed: number;
  phase: number;
  driftX: number;
  driftY: number;
  opacity: number;
};

type CometStreak = {
  x0: number;
  y0: number;
  angle: number;
  length: number;
  speed: number;
  width: number;
  progress: number;
  color: string;
  active: boolean;
};

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

function hashSeed(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function parallaxScale(layerDepth: number, animate: boolean): number {
  return animate ? 0.55 + layerDepth * 0.45 : 1;
}

/** Edges stronger, center calmer for glass card readability. */
function edgeIntensity(x: number, y: number, w: number, h: number): number {
  const dx = (x - w * 0.5) / (w * 0.48);
  const dy = (y - h * 0.44) / (h * 0.48);
  const dist = Math.sqrt(dx * dx + dy * dy);
  return Math.min(1, Math.max(0.32, dist * 0.92 + 0.28));
}

function cloudBlobLayout(cloudId: string) {
  const seed = hashSeed(cloudId);
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

function buildParticles(count: number, seedKey: string): FloatingParticle[] {
  const rand = seededRandom(hashSeed(seedKey));
  return Array.from({ length: count }, () => ({
    nx: rand(),
    ny: rand(),
    size: 0.6 + rand() * 1.8,
    speed: 0.04 + rand() * 0.08,
    phase: rand() * Math.PI * 2,
    driftX: 20 + rand() * 40,
    driftY: 16 + rand() * 32,
    opacity: 0.22 + rand() * 0.28,
  }));
}

function buildComets(count: number, accentColor: string): CometStreak[] {
  const rand = seededRandom(hashSeed('lcog-comets'));
  return Array.from({ length: count }, (_, i) => ({
    x0: rand(),
    y0: rand() * 0.5,
    angle: 0.3 + rand() * 0.9,
    length: 80 + rand() * 120,
    speed: 0.35 + rand() * 0.25,
    width: 1.2 + rand() * 0.8,
    progress: -i * 3.5,
    color: accentColor,
    active: true,
  }));
}

function drawBaseGradient(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string) {
  const g = ctx.createLinearGradient(0, 0, w * 0.6, h);
  g.addColorStop(0, '#D8E8FF');
  g.addColorStop(0.22, '#D0E4FF');
  g.addColorStop(0.48, '#CCE0FF');
  g.addColorStop(0.68, '#D8DCFF');
  g.addColorStop(1, '#E0ECFF');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const accentGlow = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, w * 0.72);
  accentGlow.addColorStop(0, accent.replace(/[\d.]+\)$/, '0.06)'));
  accentGlow.addColorStop(0.55, accent.replace(/[\d.]+\)$/, '0.03)'));
  accentGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = accentGlow;
  ctx.fillRect(0, 0, w, h);
}

function drawGalaxyCloud(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  cloud: LcogGalaxyCloud,
  animate: boolean,
  accent: string,
) {
  const ps = parallaxScale(cloud.layerDepth, animate);
  const driftScale = animate ? ps : 0;
  const cx =
    cloud.bx * w +
    driftScale *
      (Math.sin(t * cloud.speed + cloud.phase) * cloud.driftX +
        Math.cos(t * cloud.speed * 0.62 + cloud.phase) * cloud.driftX * 0.35);
  const cy =
    cloud.by * h +
    driftScale *
      (Math.cos(t * cloud.speed * 0.88 + cloud.phase) * cloud.driftY +
        Math.sin(t * cloud.speed * 0.52 + cloud.phase * 1.2) * cloud.driftY * 0.4);
  const breathe = animate ? 1 + cloud.breathe * Math.sin(t * cloud.speed * 1.15 + cloud.phase) : 1;
  const baseRx = cloud.radiusX * w * breathe;
  const baseRy = cloud.radiusY * h * breathe;
  const edge = edgeIntensity(cx, cy, w, h);
  const opacity =
    cloud.baseOpacity * lcogCanvasIntensity.nebulaOpacity * edge +
    (animate ? Math.sin(t * cloud.speed * 0.75 + cloud.phase) * 0.05 : 0);

  const blobs = cloudBlobLayout(cloud.id);
  ctx.save();
  ctx.filter = 'blur(44px)';

  for (const blob of blobs) {
    const bx = cx + blob.ox * baseRx;
    const by = cy + blob.oy * baseRy;
    const r = Math.max(baseRx, baseRy) * blob.r;
    const alpha = Math.max(0.3, Math.min(0.92, opacity * blob.a));

    ctx.globalAlpha = alpha;
    const radial = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    radial.addColorStop(0, cloud.inner);
    radial.addColorStop(0.35, cloud.mid);
    radial.addColorStop(0.65, cloud.outer);
    radial.addColorStop(0.88, accent.replace(/[\d.]+\)$/, '0.08)'));
    radial.addColorStop(1, 'transparent');
    ctx.fillStyle = radial;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.filter = 'none';
  ctx.restore();
}

function drawOrbitRing(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  ring: LcogOrbitRing,
  animate: boolean,
  accent: string,
) {
  const minDim = Math.min(w, h);
  const cx = ring.cx * w;
  const cy = ring.cy * h;
  const rx = ring.rx * minDim;
  const ry = ring.ry * minDim;
  const rot = ring.rotation + (animate ? t * ring.speed : 0);
  const edge = edgeIntensity(cx, cy, w, h);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.globalAlpha = ring.opacity * lcogCanvasIntensity.orbitOpacity * edge;
  ctx.strokeStyle = ring.stroke;
  ctx.lineWidth = ring.lineWidth;

  if (ring.dash) {
    ctx.setLineDash(ring.dash);
  }

  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = ring.opacity * lcogCanvasIntensity.orbitOpacity * edge * 0.45;
  ctx.strokeStyle = accent.replace(/[\d.]+\)$/, '0.22)');
  ctx.lineWidth = ring.lineWidth * 0.6;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 0.92, ry * 0.92, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawAuroraWisp(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  wisp: LcogAuroraWisp,
  animate: boolean,
) {
  const ps = parallaxScale(wisp.layerDepth, animate);
  const cx =
    wisp.bx * w + (animate ? ps * Math.sin(t * wisp.speed + wisp.phase) * wisp.driftX : 0);
  const cy =
    wisp.by * h + (animate ? ps * Math.cos(t * wisp.speed * 0.92 + wisp.phase) * wisp.driftY : 0);
  const len = wisp.length * w * 0.5;
  const angle = wisp.angle + (animate ? Math.sin(t * wisp.speed * 0.45 + wisp.phase) * 0.08 : 0);
  const curve = 0.44 + Math.sin(wisp.phase * 1.3) * 0.14;

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

  const edge = edgeIntensity(cx, cy, w, h);
  const steps = 18;

  ctx.save();
  ctx.filter = 'blur(20px)';

  for (let i = 0; i <= steps; i += 1) {
    const s = i / steps;
    const p = cubicBezierPoint(s, x0, y0, x1, y1, x2, y2, x3, y3);
    const fade = Math.sin(s * Math.PI);
    const r = wisp.thickness * h * (0.58 + fade * 1.4);
    const alpha = Math.min(0.78, fade * 0.58 * lcogCanvasIntensity.wispOpacity * edge);

    ctx.globalAlpha = alpha;
    const radial = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    radial.addColorStop(0, wisp.color);
    radial.addColorStop(0.45, wisp.color.replace(/[\d.]+\)$/, '0.1)'));
    radial.addColorStop(1, 'transparent');
    ctx.fillStyle = radial;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.filter = 'none';
  ctx.restore();
}

function drawLightPath(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  path: LcogLightPath,
  animate: boolean,
) {
  const x0 = path.x0 * w;
  const y0 = path.y0 * h;
  const x1 = path.x1 * w;
  const y1 = path.y1 * h;
  const mx = (x0 + x1) * 0.5 + (animate ? Math.sin(t * path.speed + path.phase) * 24 : 0);
  const my = (y0 + y1) * 0.5 + (animate ? Math.cos(t * path.speed * 0.9 + path.phase) * 18 : 0);
  const edge = edgeIntensity(mx, my, w, h);

  ctx.save();
  ctx.globalAlpha = lcogCanvasIntensity.pathOpacity * edge;
  ctx.strokeStyle = path.color;
  ctx.lineWidth = path.width;
  ctx.lineCap = 'round';
  ctx.shadowColor = path.color;
  ctx.shadowBlur = 8;

  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(mx, my, x1, y1);
  ctx.stroke();

  if (animate) {
    const pulse = 0.5 + 0.5 * Math.sin(t * path.speed * 2.2 + path.phase);
    const px = x0 + (x1 - x0) * pulse;
    const py = y0 + (y1 - y0) * pulse;
    ctx.globalAlpha = lcogCanvasIntensity.pathOpacity * edge * 0.8;
    ctx.fillStyle = path.color.replace(/[\d.]+\)$/, '0.55)');
    ctx.beginPath();
    ctx.arc(px, py, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  particles: readonly FloatingParticle[],
  animate: boolean,
) {
  for (const p of particles) {
    const px = animate
      ? p.nx * w + Math.sin(t * p.speed + p.phase) * p.driftX
      : p.nx * w;
    const py = animate
      ? p.ny * h + Math.cos(t * p.speed * 0.88 + p.phase) * p.driftY
      : p.ny * h;
    const edge = edgeIntensity(px, py, w, h);
    const twinkle = animate ? 0.55 + 0.45 * Math.sin(t * p.speed * 1.4 + p.phase) : 0.75;
    const alpha = p.opacity * lcogCanvasIntensity.particleOpacity * edge * twinkle;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(180,220,255,0.85)';
    ctx.beginPath();
    ctx.arc(px, py, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawCometStreaks(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  comets: CometStreak[],
  animate: boolean,
) {
  if (!animate) return;

  for (const comet of comets) {
    comet.progress += comet.speed * 0.016;
    if (comet.progress > 1.4) {
      comet.progress = -0.2 - Math.random() * 0.4;
      comet.x0 = Math.random();
      comet.y0 = Math.random() * 0.45;
      comet.angle = 0.25 + Math.random() * 1;
    }

    if (comet.progress < 0 || comet.progress > 1.2) continue;

    const sx = comet.x0 * w;
    const sy = comet.y0 * h;
    const len = comet.length * comet.progress;
    const ex = sx + Math.cos(comet.angle) * len;
    const ey = sy + Math.sin(comet.angle) * len;
    const edge = edgeIntensity(ex, ey, w, h);
    const fade = Math.sin(Math.min(1, comet.progress) * Math.PI);

    const grad = ctx.createLinearGradient(sx, sy, ex, ey);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(0.6, comet.color.replace(/[\d.]+\)$/, `${(0.08 * fade * edge).toFixed(3)})`));
    grad.addColorStop(1, comet.color.replace(/[\d.]+\)$/, `${(0.42 * fade * edge).toFixed(3)})`));

    ctx.save();
    ctx.globalAlpha = fade * edge;
    ctx.strokeStyle = grad;
    ctx.lineWidth = comet.width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.restore();
  }
}

function drawCenterVeil(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const veil = lcogCanvasIntensity.centerVeilAlpha;
  const center = ctx.createRadialGradient(w * 0.5, h * 0.44, 0, w * 0.5, h * 0.44, w * 0.5);
  center.addColorStop(0, `rgba(245,248,255,${(veil * 1.15).toFixed(3)})`);
  center.addColorStop(0.45, `rgba(238,246,255,${(veil * 0.5).toFixed(3)})`);
  center.addColorStop(0.75, 'rgba(234,244,255,0.01)');
  center.addColorStop(1, 'rgba(234,244,255,0)');
  ctx.fillStyle = center;
  ctx.fillRect(0, 0, w, h);
}

function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const v = ctx.createRadialGradient(w * 0.5, h * 0.46, w * 0.28, w * 0.5, h * 0.46, w * 0.82);
  v.addColorStop(0, 'transparent');
  v.addColorStop(0.72, 'rgba(120,150,200,0.03)');
  v.addColorStop(1, 'rgba(80,110,170,0.10)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

function CosmicOrbitCanvas({
  animate,
  starCount,
  moduleAccent,
}: {
  animate: boolean;
  starCount: number;
  moduleAccent: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef(Date.now());
  const pausedRef = useRef(false);
  const particlesRef = useRef<FloatingParticle[]>([]);
  const cometsRef = useRef<CometStreak[]>([]);
  const starsRef = useRef<StarrySkyStar[]>([]);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    particlesRef.current = buildParticles(48, 'lcog-particles');
    cometsRef.current = buildComets(3, moduleAccent);
    pausedRef.current = false;

    const rebuildStars = (viewportWidth: number) => {
      const { starCount: resolvedStarCount, extraCount } = resolveStarrySkyCount(
        viewportWidth,
        lcogStarDust.length,
      );
      starsRef.current = buildExtendedStarrySky(
        lcogStarDust.slice(0, resolvedStarCount),
        extraCount,
        'lcog-stars',
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

    const onVisibility = () => {
      pausedRef.current = document.hidden;
      if (!document.hidden && frameRef.current === null) {
        frameRef.current = requestAnimationFrame(draw);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);

    let frame = 0;

    const draw = () => {
      frameRef.current = null;
      if (pausedRef.current) return;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const t = (Date.now() - startRef.current) / 1000;

      drawBaseGradient(ctx, w, h, moduleAccent);

      for (const cloud of lcogGalaxyClouds) {
        drawGalaxyCloud(ctx, w, h, t, cloud, animate, moduleAccent);
      }

      for (const ring of lcogOrbitRings) {
        drawOrbitRing(ctx, w, h, t, ring, animate, moduleAccent);
      }

      drawAnimatedStarrySky(ctx, w, h, t, starsRef.current, {
        animate,
        starOpacity: lcogCanvasIntensity.starOpacity,
        palette: 'aurora',
        parallaxScale,
      });

      drawParticles(ctx, w, h, t, particlesRef.current, animate);

      for (const wisp of lcogAuroraWisps) {
        drawAuroraWisp(ctx, w, h, t, wisp, animate);
      }

      for (const path of lcogLightPaths) {
        drawLightPath(ctx, w, h, t, path, animate);
      }

      drawCometStreaks(ctx, w, h, t, cometsRef.current, animate);

      drawCenterVeil(ctx, w, h);
      drawVignette(ctx, w, h);

      frame += 1;
      if (frame % 120 === 0) {
        const snap = lcogGalaxyClouds
          .map((c) => {
            const ps = parallaxScale(c.layerDepth, animate);
            const cx = c.bx * w + ps * Math.sin(t * c.speed + c.phase) * c.driftX;
            const cy = c.by * h + ps * Math.cos(t * c.speed * 0.88 + c.phase) * c.driftY;
            return `${c.id}:${Math.round(cx)},${Math.round(cy)}`;
          })
          .join('|');
        canvas.dataset.lcogSnapshot = snap;
        canvas.dataset.lcogLayers = LCOG_LAYER_IDS.join(',');
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [animate, starCount, moduleAccent]);

  if (Platform.OS !== 'web') return null;

  return (
    <canvas
      ref={canvasRef}
      data-testid="lcog-cosmic-orbit-canvas"
      data-layers={LCOG_LAYER_IDS.join(',')}
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
 * Light Cosmic Orbit Galaxy — global animated background with nine visual layers.
 */
export function LightCosmicOrbitGalaxyBackground({
  animated = true,
  dimmed = false,
}: LightCosmicOrbitGalaxyBackgroundProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const mainModule = resolveMainModuleFromPath(pathname);
  const moduleAccent = resolveLcogModuleAccentRgba(mainModule, 0.16);
  const shouldAnimate = animated && !prefersReducedMotion;
  const { starCount } = resolveStarrySkyCount(width, lcogStarDust.length);

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
        testID="light-cosmic-orbit-galaxy-background"
      >
        <CosmicOrbitCanvas
          animate={shouldAnimate}
          starCount={starCount}
          moduleAccent={moduleAccent}
        />
        {dimmed ? <View style={styles.dimOverlay} pointerEvents="none" /> : null}
      </View>
    );
  }

  return (
    <View
      style={styles.root}
      pointerEvents="none"
      aria-hidden
      testID="light-cosmic-orbit-galaxy-background"
    >
      <LinearGradient colors={[...lcogBaseGradient]} style={StyleSheet.absoluteFillObject} />
      {dimmed ? <View style={styles.dimOverlay} pointerEvents="none" /> : null}
    </View>
  );
}

const webRootStyle =
  Platform.OS === 'web'
    ? ({
        position: 'fixed' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw' as const,
        height: '100vh' as const,
      } as const)
    : ({} as const);

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 0,
    backgroundColor: '#D4E4FF',
    ...webRootStyle,
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(247,250,255,0.28)',
  },
});
