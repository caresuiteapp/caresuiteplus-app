import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View, type ViewStyle, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  LGON_LAYER_IDS,
  lgoonBaseGradient,
  lgoonCanvasIntensity,
  lgoonDeepStreaks,
  lgoonFarNebulaBlobs,
  lgoonMainPlanet,
  lgoonOrbitArcs,
  lgoonRedAccent,
  lgoonRedEnergyPoints,
  lgoonSecondaryPlanets,
  lgoonSmallBodies,
  lgoonStarDust,
  type LgoonDeepStreak,
  type LgoonNebulaBlob,
  type LgoonOrbitArc,
  type LgoonPlanet,
  type LgoonRedEnergyPoint,
  type LgoonSmallBody,
  type LgoonStarSeed,
} from '@/design/tokens/lightGalaxyOrbitNebula';
import { usePrefersReducedMotion } from '@/hooks/useprefersreducedmotion';

export type LightGalaxyOrbitNebulaBackgroundProps = {
  animated?: boolean;
  dimmed?: boolean;
};

const BODY_BG_STYLE_ID = 'caresuite-lgon-body-bg';
const BREATHE_STYLE_ID = 'caresuite-lgon-breathe-keyframes';

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

const layerCanvasStyle = {
  position: 'absolute' as const,
  inset: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none' as const,
};

