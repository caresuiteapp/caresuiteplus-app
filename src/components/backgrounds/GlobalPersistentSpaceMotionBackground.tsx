import { createElement, useCallback, useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  PSM_LOOP_MS,
  PSM_SCENE,
  PSM_VIEWBOX_H,
  PSM_VIEWBOX_W,
  psmMotionOffset,
  type PsmMotion,
  type PsmPaperDisc,
} from '@/design/tokens/persistentSpaceMotionScene';
import { getBackgroundPhase } from '@/lib/background/backgroundTime';
import { usePrefersReducedMotion } from '@/hooks/useprefersreducedmotion';
import { StaticLightPaperBackground, type StaticLightPaperBackgroundProps } from './StaticLightPaperBackground';

export type GlobalPersistentSpaceMotionBackgroundProps = StaticLightPaperBackgroundProps;

const BODY_BG_STYLE_ID = 'caresuite-psm-body-bg';
const MAX_DPR = 1.5;

const WEB_HOST_STYLE = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100vw',
  height: '100vh',
  overflow: 'hidden',
  pointerEvents: 'none',
} as const;

type ShadowPreset = {
  blur: number;
  offsetY: number;
  color: string;
};

const SHADOW_LG: ShadowPreset = { blur: 28, offsetY: 18, color: 'rgba(200,200,200,0.38)' };
const SHADOW_MD: ShadowPreset = { blur: 16, offsetY: 10, color: 'rgba(207,207,207,0.4)' };
const SHADOW_PAPER: ShadowPreset = { blur: 22, offsetY: 14, color: 'rgba(200,200,200,0.42)' };
const SHADOW_BUTTON: ShadowPreset = { blur: 7, offsetY: 5, color: 'rgba(208,208,208,0.55)' };
const SHADOW_BUTTON_STRONG: ShadowPreset = { blur: 9, offsetY: 7, color: 'rgba(168,168,168,0.62)' };
const SHADOW_LINE: ShadowPreset = { blur: 4, offsetY: 3, color: 'rgba(216,216,216,0.45)' };
const SHADOW_RING: ShadowPreset = { blur: 12, offsetY: 8, color: 'rgba(212,212,212,0.35)' };

function ensureWebStyles() {
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

function applyShadow(ctx: CanvasRenderingContext2D, preset: ShadowPreset) {
  ctx.shadowColor = preset.color;
  ctx.shadowBlur = preset.blur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = preset.offsetY;
}

function clearShadow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function drawBaseGradient(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const linear = ctx.createLinearGradient(0, 0, w, h);
  linear.addColorStop(0, '#FAFAFA');
  linear.addColorStop(0.42, '#FFFFFF');
  linear.addColorStop(1, '#F7F7F7');
  ctx.fillStyle = linear;
  ctx.fillRect(0, 0, w, h);

  const cx = w * 0.5;
  const cy = h * 0.46;
  const r = Math.max(w, h) * 0.58;
  const calm = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  calm.addColorStop(0, 'rgba(255,255,255,0.92)');
  calm.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = calm;
  ctx.fillRect(0, 0, w, h);
}

function withMotionLayer(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  motion: PsmMotion,
  phase: number,
  draw: () => void,
) {
  const { dx, dy } = psmMotionOffset(motion, phase);
  ctx.save();
  ctx.translate(dx, dy);
  ctx.scale(w / PSM_VIEWBOX_W, h / PSM_VIEWBOX_H);
  draw();
  ctx.restore();
}

function shadowForDisc(disc: PsmPaperDisc): ShadowPreset {
  switch (disc.shadow) {
    case 'lg':
      return SHADOW_LG;
    case 'md':
      return SHADOW_MD;
    case 'button':
      return SHADOW_BUTTON;
    case 'buttonStrong':
      return SHADOW_BUTTON_STRONG;
    default:
      return SHADOW_MD;
  }
}

function drawFilledDisc(ctx: CanvasRenderingContext2D, disc: PsmPaperDisc) {
  const cx = disc.bx * PSM_VIEWBOX_W;
  const cy = disc.by * PSM_VIEWBOX_H;
  const r = disc.baseRadius * PSM_VIEWBOX_W;
  const fill = disc.fill ?? '#FFFFFF';
  const alpha = disc.opacity ?? 0.98;

  applyShadow(ctx, shadowForDisc(disc));
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  clearShadow(ctx);

  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 0.5, 0, Math.PI * 2);
  ctx.stroke();
}

