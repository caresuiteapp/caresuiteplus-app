import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  LSOG_LAYER_IDS,
  lsogBaseGradient,
  lsogCanvasIntensity,
  lsogDeepStreaks,
  lsogNebulaFog,
  lsogOrbitArcs,
  lsogPlanets,
  lsogRedAccent,
  lsogRedEnergyPoints,
  lsogSmallBodies,
  lsogStarDust,
  type LsogDeepStreak,
  type LsogNebulaFog,
  type LsogOrbitArc,
  type LsogPlanet,
  type LsogRedEnergyPoint,
  type LsogSmallBody,
} from '@/design/tokens/lightSpaceOrbitGalaxy';
import { usePrefersReducedMotion } from '@/hooks/useprefersreducedmotion';
import {
  buildExtendedStarrySky,
  drawAnimatedStarrySky,
  resolveStarrySkyCount,
  type StarrySkyStar,
} from './lightStarrySkyCanvas';

export type LightSpaceOrbitGalaxyBackgroundProps = {
  animated?: boolean;
  dimmed?: boolean;
};

const BODY_BG_STYLE_ID = 'caresuite-lsog-body-bg';

type DustParticle = {
  nx: number;
  ny: number;
  size: number;
  speed: number;
  phase: number;
  driftX: number;
  driftY: number;
  opacity: number;
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
  return animate ? 0.5 + layerDepth * 0.5 : 1;
}

/** Edges stronger, center calmer for glass card readability. */
function edgeIntensity(x: number, y: number, w: number, h: number): number {
  const dx = (x - w * 0.5) / (w * 0.48);
  const dy = (y - h * 0.44) / (h * 0.48);
  const dist = Math.sqrt(dx * dx + dy * dy);
  return Math.min(1, Math.max(0.34, dist * 0.94 + 0.3));
}