function ensureWebStyles() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (!document.getElementById(BODY_BG_STYLE_ID)) {
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
  if (!document.getElementById(BREATHE_STYLE_ID)) {
    const tag = document.createElement('style');
    tag.id = BREATHE_STYLE_ID;
    tag.textContent = `
      @keyframes lgon-atmosphere-breathe {
        0%, 100% { opacity: 1; filter: brightness(1); }
        50% { opacity: 0.94; filter: brightness(1.04); }
      }
      [data-testid="lgoon-layer-a-base-atmosphere"] {
        animation: lgon-atmosphere-breathe 14s ease-in-out infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        [data-testid="lgoon-layer-a-base-atmosphere"] {
          animation: none !important;
        }
      }
    `;
    document.head.appendChild(tag);
  }
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

function edgeIntensity(x: number, y: number, w: number, h: number): number {
  const dx = (x - w * 0.5) / (w * 0.48);
  const dy = (y - h * 0.44) / (h * 0.48);
  const dist = Math.sqrt(dx * dx + dy * dy);
  return Math.min(1, Math.max(0.34, dist * 0.94 + 0.3));
}

/** Layer B — Lissajous + slow flow (independent from planet motion). */
function nebulaBlobPosition(blob: LgoonNebulaBlob, w: number, h: number, t: number, animate: boolean) {
  const baseX = blob.bx * w;
  const baseY = blob.by * h;
  if (!animate) return { x: baseX, y: baseY, breathe: 1 };
  const lx =
    Math.sin(t * blob.freqX + blob.phase) * blob.ampX +
    Math.cos(t * blob.freqY * 1.37 + blob.phase * 0.7) * blob.ampX * 0.42;
  const ly =
    Math.cos(t * blob.freqY + blob.phase) * blob.ampY +
    Math.sin(t * blob.freqX * 0.83 + blob.phase * 1.2) * blob.ampY * 0.38;
  const flowX = blob.flowVx * t;
  const flowY = blob.flowVy * t;
  const breathe = 1 + blob.breathe * Math.sin(t * blob.freqX * 1.2 + blob.phase);
  return { x: baseX + lx + flowX, y: baseY + ly + flowY, breathe };
}

/** Layer C — Flow-field drift (different vector family from B). */
function streakPosition(streak: LgoonDeepStreak, w: number, h: number, t: number, animate: boolean) {
  const baseX = streak.bx * w;
  const baseY = streak.by * h;
  if (!animate) return { x: baseX, y: baseY, angle: streak.angle };
  const ox =
    Math.sin(t * streak.freqA + streak.phase) * streak.ampX +
    Math.sin(t * streak.freqB * 2.1 + streak.phase * 0.5) * streak.ampX * 0.35;
  const oy =
    Math.cos(t * streak.freqB + streak.phase) * streak.ampY +
    Math.cos(t * streak.freqA * 1.6 + streak.phase * 0.8) * streak.ampY * 0.4;
  const fx = Math.cos(streak.flowAngle) * streak.flowSpeed * t;
  const fy = Math.sin(streak.flowAngle) * streak.flowSpeed * t;
  const angle = streak.angle + Math.sin(t * streak.freqA * 0.5 + streak.phase) * 0.08;
  return { x: baseX + ox + fx, y: baseY + oy + fy, angle };
}

/** Layer D/E — Figure-8 float (decoupled from nebula). */
function planetPosition(planet: LgoonPlanet, w: number, h: number, t: number, animate: boolean) {
  const baseX = planet.cx * w;
  const baseY = planet.cy * h;
  if (!animate) return { x: baseX, y: baseY, lightShift: 0 };
  const fx =
    Math.sin(t * planet.floatFreqX + planet.phase) * planet.floatAmpX +
    Math.sin(t * planet.floatFreqX * 2 + planet.phase * 1.3) * planet.floatAmpX * 0.25;
  const fy =
    Math.cos(t * planet.floatFreqY + planet.phase) * planet.floatAmpY +
    Math.cos(t * planet.floatFreqY * 1.7 + planet.phase * 0.9) * planet.floatAmpY * 0.3;
  const lightShift = Math.sin(t * planet.lightShiftSpeed + planet.phase) * 0.06;
  return { x: baseX + fx, y: baseY + fy, lightShift };
}

function smallBodyPosition(body: LgoonSmallBody, w: number, h: number, t: number, animate: boolean) {
  const baseX = body.cx * w;
  const baseY = body.cy * h;
  if (!animate) return { x: baseX, y: baseY };
  return {
    x: baseX + Math.sin(t * body.freqX + body.phase) * body.ampX,
    y: baseY + Math.cos(t * body.freqY + body.phase) * body.ampY,
  };
}

function redPointPosition(point: LgoonRedEnergyPoint, w: number, h: number, t: number, animate: boolean) {
  let x = point.cx * w;
  let y = point.cy * h;
  if (animate && point.kind === 'orbital') {
    x += Math.cos(t * point.orbitSpeed + point.phase) * point.orbitRadius;
    y += Math.sin(t * point.orbitSpeed * 0.85 + point.phase) * point.orbitRadius * 0.65;
  } else if (animate && point.kind === 'drift') {
    x += Math.sin(t * 0.08 + point.phase) * point.orbitRadius;
    y += Math.cos(t * 0.07 + point.phase) * point.orbitRadius * 0.75;
  }
  return { x, y };
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

function fogBlobLayout(fogId: string) {
  const seed = hashSeed(fogId);
  return Array.from({ length: 6 }, (_, i) => ({
    ox: Math.sin(seed * 0.019 + i * 2.07) * (0.2 + i * 0.07),
    oy: Math.cos(seed * 0.015 + i * 1.91) * (0.16 + i * 0.06),
    r: 0.36 + (i % 3) * 0.15 + (seed % 13) * 0.003,
    a: 0.4 + (i % 2) * 0.2,
  }));
}

function drawPlanetSurface(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  planet: LgoonPlanet,
  lightShift: number,
) {
  const lightX = cx - r * (0.38 + lightShift);
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

  const rand = seededRandom(hashSeed(planet.id));
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
  planet: LgoonPlanet,
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
    ctx.strokeStyle = lgoonRedAccent.crack;
    ctx.lineWidth = 1.4 + planet.redEnergy * 0.8;
    ctx.lineCap = 'round';
    ctx.shadowColor = lgoonRedAccent.glow;
    ctx.shadowBlur = 8 * planet.redEnergy * pulse;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    ctx.stroke();
  }
  ctx.restore();
}

function useIndependentCanvasLoop(
  animate: boolean,
  layerId: string,
  drawFrame: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef(Date.now());
  const pausedRef = useRef(false);
  const drawRef = useRef(drawFrame);
  drawRef.current = drawFrame;

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    pausedRef.current = false;
    startRef.current = Date.now();

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(parent.clientWidth * dpr);
      canvas.height = Math.floor(parent.clientHeight * dpr);
      canvas.style.width = `${parent.clientWidth}px`;
      canvas.style.height = `${parent.clientHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onVisibility = () => {
      pausedRef.current = document.hidden;
      if (!document.hidden && frameRef.current === null) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);

    const tick = () => {
      frameRef.current = null;
      if (pausedRef.current) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const t = (Date.now() - startRef.current) / 1000;
      ctx.clearRect(0, 0, w, h);
      drawRef.current(ctx, w, h, t);
      canvas.dataset.lgonLayer = layerId;
      canvas.dataset.lgonTime = t.toFixed(2);
      frameRef.current = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [animate, layerId]);

  return canvasRef;
}

function LayerCanvas({
  testId,
  layerId,
  animate,
  drawFrame,
}: {
  testId: string;
  layerId: string;
  animate: boolean;
  drawFrame: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void;
}) {
  const canvasRef = useIndependentCanvasLoop(animate, layerId, drawFrame);
  if (Platform.OS !== 'web') return null;
  return (
    <canvas
      ref={canvasRef}
      data-testid={testId}
      data-layer={layerId}
      style={layerCanvasStyle}
      aria-hidden={true}
    />
  );
}

function FarNebulaLayer({ animate }: { animate: boolean }) {
  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    for (const blob of lgoonFarNebulaBlobs) {
      const { x, y, breathe } = nebulaBlobPosition(blob, w, h, t, animate);
      const baseRx = blob.radiusX * w * breathe;
      const baseRy = blob.radiusY * h * breathe;
      const edge = edgeIntensity(x, y, w, h);
      const opacity =
        blob.baseOpacity * lgoonCanvasIntensity.nebulaFogOpacity * edge +
        (animate ? Math.sin(t * blob.freqX * 0.8 + blob.phase) * 0.06 : 0);
      const blobs = fogBlobLayout(blob.id);
      ctx.save();
      ctx.filter = 'blur(48px)';
      for (const b of blobs) {
        const bx = x + b.ox * baseRx;
        const by = y + b.oy * baseRy;
        const r = Math.max(baseRx, baseRy) * b.r;
        ctx.globalAlpha = Math.max(0.28, Math.min(0.9, opacity * b.a));
        const radial = ctx.createRadialGradient(bx, by, 0, bx, by, r);
        radial.addColorStop(0, blob.inner);
        radial.addColorStop(0.38, blob.mid);
        radial.addColorStop(0.72, blob.outer);
        radial.addColorStop(1, 'transparent');
        ctx.fillStyle = radial;
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.filter = 'none';
      ctx.restore();
    }
  };
  return (
    <LayerCanvas
      testId="lgoon-layer-b-far-nebula"
      layerId="layer-b-far-nebula"
      animate={animate}
      drawFrame={draw}
    />
  );
}

function DeepNebulaLayer({ animate }: { animate: boolean }) {
  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    for (const streak of lgoonDeepStreaks) {
      const { x, y, angle } = streakPosition(streak, w, h, t, animate);
      const len = streak.length * w * 0.5;
      const dx = Math.cos(angle) * len;
      const dy = Math.sin(angle) * len;
      const curve = 0.38 + Math.sin(streak.phase * 1.4) * 0.12;
      const px = -Math.sin(angle) * len * curve;
      const py = Math.cos(angle) * len * curve;
      const x0 = x - dx;
      const y0 = y - dy;
      const x1 = x - dx * 0.32 + px;
      const y1 = y - dy * 0.32 + py;
      const x2 = x + dx * 0.32 + px * 0.5;
      const y2 = y + dy * 0.32 + py * 0.5;
      const x3 = x + dx;
      const y3 = y + dy;
      const edge = edgeIntensity(x, y, w, h);
      ctx.save();
      ctx.filter = 'blur(22px)';
      for (let i = 0; i <= 16; i += 1) {
        const s = i / 16;
        const p = cubicBezierPoint(s, x0, y0, x1, y1, x2, y2, x3, y3);
        const fade = Math.sin(s * Math.PI);
        const r = streak.thickness * h * (0.52 + fade * 1.35);
        ctx.globalAlpha = Math.min(0.72, fade * 0.55 * lgoonCanvasIntensity.streakOpacity * edge);
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
  };
  return (
    <LayerCanvas
      testId="lgoon-layer-c-deep-nebula"
      layerId="layer-c-deep-nebula"
      animate={animate}
      drawFrame={draw}
    />
  );
}

function MainPlanetLayer({ animate }: { animate: boolean }) {
  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    const planet = lgoonMainPlanet;
    const { x, y, lightShift } = planetPosition(planet, w, h, t, animate);
    const minDim = Math.min(w, h);
    const r = planet.radius * minDim;
    const edge = edgeIntensity(x, y, w, h);
    ctx.save();
    ctx.globalAlpha = lgoonCanvasIntensity.planetOpacity * edge;
    const halo = ctx.createRadialGradient(x, y, r * 0.85, x, y, r * 1.35);
    halo.addColorStop(0, 'rgba(160,166,174,0.08)');
    halo.addColorStop(0.6, 'rgba(120,126,134,0.04)');
    halo.addColorStop(1, 'transparent');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.35, 0, Math.PI * 2);
    ctx.fill();
    drawPlanetSurface(ctx, x, y, r, planet, lightShift);
    drawPlanetRedCracks(ctx, x, y, r, planet, t, animate);
    ctx.restore();
  };
  return (
    <LayerCanvas
      testId="lgoon-layer-d-main-planet"
      layerId="layer-d-main-planet"
      animate={animate}
      drawFrame={draw}
    />
  );
}

function SecondaryPlanetsLayer({ animate }: { animate: boolean }) {
  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    for (const planet of lgoonSecondaryPlanets) {
      const { x, y, lightShift } = planetPosition(planet, w, h, t, animate);
      const minDim = Math.min(w, h);
      const r = planet.radius * minDim;
      const edge = edgeIntensity(x, y, w, h);
      ctx.save();
      ctx.globalAlpha = lgoonCanvasIntensity.planetOpacity * edge;
      drawPlanetSurface(ctx, x, y, r, planet, lightShift);
      drawPlanetRedCracks(ctx, x, y, r, planet, t, animate);
      ctx.restore();
    }
  };
  return (
    <LayerCanvas
      testId="lgoon-layer-e-secondary-planets"
      layerId="layer-e-secondary-planets"
      animate={animate}
      drawFrame={draw}
    />
  );
}

function SmallBodiesLayer({ animate }: { animate: boolean }) {
  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    for (const body of lgoonSmallBodies) {
      const { x, y } = smallBodyPosition(body, w, h, t, animate);
      const minDim = Math.min(w, h);
      const r = body.radius * minDim;
      ctx.save();
      ctx.globalAlpha = body.opacity * edgeIntensity(x, y, w, h);
      const sphere = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 0, x, y, r);
      sphere.addColorStop(0, 'rgba(200,206,212,0.82)');
      sphere.addColorStop(0.55, 'rgba(140,146,154,0.68)');
      sphere.addColorStop(1, 'rgba(80,86,94,0.55)');
      ctx.fillStyle = sphere;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };
  return (
    <LayerCanvas
      testId="lgoon-layer-f-small-bodies"
      layerId="layer-f-small-bodies"
      animate={animate}
      drawFrame={draw}
    />
  );
}

function RedEnergyLayer({ animate }: { animate: boolean }) {
  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    for (const point of lgoonRedEnergyPoints) {
      const { x, y } = redPointPosition(point, w, h, t, animate);
      const pulse = animate ? 0.55 + 0.45 * Math.sin(t * point.pulseSpeed + point.phase) : 0.75;
      const edge = edgeIntensity(x, y, w, h);
      const r = point.radius * (0.85 + pulse * 0.35);
      ctx.save();
      ctx.globalAlpha = lgoonCanvasIntensity.redPulseOpacity * edge * pulse;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4.5);
      glow.addColorStop(0, lgoonRedAccent.marker.replace(/[\d.]+\)$/, `${(0.85 * pulse).toFixed(3)})`));
      glow.addColorStop(0.35, lgoonRedAccent.glow.replace(/[\d.]+\)$/, `${(0.42 * pulse).toFixed(3)})`));
      glow.addColorStop(0.7, lgoonRedAccent.soft.replace(/[\d.]+\)$/, `${(0.12 * pulse).toFixed(3)})`));
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, r * 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = lgoonRedAccent.marker;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };
  return (
    <LayerCanvas
      testId="lgoon-layer-g-red-energy"
      layerId="layer-g-red-energy"
      animate={animate}
      drawFrame={draw}
    />
  );
}

function StarDustLayer({ animate, starCount }: { animate: boolean; starCount: number }) {
  const particlesRef = useRef<DustParticle[]>([]);
  const starsRef = useRef<LgoonStarSeed[]>([]);

  useEffect(() => {
    particlesRef.current = Array.from({ length: 48 }, (_, i) => {
      const rand = seededRandom(hashSeed(`lgoon-dust-${i}`));
      return {
        nx: rand(),
        ny: rand(),
        size: 0.5 + rand() * 1.6,
        speed: 0.05 + rand() * 0.09,
        phase: rand() * Math.PI * 2,
        driftX: 24 + rand() * 48,
        driftY: 18 + rand() * 36,
        opacity: 0.2 + rand() * 0.26,
      };
    });
    starsRef.current = [...lgoonStarDust];
    if (starCount > lgoonStarDust.length) {
      const rand = seededRandom(hashSeed('lgoon-extra-stars'));
      for (let i = lgoonStarDust.length; i < starCount; i += 1) {
        starsRef.current.push({
          nx: rand(),
          ny: rand(),
          radius: 0.4 + rand() * 0.85,
          baseOpacity: 0.26 + rand() * 0.24,
          twinkleSpeed: 0.035 + rand() * 0.09,
          glowRadius: 2 + rand() * 4.2,
          phase: rand() * Math.PI * 2,
          driftX: 8 + rand() * 18,
          driftY: 6 + rand() * 14,
          driftSpeed: 0.04 + rand() * 0.05,
        });
      }
    }
  }, [starCount]);

  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    for (const star of starsRef.current) {
      const px = animate
        ? star.nx * w + Math.sin(t * star.driftSpeed + star.phase) * star.driftX
        : star.nx * w;
      const py = animate
        ? star.ny * h + Math.cos(t * star.driftSpeed * 0.86 + star.phase) * star.driftY
        : star.ny * h;
      const twinkle = animate ? 0.5 + 0.5 * Math.sin(t * star.twinkleSpeed + star.phase) : 0.72;
      const alpha = star.baseOpacity * lgoonCanvasIntensity.starOpacity * edgeIntensity(px, py, w, h) * twinkle;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(220,224,230,0.82)';
      ctx.beginPath();
      ctx.arc(px, py, star.radius, 0, Math.PI * 2);
      ctx.fill();
      if (star.glowRadius > 3) {
        const glow = ctx.createRadialGradient(px, py, 0, px, py, star.glowRadius);
        glow.addColorStop(0, 'rgba(220,224,230,0.35)');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, star.glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    for (const p of particlesRef.current) {
      const px = animate ? p.nx * w + Math.sin(t * p.speed + p.phase) * p.driftX : p.nx * w;
      const py = animate ? p.ny * h + Math.cos(t * p.speed * 0.86 + p.phase) * p.driftY : p.ny * h;
      const twinkle = animate ? 0.5 + 0.5 * Math.sin(t * p.speed * 1.5 + p.phase) : 0.72;
      ctx.save();
      ctx.globalAlpha = p.opacity * lgoonCanvasIntensity.particleOpacity * edgeIntensity(px, py, w, h) * twinkle;
      ctx.fillStyle = 'rgba(220,224,230,0.82)';
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  return (
    <LayerCanvas
      testId="lgoon-layer-h-star-dust"
      layerId="layer-h-star-dust"
      animate={animate}
      drawFrame={draw}
    />
  );
}

function OrbitArcsLayer({ animate }: { animate: boolean }) {
  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    for (const arc of lgoonOrbitArcs) {
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
      ctx.globalAlpha = arc.opacity * lgoonCanvasIntensity.orbitOpacity * edge;
      ctx.strokeStyle = arc.stroke;
      ctx.lineWidth = arc.lineWidth;
      if (arc.dash) ctx.setLineDash(arc.dash);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  };
  return (
    <LayerCanvas
      testId="lgoon-layer-i-orbit-arcs"
      layerId="layer-i-orbit-arcs"
      animate={animate}
      drawFrame={draw}
    />
  );
}

function LayerABaseAtmosphere() {
  if (Platform.OS === 'web') {
    return (
      <View
        data-testid="lgoon-layer-a-base-atmosphere"
        style={styles.layerA}
        pointerEvents="none"
        aria-hidden={true}
      />
    );
  }
  return (
    <LinearGradient colors={[...lgoonBaseGradient]} style={StyleSheet.absoluteFillObject} />
  );
}

function LayerJReadabilityVeil() {
  if (Platform.OS !== 'web') {
    return (
      <View
        style={styles.layerJNative}
        pointerEvents="none"
        aria-hidden={true}
      />
    );
  }
  return (
    <View
      data-testid="lgoon-layer-j-readability-veil"
      style={styles.layerJ}
      pointerEvents="none"
      aria-hidden={true}
    />
  );
}

/**
 * Light Galaxy Orbit Nebula — ten independent motion layers (A–J).
 * No single-scene pan; each layer owns its own rAF loop or CSS animation.
 */
export function LightGalaxyOrbitNebulaBackground({
  animated = true,
  dimmed = false,
}: LightGalaxyOrbitNebulaBackgroundProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { width } = useWindowDimensions();
  const shouldAnimate = animated && !prefersReducedMotion;
  const starCount = width > 1400 ? 28 : width > 900 ? 24 : 20;

  useEffect(() => {
    ensureWebStyles();
  }, []);

  if (Platform.OS === 'web') {
    return (
      <View
        style={styles.root}
        pointerEvents="none"
        aria-hidden={true}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="light-galaxy-orbit-nebula-background"
        data-layers={LGON_LAYER_IDS.join(',')}
        data-motion-engine="independent-layers"
      >
        <LayerABaseAtmosphere />
        <FarNebulaLayer animate={shouldAnimate} />
        <DeepNebulaLayer animate={shouldAnimate} />
        <MainPlanetLayer animate={shouldAnimate} />
        <SecondaryPlanetsLayer animate={shouldAnimate} />
        <SmallBodiesLayer animate={shouldAnimate} />
        <RedEnergyLayer animate={shouldAnimate} />
        <StarDustLayer animate={shouldAnimate} starCount={starCount} />
        <OrbitArcsLayer animate={shouldAnimate} />
        <LayerJReadabilityVeil />
        {dimmed ? <View style={styles.dimOverlay} pointerEvents="none" /> : null}
      </View>
    );
  }

  return (
    <View
      style={styles.root}
      pointerEvents="none"
      aria-hidden={true}
      testID="light-galaxy-orbit-nebula-background"
    >
      <LayerABaseAtmosphere />
      {dimmed ? <View style={styles.dimOverlay} pointerEvents="none" /> : null}
    </View>
  );
}

const webRootStyle: ViewStyle = (Platform.OS === 'web'
    ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }
    : {}) as ViewStyle;

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 0,
    backgroundColor: '#B0B6BE',
    ...webRootStyle,
  },
  layerA: {
    ...StyleSheet.absoluteFillObject,
    ...(Platform.OS === 'web' ? { backgroundImage:
      'linear-gradient(135deg, #A8AEB6 0%, #B8BEC6 28%, #C4CAD2 52%, #B0B6BE 78%, #9CA2AC 100%)' } : null) as ViewStyle,
  },
  layerJ: {
    ...StyleSheet.absoluteFillObject,
    ...(Platform.OS === 'web' ? { backgroundImage:
      'radial-gradient(ellipse 96% 88% at 50% 44%, rgba(196,200,206,0.038) 0%, rgba(188,192,198,0.014) 42%, transparent 72%)' } : null) as ViewStyle,
    pointerEvents: 'none',
  },
  layerJNative: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(196,200,206,0.02)',
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(196,200,206,0.24)',
  },
});