function drawButtonDot(ctx: CanvasRenderingContext2D, disc: PsmPaperDisc) {
  const cx = disc.bx * PSM_VIEWBOX_W;
  const cy = disc.by * PSM_VIEWBOX_H;
  const r = disc.baseRadius * PSM_VIEWBOX_W;

  ctx.globalAlpha = 0.38;
  ctx.fillStyle = '#A8A8A8';
  ctx.beginPath();
  ctx.arc(cx + 4, cy + 6, r + 1, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.72;
  ctx.strokeStyle = '#9A9A9A';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 1.2, 0, Math.PI * 2);
  ctx.stroke();

  applyShadow(ctx, SHADOW_BUTTON_STRONG);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#F6F6F6';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  clearShadow(ctx);
}

function drawPaperDisc(ctx: CanvasRenderingContext2D, disc: PsmPaperDisc) {
  if (disc.kind === 'button') {
    drawButtonDot(ctx, disc);
    return;
  }
  drawFilledDisc(ctx, disc);
}

function drawBand(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  opacity: number,
) {
  applyShadow(ctx, SHADOW_PAPER);
  ctx.globalAlpha = opacity;
  ctx.fillStyle = '#FFFFFF';
  ctx.fill(path);
  clearShadow(ctx);
  ctx.globalAlpha = 1;
}

function drawRing(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  radius: number,
  strokeWidth: number,
) {
  const cx = bx * PSM_VIEWBOX_W;
  const cy = by * PSM_VIEWBOX_H;
  const r = radius * PSM_VIEWBOX_W;

  applyShadow(ctx, SHADOW_RING);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = strokeWidth;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  clearShadow(ctx);
}

function drawCurve(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  strokeWidth: number,
) {
  applyShadow(ctx, SHADOW_LINE);
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.stroke(path);
  clearShadow(ctx);
}

function drawAccentDot(ctx: CanvasRenderingContext2D, bx: number, by: number, r: number) {
  const cx = bx * PSM_VIEWBOX_W;
  const cy = by * PSM_VIEWBOX_H;
  const radius = r * PSM_VIEWBOX_W;
  applyShadow(ctx, SHADOW_BUTTON);
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  clearShadow(ctx);
}

function buildPathCache(): {
  bands: Path2D[];
  curves: Path2D[];
} {
  const bands = PSM_SCENE.bands.map((band) => new Path2D(band.d));
  const curves = PSM_SCENE.curves.map((curve) => new Path2D(curve.d));
  return { bands, curves };
}

const PATH_CACHE = buildPathCache();

function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number, phase: number) {
  ctx.clearRect(0, 0, w, h);
  drawBaseGradient(ctx, w, h);

  for (const disc of PSM_SCENE.cornerDiscs) {
    withMotionLayer(ctx, w, h, disc, phase, () => drawPaperDisc(ctx, disc));
  }

  PSM_SCENE.bands.forEach((band, index) => {
    withMotionLayer(ctx, w, h, band, phase, () => drawBand(ctx, PATH_CACHE.bands[index], band.opacity));
  });

  for (const disc of PSM_SCENE.mediumDiscs) {
    withMotionLayer(ctx, w, h, disc, phase, () => drawPaperDisc(ctx, disc));
  }

  for (const ring of PSM_SCENE.rings) {
    withMotionLayer(ctx, w, h, ring, phase, () =>
      drawRing(ctx, ring.bx, ring.by, ring.radius, ring.strokeWidth),
    );
  }

  PSM_SCENE.curves.forEach((curve, index) => {
    withMotionLayer(ctx, w, h, curve, phase, () => {
      drawCurve(ctx, PATH_CACHE.curves[index], curve.strokeWidth);
      for (const dot of curve.dots) {
        drawAccentDot(ctx, dot.bx, dot.by, dot.r);
      }
    });
  });

  for (const disc of PSM_SCENE.buttonDots) {
    withMotionLayer(ctx, w, h, disc, phase, () => drawPaperDisc(ctx, disc));
  }
}

