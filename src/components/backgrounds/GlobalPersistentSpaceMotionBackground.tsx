import { useEffect, useLayoutEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  PSM_LOOP_MS,
  PSM_SCENE,
  psmCircleAt,
  psmLineAt,
  psmNebulaAt,
  type PsmCircle,
} from '@/design/tokens/persistentSpaceMotionScene';
import { getBackgroundPhase } from '@/lib/background/backgroundTime';
import { usePrefersReducedMotion } from '@/hooks/useprefersreducedmotion';
import { StaticLightPaperBackground, type StaticLightPaperBackgroundProps } from './StaticLightPaperBackground';

export type GlobalPersistentSpaceMotionBackgroundProps = StaticLightPaperBackgroundProps;

const BODY_BG_STYLE_ID = 'caresuite-psm-body-bg';
const MAX_DPR = 1.5;

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

function edgeIntensity(x: number, y: number, w: number, h: number): number {
  const dx = (x - w * 0.5) / (w * 0.48);
  const dy = (y - h * 0.44) / (h * 0.48);
  const dist = Math.sqrt(dx * dx + dy * dy);
  return Math.min(1, Math.max(0.34, dist * 0.94 + 0.3));
}

function drawBaseGradient(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#FAFAFA');
  grad.addColorStop(0.42, '#FFFFFF');
  grad.addColorStop(1, '#F7F7F7');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function drawNebulaLayer(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  phase: number,
) {
  for (const nebula of PSM_SCENE.nebulas) {
    const { x, y } = psmNebulaAt(nebula, w, h, phase);
    const rx = nebula.radiusX * w;
    const ry = nebula.radiusY * h;
    const breathe = 1 + Math.sin(phase * nebula.speedX + nebula.phase) * 0.06;
    ctx.save();
    ctx.filter = 'blur(56px)';
    ctx.globalAlpha = nebula.baseOpacity;
    const radial = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry) * breathe);
    radial.addColorStop(0, nebula.inner);
    radial.addColorStop(0.45, nebula.mid);
    radial.addColorStop(1, nebula.outer);
    ctx.fillStyle = radial;
    ctx.beginPath();
    ctx.ellipse(x, y, rx * breathe, ry * breathe, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = 'none';
    ctx.restore();
  }
}

function drawSoftCircle(
  ctx: CanvasRenderingContext2D,
  circle: PsmCircle,
  w: number,
  h: number,
  phase: number,
  minDim: number,
) {
  const { x, y, scale, opacity } = psmCircleAt(circle, w, h, phase);
  const r = circle.baseRadius * minDim * scale;
  const edge = edgeIntensity(x, y, w, h);
  const alpha = opacity * (0.65 + edge * 0.35);
  ctx.save();
  ctx.globalAlpha = alpha;
  const grad = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.05, x, y, r);
  grad.addColorStop(0, 'rgba(255,255,255,0.92)');
  grad.addColorStop(0.35, circle.color);
  grad.addColorStop(0.75, circle.color.replace(/[\d.]+\)$/, '0.18)'));
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  phase: number,
) {
  for (const line of PSM_SCENE.lines) {
    const { x, y, angle, length, opacity } = psmLineAt(line, w, h, phase);
    const dx = Math.cos(angle) * length * 0.5;
    const dy = Math.sin(angle) * length * 0.5;
    const edge = edgeIntensity(x, y, w, h);
    ctx.save();
    ctx.globalAlpha = opacity * (0.7 + edge * 0.3);
    ctx.strokeStyle = line.color;
    ctx.lineWidth = line.thickness;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - dx, y - dy);
    ctx.lineTo(x + dx, y + dy);
    ctx.stroke();
    ctx.restore();
  }
}

function drawReadabilityWash(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w * 0.5;
  const cy = h * 0.46;
  const r = Math.max(w, h) * 0.42;
  const wash = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  wash.addColorStop(0, 'rgba(255,255,255,0.28)');
  wash.addColorStop(0.55, 'rgba(255,255,255,0.08)');
  wash.addColorStop(1, 'transparent');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  phase: number,
) {
  ctx.clearRect(0, 0, w, h);
  drawBaseGradient(ctx, w, h);
  drawNebulaLayer(ctx, w, h, phase);
  const minDim = Math.min(w, h);
  for (const c of PSM_SCENE.largeCircles) {
    drawSoftCircle(ctx, c, w, h, phase, minDim);
  }
  for (const c of PSM_SCENE.mediumCircles) {
    drawSoftCircle(ctx, c, w, h, phase, minDim);
  }
  for (const c of PSM_SCENE.smallParticles) {
    drawSoftCircle(ctx, c, w, h, phase, minDim);
  }
  drawLine(ctx, w, h, phase);
  drawReadabilityWash(ctx, w, h);
}

function WebMotionCanvas({ animate, testID }: { animate: boolean; testID?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const animateRef = useRef(animate);
  animateRef.current = animate;

  useLayoutEffect(() => {
    ensureWebStyles();
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const attachLoop = () => {
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return false;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;

      pausedRef.current = false;

      const resize = () => {
        const parent = canvas.parentElement;
        if (!parent) return;
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        const cw = parent.clientWidth;
        const ch = parent.clientHeight;
        if (cw <= 0 || ch <= 0) return;
        canvas.width = Math.floor(cw * dpr);
        canvas.height = Math.floor(ch * dpr);
        canvas.style.width = `${cw}px`;
        canvas.style.height = `${ch}px`;
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
        if (pausedRef.current || cancelled) return;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (w <= 0 || h <= 0) {
          frameRef.current = requestAnimationFrame(tick);
          return;
        }
        const phase = animateRef.current ? getBackgroundPhase() : 0;
        drawFrame(ctx, w, h, phase);
        canvas.dataset.loopMs = String(PSM_LOOP_MS);
        frameRef.current = requestAnimationFrame(tick);
      };

      tick();

      cleanup = () => {
        window.removeEventListener('resize', resize);
        document.removeEventListener('visibilitychange', onVisibility);
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      };
      return true;
    };

    if (!attachLoop()) {
      const retryId = requestAnimationFrame(() => {
        if (!cancelled) attachLoop();
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(retryId);
        cleanup?.();
      };
    }

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-testid={testID}
      data-motion-engine="persistent-space-canvas"
      data-loop-ms={String(PSM_LOOP_MS)}
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
 * G.1 — Persistent 240s canvas space motion engine (web).
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
      <WebMotionCanvas animate testID={`${testID}-canvas`} />
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
