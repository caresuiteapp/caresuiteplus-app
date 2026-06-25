import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { webFixedViewportCoverStyle } from '@/lib/platform/webSafeArea';
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
  const scaleX = w / PSM_VIEWBOX_W;
  const scaleY = h / PSM_VIEWBOX_H;
  const coverScale = Math.max(scaleX, scaleY);
  const offsetX = (w - PSM_VIEWBOX_W * coverScale) / 2;
  const offsetY = (h - PSM_VIEWBOX_H * coverScale) / 2;
  ctx.save();
  ctx.translate(offsetX + dx, offsetY + dy);
  ctx.scale(coverScale, coverScale);
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

type PsmPathCache = {
  bands: Path2D[];
  curves: Path2D[];
};

let pathCache: PsmPathCache | null = null;

function getPathCache(): PsmPathCache | null {
  if (typeof Path2D === 'undefined') return null;
  if (!pathCache) {
    pathCache = {
      bands: PSM_SCENE.bands.map((band) => new Path2D(band.d)),
      curves: PSM_SCENE.curves.map((curve) => new Path2D(curve.d)),
    };
  }
  return pathCache;
}

function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number, phase: number) {
  const paths = getPathCache();
  ctx.clearRect(0, 0, w, h);
  drawBaseGradient(ctx, w, h);

  for (const disc of PSM_SCENE.cornerDiscs) {
    withMotionLayer(ctx, w, h, disc, phase, () => drawPaperDisc(ctx, disc));
  }

  if (paths) {
    PSM_SCENE.bands.forEach((band, index) => {
      withMotionLayer(ctx, w, h, band, phase, () => drawBand(ctx, paths.bands[index], band.opacity));
    });
  }

  for (const disc of PSM_SCENE.mediumDiscs) {
    withMotionLayer(ctx, w, h, disc, phase, () => drawPaperDisc(ctx, disc));
  }

  for (const ring of PSM_SCENE.rings) {
    withMotionLayer(ctx, w, h, ring, phase, () =>
      drawRing(ctx, ring.bx, ring.by, ring.radius, ring.strokeWidth),
    );
  }

  if (paths) {
    PSM_SCENE.curves.forEach((curve, index) => {
      withMotionLayer(ctx, w, h, curve, phase, () => {
        drawCurve(ctx, paths.curves[index], curve.strokeWidth);
        for (const dot of curve.dots) {
          drawAccentDot(ctx, dot.bx, dot.by, dot.r);
        }
      });
    });
  }

  for (const disc of PSM_SCENE.buttonDots) {
    withMotionLayer(ctx, w, h, disc, phase, () => drawPaperDisc(ctx, disc));
  }
}

function canUseWebCanvas(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof Path2D !== 'undefined'
  );
}

function startCanvasLoop(
  canvas: HTMLCanvasElement,
  shouldAnimateFrame: () => boolean,
): () => void {
  if (typeof Path2D === 'undefined') return () => undefined;

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
    const phase = shouldAnimateFrame() ? getBackgroundPhase() : 0;
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
 * Canvas ref host — same pattern as LightLiquidGlassAuroraNebulaBackground (RN Web safe).
 */
function WebMotionCanvas({ animate, testID }: { animate: boolean; testID?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animateRef = useRef(animate);
  animateRef.current = animate;

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    return startCanvasLoop(canvas, () => animateRef.current);
  }, []);

  if (Platform.OS !== 'web') return null;

  return (
    <canvas
      ref={canvasRef}
      data-motion-engine="persistent-space-canvas"
      data-background-engine="persistent-space-canvas"
      data-loop-ms={String(PSM_LOOP_MS)}
      data-testid={testID}
      aria-hidden={true}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
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
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    ensureWebStyles();
  }, []);

  useLayoutEffect(() => {
    setIsClient(true);
  }, []);

  if (!shouldAnimate) {
    return <StaticLightPaperBackground dimmed={dimmed} testID={testID} />;
  }

  if (!isClient) {
    return (
      <View
        style={[styles.root, dimmed && styles.dimmed]}
        pointerEvents="none"
        testID={testID}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    );
  }

  if (!canUseWebCanvas()) {
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
      <WebMotionCanvas animate testID={`${testID}-canvas`} />
    </View>
  );
}

const webFixedFull: ViewStyle = (Platform.OS === 'web' ? webFixedViewportCoverStyle() : {}) as ViewStyle;

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    ...webFixedFull,
  },
  dimmed: {
    opacity: 0.88,
  },
});