function startCanvasLoop(canvas: HTMLCanvasElement, animate: boolean): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => undefined;

  let frameRef: number | null = null;
  let frameCount = 0;
  let paused = false;

  const resize = () => {
    const host = canvas.parentElement;
    const cw = host?.clientWidth ?? window.innerWidth;
    const ch = host?.clientHeight ?? window.innerHeight;
    if (cw <= 0 || ch <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.floor(cw * dpr);
    canvas.height = Math.floor(ch * dpr);
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const onVisibility = () => {
    paused = document.hidden;
    if (!paused && frameRef === null) {
      frameRef = requestAnimationFrame(tick);
    }
  };

  const tick = () => {
    frameRef = null;
    if (paused) return;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    if (w <= 0 || h <= 0) {
      frameRef = requestAnimationFrame(tick);
      return;
    }
    const phase = animate ? getBackgroundPhase() : 0;
    drawFrame(ctx, w, h, phase);
    frameCount += 1;
    canvas.dataset.loopMs = String(PSM_LOOP_MS);
    canvas.dataset.frameCount = String(frameCount);
    canvas.dataset.phase = phase.toFixed(4);
    frameRef = requestAnimationFrame(tick);
  };

  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVisibility);
  tick();

  return () => {
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVisibility);
    if (frameRef !== null) cancelAnimationFrame(frameRef);
    frameRef = null;
  };
}

/**
 * Imperative DOM canvas host — reliable on React Native Web (ref timing safe).
 */
function WebMotionCanvasHost({ animate, testID }: { animate: boolean; testID?: string }) {
  const cleanupRef = useRef<(() => void) | null>(null);
  const animateRef = useRef(animate);
  animateRef.current = animate;

  const attachHost = useCallback(
    (host: HTMLDivElement | null) => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (!host) return;

      let canvas = host.querySelector('canvas[data-motion-engine="persistent-space-canvas"]');
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.setAttribute('data-motion-engine', 'persistent-space-canvas');
        canvas.setAttribute('data-loop-ms', String(PSM_LOOP_MS));
        if (testID) canvas.setAttribute('data-testid', testID);
        canvas.style.position = 'absolute';
        canvas.style.inset = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none';
        host.appendChild(canvas);
      }

      cleanupRef.current = startCanvasLoop(canvas as HTMLCanvasElement, animateRef.current);
    },
    [testID],
  );

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  if (Platform.OS !== 'web') return null;

  return createElement('div', {
    ref: attachHost,
    style: WEB_HOST_STYLE,
    'data-background-engine': 'persistent-space-canvas',
  });
}

/**
 * G.1 — Persistent 240s light paper neumorphic canvas (web).
 * Native / reduced motion → static light paper fallback.
 */
export function GlobalPersistentSpaceMotionBackground({
  dimmed = false,
  animated = true,
  testID = 'global-persistent-space-motion-background',
}: GlobalPersistentSpaceMotionBackgroundProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const shouldAnimate = animated && !prefersReducedMotion && Platform.OS === 'web';

  useEffect(() => {
    ensureWebStyles();
  }, []);

  if (!shouldAnimate) {
    return <StaticLightPaperBackground dimmed={dimmed} testID={testID} />;
  }

  return (
    <View
      style={[styles.root, dimmed && styles.dimmed]}
      pointerEvents="none"
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <WebMotionCanvasHost animate testID={`${testID}-canvas`} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: 'transparent',
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
  dimmed: {
    opacity: 0.88,
  },
});