function fogBlobLayout(fogId: string) {
  const seed = hashSeed(fogId);
  return Array.from({ length: 6 }, (_, i) => ({
    ox: Math.sin(seed * 0.019 + i * 2.07) * (0.2 + i * 0.07),
    oy: Math.cos(seed * 0.015 + i * 1.91) * (0.16 + i * 0.06),
    r: 0.36 + (i % 3) * 0.15 + (seed % 13) * 0.003,
    a: 0.4 + (i % 2) * 0.2,
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

function buildDustParticles(count: number, seedKey: string): DustParticle[] {
  const rand = seededRandom(hashSeed(seedKey));
  return Array.from({ length: count }, () => ({
    nx: rand(),
    ny: rand(),
    size: 0.5 + rand() * 1.6,
    speed: 0.05 + rand() * 0.09,
    phase: rand() * Math.PI * 2,
    driftX: 24 + rand() * 48,
    driftY: 18 + rand() * 36,
    opacity: 0.2 + rand() * 0.26,
  }));
}

/** L1 — Structured grey atmosphere with depth, not flat milk white. */
function drawBaseAtmosphere(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const diag = ctx.createLinearGradient(0, 0, w * 0.72, h);
  diag.addColorStop(0, '#A8AEB6');
  diag.addColorStop(0.28, '#B8BEC6');
  diag.addColorStop(0.52, '#C4CAD2');
  diag.addColorStop(0.78, '#B0B6BE');
  diag.addColorStop(1, '#9CA2AC');
  ctx.fillStyle = diag;
  ctx.fillRect(0, 0, w, h);

  const depth = ctx.createRadialGradient(w * 0.35, h * 0.28, 0, w * 0.35, h * 0.28, w * 0.85);
  depth.addColorStop(0, 'rgba(210,214,220,0.18)');
  depth.addColorStop(0.45, 'rgba(140,146,156,0.08)');
  depth.addColorStop(1, 'rgba(90,96,106,0.14)');
  ctx.fillStyle = depth;
  ctx.fillRect(0, 0, w, h);

  const lowerShadow = ctx.createLinearGradient(0, h * 0.55, 0, h);
  lowerShadow.addColorStop(0, 'transparent');
  lowerShadow.addColorStop(0.5, 'rgba(100,106,116,0.06)');
  lowerShadow.addColorStop(1, 'rgba(80,86,96,0.12)');
  ctx.fillStyle = lowerShadow;
  ctx.fillRect(0, 0, w, h);
}

function drawNebulaFog(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  fog: LsogNebulaFog,
  animate: boolean,
) {
  const ps = parallaxScale(fog.layerDepth, animate);
  const driftScale = animate ? ps : 0;
  const cx =
    fog.bx * w +
    driftScale *
      (Math.sin(t * fog.speed + fog.phase) * fog.driftX +
        Math.cos(t * fog.speed * 0.58 + fog.phase) * fog.driftX * 0.38);
  const cy =
    fog.by * h +
    driftScale *
      (Math.cos(t * fog.speed * 0.86 + fog.phase) * fog.driftY +
        Math.sin(t * fog.speed * 0.48 + fog.phase * 1.15) * fog.driftY * 0.42);
  const breathe = animate ? 1 + fog.breathe * Math.sin(t * fog.speed * 1.2 + fog.phase) : 1;
  const baseRx = fog.radiusX * w * breathe;
  const baseRy = fog.radiusY * h * breathe;
  const edge = edgeIntensity(cx, cy, w, h);
  const opacity =
    fog.baseOpacity * lsogCanvasIntensity.nebulaFogOpacity * edge +
    (animate ? Math.sin(t * fog.speed * 0.8 + fog.phase) * 0.06 : 0);

  const blobs = fogBlobLayout(fog.id);
  ctx.save();
  ctx.filter = 'blur(48px)';

  for (const blob of blobs) {
    const bx = cx + blob.ox * baseRx;
    const by = cy + blob.oy * baseRy;
    const r = Math.max(baseRx, baseRy) * blob.r;
    const alpha = Math.max(0.28, Math.min(0.9, opacity * blob.a));

    ctx.globalAlpha = alpha;
    const radial = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    radial.addColorStop(0, fog.inner);
    radial.addColorStop(0.38, fog.mid);
    radial.addColorStop(0.72, fog.outer);
    radial.addColorStop(1, 'transparent');
    ctx.fillStyle = radial;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.filter = 'none';
  ctx.restore();
}

function drawDeepStreak(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  streak: LsogDeepStreak,
  animate: boolean,
) {
  const ps = parallaxScale(streak.layerDepth, animate);
  const cx =
    streak.bx * w + (animate ? ps * Math.sin(t * streak.speed + streak.phase) * streak.driftX : 0);
  const cy =
    streak.by * h + (animate ? ps * Math.cos(t * streak.speed * 0.9 + streak.phase) * streak.driftY : 0);
  const len = streak.length * w * 0.5;
  const angle = streak.angle + (animate ? Math.sin(t * streak.speed * 0.5 + streak.phase) * 0.06 : 0);
  const curve = 0.38 + Math.sin(streak.phase * 1.4) * 0.12;

  const dx = Math.cos(angle) * len;
  const dy = Math.sin(angle) * len;
  const px = -Math.sin(angle) * len * curve;
  const py = Math.cos(angle) * len * curve;

  const x0 = cx - dx;
  const y0 = cy - dy;
  const x1 = cx - dx * 0.32 + px;
  const y1 = cy - dy * 0.32 + py;
  const x2 = cx + dx * 0.32 + px * 0.5;
  const y2 = cy + dy * 0.32 + py * 0.5;
  const x3 = cx + dx;
  const y3 = cy + dy;

  const edge = edgeIntensity(cx, cy, w, h);
  const steps = 16;

  ctx.save();
  ctx.filter = 'blur(22px)';

  for (let i = 0; i <= steps; i += 1) {
    const s = i / steps;
    const p = cubicBezierPoint(s, x0, y0, x1, y1, x2, y2, x3, y3);
    const fade = Math.sin(s * Math.PI);
    const r = streak.thickness * h * (0.52 + fade * 1.35);
    const alpha = Math.min(0.72, fade * 0.55 * lsogCanvasIntensity.streakOpacity * edge);

    ctx.globalAlpha = alpha;
    const radial = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    radial.addColorStop(0, streak.color);
    radial.addColorStop(0.5, streak.color.replace(/[\d.]+\)$/, '0.12)'));
    radial.addColorStop(1, 'transparent');
    ctx.fillStyle = radial;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.filter = 'none';
  ctx.restore();
}

function drawPlanetSurface(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  planet: LsogPlanet,
  seed: number,
) {
  const lightX = cx - r * 0.38;
  const lightY = cy - r * 0.42;

  const sphere = ctx.createRadialGradient(lightX, lightY, r * 0.08, cx, cy, r * 1.05);
  sphere.addColorStop(0, 'rgba(220,224,228,0.95)');
  sphere.addColorStop(0.35, 'rgba(175,180,188,0.88)');
  sphere.addColorStop(0.68, 'rgba(120,126,136,0.82)');
  sphere.addColorStop(0.88, 'rgba(85,90,98,0.78)');
  sphere.addColorStop(1, 'rgba(60,64,72,0.72)');
  ctx.fillStyle = sphere;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  const rand = seededRandom(seed);
  const craterCount = Math.floor(8 + planet.craterDensity * 14);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  for (let i = 0; i < craterCount; i += 1) {
    const angle = rand() * Math.PI * 2;
    const dist = rand() * r * 0.82;
    const cr = cx + Math.cos(angle) * dist;
    const ccy = cy + Math.sin(angle) * dist;
    const crR = r * (0.04 + rand() * 0.08);
    const crater = ctx.createRadialGradient(cr, ccy, 0, cr, ccy, crR);
    crater.addColorStop(0, 'rgba(70,74,82,0.55)');
    crater.addColorStop(0.6, 'rgba(100,106,114,0.22)');
    crater.addColorStop(1, 'transparent');
    ctx.fillStyle = crater;
    ctx.beginPath();
    ctx.arc(cr, ccy, crR, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  const rim = ctx.createRadialGradient(cx + r * 0.2, cy + r * 0.15, r * 0.7, cx, cy, r);
  rim.addColorStop(0, 'transparent');
  rim.addColorStop(0.82, 'rgba(40,44,52,0.12)');
  rim.addColorStop(1, 'rgba(30,34,40,0.28)');
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlanetRedCracks(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  planet: LsogPlanet,
  t: number,
  animate: boolean,
) {
  if (planet.redEnergy < 0.2) return;

  const pulse = animate ? 0.72 + 0.28 * Math.sin(t * 1.55 + planet.phase) : 0.85;
  const originX = cx - r * 0.35;
  const originY = cy - r * 0.05;

  const cracks = [
    { a: 0.15, len: 0.55, curve: 0.22 },
    { a: 0.45, len: 0.42, curve: -0.18 },
    { a: -0.25, len: 0.38, curve: 0.15 },
    { a: 0.72, len: 0.3, curve: -0.12 },
  ];

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  for (const crack of cracks) {
    const ex = originX + Math.cos(crack.a) * r * crack.len;
    const ey = originY + Math.sin(crack.a) * r * crack.len;
    const mx = (originX + ex) * 0.5 + crack.curve * r;
    const my = (originY + ey) * 0.5 + crack.curve * r * 0.6;

    ctx.globalAlpha = planet.redEnergy * pulse * 0.75;
    ctx.strokeStyle = lsogRedAccent.crack;
    ctx.lineWidth = 1.4 + planet.redEnergy * 0.8;
    ctx.lineCap = 'round';
    ctx.shadowColor = lsogRedAccent.glow;
    ctx.shadowBlur = 8 * planet.redEnergy * pulse;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    ctx.stroke();
  }

  const coreGlow = ctx.createRadialGradient(originX, originY, 0, originX, originY, r * 0.28);
  coreGlow.addColorStop(0, lsogRedAccent.core.replace(/[\d.]+\)$/, `${(0.55 * planet.redEnergy * pulse).toFixed(3)})`));
  coreGlow.addColorStop(0.45, lsogRedAccent.glow.replace(/[\d.]+\)$/, `${(0.28 * planet.redEnergy).toFixed(3)})`));
  coreGlow.addColorStop(1, 'transparent');
  ctx.shadowBlur = 0;
  ctx.globalAlpha = planet.redEnergy * pulse * 0.65;
  ctx.fillStyle = coreGlow;
  ctx.beginPath();
  ctx.arc(originX, originY, r * 0.28, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPlanet(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  planet: LsogPlanet,
  animate: boolean,
) {
  const ps = parallaxScale(planet.layerDepth, animate);
  const minDim = Math.min(w, h);
  const r = planet.radius * minDim;
  const fx = animate ? Math.sin(t * planet.floatSpeed + planet.phase) * planet.floatX * ps : 0;
  const fy = animate ? Math.cos(t * planet.floatSpeed * 0.88 + planet.phase) * planet.floatY * ps : 0;
  const cx = planet.cx * w + fx;
  const cy = planet.cy * h + fy;
  const edge = edgeIntensity(cx, cy, w, h);

  ctx.save();
  ctx.globalAlpha = lsogCanvasIntensity.planetOpacity * edge;

  const halo = ctx.createRadialGradient(cx, cy, r * 0.85, cx, cy, r * 1.35);
  halo.addColorStop(0, 'rgba(160,166,174,0.08)');
  halo.addColorStop(0.6, 'rgba(120,126,134,0.04)');
  halo.addColorStop(1, 'transparent');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.35, 0, Math.PI * 2);
  ctx.fill();

  drawPlanetSurface(ctx, cx, cy, r, planet, hashSeed(planet.id));
  drawPlanetRedCracks(ctx, cx, cy, r, planet, t, animate);

  ctx.restore();
}

function drawSmallBody(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  body: LsogSmallBody,
  animate: boolean,
) {
  const ps = parallaxScale(body.layerDepth, animate);
  const minDim = Math.min(w, h);
  const r = body.radius * minDim;
  const dx = animate ? Math.sin(t * body.speed + body.phase) * body.driftX * ps : 0;
  const dy = animate ? Math.cos(t * body.speed * 0.9 + body.phase) * body.driftY * ps : 0;
  const cx = body.cx * w + dx;
  const cy = body.cy * h + dy;

  ctx.save();
  ctx.globalAlpha = body.opacity * edgeIntensity(cx, cy, w, h);

  const sphere = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, 0, cx, cy, r);
  sphere.addColorStop(0, 'rgba(200,206,212,0.82)');
  sphere.addColorStop(0.55, 'rgba(140,146,154,0.68)');
  sphere.addColorStop(1, 'rgba(80,86,94,0.55)');
  ctx.fillStyle = sphere;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawDustParticles(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  particles: readonly DustParticle[],
  animate: boolean,
) {
  for (const p of particles) {
    const px = animate
      ? p.nx * w + Math.sin(t * p.speed + p.phase) * p.driftX
      : p.nx * w;
    const py = animate
      ? p.ny * h + Math.cos(t * p.speed * 0.86 + p.phase) * p.driftY
      : p.ny * h;
    const edge = edgeIntensity(px, py, w, h);
    const twinkle = animate ? 0.5 + 0.5 * Math.sin(t * p.speed * 1.5 + p.phase) : 0.72;
    const alpha = p.opacity * lsogCanvasIntensity.particleOpacity * edge * twinkle;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(220,224,230,0.82)';
    ctx.beginPath();
    ctx.arc(px, py, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawRedEnergyPoint(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  point: LsogRedEnergyPoint,
  animate: boolean,
) {
  const ps = parallaxScale(point.layerDepth, animate);
  let cx = point.cx * w;
  let cy = point.cy * h;

  if (animate && point.kind === 'orbital') {
    const orbitR = 18 * ps;
    cx += Math.cos(t * 0.12 + point.phase) * orbitR;
    cy += Math.sin(t * 0.1 + point.phase) * orbitR * 0.6;
  } else if (animate && point.kind === 'drift') {
    cx += Math.sin(t * 0.08 + point.phase) * 14 * ps;
    cy += Math.cos(t * 0.07 + point.phase) * 10 * ps;
  }

  const pulse = animate ? 0.55 + 0.45 * Math.sin(t * point.pulseSpeed + point.phase) : 0.75;
  const edge = edgeIntensity(cx, cy, w, h);
  const r = point.radius * (0.85 + pulse * 0.35);

  ctx.save();
  ctx.globalAlpha = lsogCanvasIntensity.redPulseOpacity * edge * pulse;

  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 4.5);
  glow.addColorStop(0, lsogRedAccent.marker.replace(/[\d.]+\)$/, `${(0.85 * pulse).toFixed(3)})`));
  glow.addColorStop(0.35, lsogRedAccent.glow.replace(/[\d.]+\)$/, `${(0.42 * pulse).toFixed(3)})`));
  glow.addColorStop(0.7, lsogRedAccent.soft.replace(/[\d.]+\)$/, `${(0.12 * pulse).toFixed(3)})`));
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = lsogRedAccent.marker;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawOrbitArc(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  arc: LsogOrbitArc,
  animate: boolean,
) {
  const minDim = Math.min(w, h);
  const cx = arc.cx * w;
  const cy = arc.cy * h;
  const rx = arc.rx * minDim;
  const ry = arc.ry * minDim;
  const rot = arc.rotation + (animate ? t * arc.speed : 0);
  const edge = edgeIntensity(cx, cy, w, h);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.globalAlpha = arc.opacity * lsogCanvasIntensity.orbitOpacity * edge;
  ctx.strokeStyle = arc.stroke;
  ctx.lineWidth = arc.lineWidth;

  if (arc.dash) {
    ctx.setLineDash(arc.dash);
  }

  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** L9 — Subtle center calm zone, not a milky white kill filter. */
function drawReadabilityVeil(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const veil = lsogCanvasIntensity.centerVeilAlpha;
  const center = ctx.createRadialGradient(w * 0.5, h * 0.44, 0, w * 0.5, h * 0.44, w * 0.48);
  center.addColorStop(0, `rgba(196,200,206,${(veil * 1.2).toFixed(3)})`);
  center.addColorStop(0.42, `rgba(188,192,198,${(veil * 0.45).toFixed(3)})`);
  center.addColorStop(0.72, 'rgba(180,184,190,0.008)');
  center.addColorStop(1, 'rgba(180,184,190,0)');
  ctx.fillStyle = center;
  ctx.fillRect(0, 0, w, h);
}

function drawEdgeVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const v = ctx.createRadialGradient(w * 0.5, h * 0.46, w * 0.26, w * 0.5, h * 0.46, w * 0.84);
  v.addColorStop(0, 'transparent');
  v.addColorStop(0.7, 'rgba(90,96,106,0.04)');
  v.addColorStop(1, 'rgba(70,76,86,0.11)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

function SpaceOrbitCanvas({
  animate,
  starCount,
}: {
  animate: boolean;
  starCount: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef(Date.now());
  const pausedRef = useRef(false);
  const particlesRef = useRef<DustParticle[]>([]);
  const starsRef = useRef<StarrySkyStar[]>([]);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    particlesRef.current = buildDustParticles(52, 'lsog-dust');
    pausedRef.current = false;

    const rebuildStars = (viewportWidth: number) => {
      const { starCount: resolvedStarCount, extraCount } = resolveStarrySkyCount(
        viewportWidth,
        lsogStarDust.length,
      );
      starsRef.current = buildExtendedStarrySky(
        lsogStarDust.slice(0, resolvedStarCount),
        extraCount,
        'lsog-stars',
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

      drawBaseAtmosphere(ctx, w, h);

      for (const fog of lsogNebulaFog) {
        drawNebulaFog(ctx, w, h, t, fog, animate);
      }

      for (const streak of lsogDeepStreaks) {
        drawDeepStreak(ctx, w, h, t, streak, animate);
      }

      for (const body of lsogSmallBodies) {
        drawSmallBody(ctx, w, h, t, body, animate);
      }

      for (const planet of lsogPlanets) {
        drawPlanet(ctx, w, h, t, planet, animate);
      }

      drawAnimatedStarrySky(ctx, w, h, t, starsRef.current, {
        animate,
        starOpacity: lsogCanvasIntensity.starOpacity,
        palette: 'pearl',
        parallaxScale,
      });

      drawDustParticles(ctx, w, h, t, particlesRef.current, animate);

      for (const arc of lsogOrbitArcs) {
        drawOrbitArc(ctx, w, h, t, arc, animate);
      }

      for (const point of lsogRedEnergyPoints) {
        drawRedEnergyPoint(ctx, w, h, t, point, animate);
      }

      drawReadabilityVeil(ctx, w, h);
      drawEdgeVignette(ctx, w, h);

      frame += 1;
      if (frame % 120 === 0) {
        const snap = lsogNebulaFog
          .map((f) => {
            const ps = parallaxScale(f.layerDepth, animate);
            const cx = f.bx * w + ps * Math.sin(t * f.speed + f.phase) * f.driftX;
            const cy = f.by * h + ps * Math.cos(t * f.speed * 0.86 + f.phase) * f.driftY;
            return `${f.id}:${Math.round(cx)},${Math.round(cy)}`;
          })
          .join('|');
        canvas.dataset.lsogSnapshot = snap;
        canvas.dataset.lsogLayers = LSOG_LAYER_IDS.join(',');
        canvas.dataset.lsogTime = t.toFixed(2);
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
  }, [animate, starCount]);

  if (Platform.OS !== 'web') return null;

  return (
    <canvas
      ref={canvasRef}
      data-testid="lsog-space-orbit-canvas"
      data-layers={LSOG_LAYER_IDS.join(',')}
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
 * Light Space Orbit Galaxy — monochrome grey space with red energy accents.
 * Nine visual layers inspired by reference (not a 1:1 wallpaper copy).
 */
export function LightSpaceOrbitGalaxyBackground({
  animated = true,
  dimmed = false,
}: LightSpaceOrbitGalaxyBackgroundProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { width } = useWindowDimensions();
  const shouldAnimate = animated && !prefersReducedMotion;
  const { starCount } = resolveStarrySkyCount(width, lsogStarDust.length);

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
        testID="light-space-orbit-galaxy-background"
      >
        <SpaceOrbitCanvas animate={shouldAnimate} starCount={starCount} />
        {dimmed ? <View style={styles.dimOverlay} pointerEvents="none" /> : null}
      </View>
    );
  }

  return (
    <View
      style={styles.root}
      pointerEvents="none"
      aria-hidden
      testID="light-space-orbit-galaxy-background"
    >
      <LinearGradient colors={[...lsogBaseGradient]} style={StyleSheet.absoluteFillObject} />
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
    backgroundColor: '#B4BAC2',
    ...webRootStyle,
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(196,200,206,0.24)',
  },
});
