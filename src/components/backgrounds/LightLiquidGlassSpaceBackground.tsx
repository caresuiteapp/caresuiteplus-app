import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View, type ViewStyle, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  llgsBaseGradient,
  llgsCanvasClouds,
  llgsStarField,
} from '@/design/tokens/lightLiquidGlassSpace';
import { usePrefersReducedMotion } from '@/hooks/useprefersreducedmotion';

type LightLiquidGlassSpaceBackgroundProps = {
  animated?: boolean;
  dimmed?: boolean;
};

const BODY_BG_STYLE_ID = 'caresuite-llgs-body-bg';

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

/** Primäre Web-Schicht: Canvas-Nebula + Sterne per requestAnimationFrame (sichtbare Drift). */
function WebAuroraCanvas({ animate, particleCount }: { animate: boolean; particleCount: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef(Date.now());
  const snapshotRef = useRef<string>('');

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

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

    resize();
    window.addEventListener('resize', resize);

    const stars = llgsStarField.slice(0, particleCount);

    const drawBase = (w: number, h: number) => {
      const g = ctx.createLinearGradient(0, 0, w * 0.6, h);
      g.addColorStop(0, '#EEF6FF');
      g.addColorStop(0.28, '#EAF4FF');
      g.addColorStop(0.52, '#E3EEFF');
      g.addColorStop(0.72, '#EDE8FF');
      g.addColorStop(1, '#E8F0FF');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    };

    const drawCloud = (
      w: number,
      h: number,
      t: number,
      cloud: (typeof llgsCanvasClouds)[number],
      frozen: boolean,
    ) => {
      const minDim = Math.min(w, h);
      const driftScale = frozen ? 0 : 1;
      const cx =
        cloud.bx * w +
        driftScale * (Math.sin(t * cloud.speed + cloud.phase) * cloud.driftX +
          Math.cos(t * cloud.speed * 0.62 + cloud.phase) * cloud.driftX * 0.35);
      const cy =
        cloud.by * h +
        driftScale * (Math.cos(t * cloud.speed * 0.88 + cloud.phase) * cloud.driftY +
          Math.sin(t * cloud.speed * 0.54 + cloud.phase * 1.3) * cloud.driftY * 0.4);
      const breathe = frozen ? 1 : 1 + cloud.breathe * Math.sin(t * cloud.speed * 1.15 + cloud.phase);
      const r = cloud.radius * minDim * breathe;

      const radial = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      radial.addColorStop(0, cloud.inner);
      radial.addColorStop(0.38, cloud.mid);
      radial.addColorStop(0.68, 'rgba(255,255,255,0.06)');
      radial.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    };

    const drawStars = (w: number, h: number, t: number, frozen: boolean) => {
      for (let i = 0; i < stars.length; i += 1) {
        const [nx, ny, intensity] = stars[i];
        const parallax = frozen ? 0 : Math.sin(t * 0.22 + i) * 2.5;
        const twinkle = frozen
          ? 0.65
          : 0.48 + 0.42 * Math.sin(t * 0.65 + i * 0.9);
        const alpha = Math.min(0.9, intensity * twinkle * 0.82);
        const x = nx * w + parallax;
        const y = ny * h + parallax * 0.6;
        const core = intensity > 0.52 ? 1.4 : 0.9;

        if (intensity > 0.5) {
          const glow = ctx.createRadialGradient(x, y, 0, x, y, 6);
          glow.addColorStop(0, `rgba(180,210,255,${(alpha * 0.55).toFixed(3)})`);
          glow.addColorStop(1, 'transparent');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.beginPath();
        ctx.fillStyle = `rgba(140,180,255,${alpha.toFixed(3)})`;
        ctx.arc(x, y, core, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawCalmVeil = (w: number, h: number) => {
      const veil = ctx.createRadialGradient(w * 0.5, h * 0.44, 0, w * 0.5, h * 0.44, w * 0.52);
      veil.addColorStop(0, 'rgba(247,250,255,0.08)');
      veil.addColorStop(0.55, 'rgba(247,250,255,0.02)');
      veil.addColorStop(1, 'rgba(247,250,255,0)');
      ctx.fillStyle = veil;
      ctx.fillRect(0, 0, w, h);
    };

    let frame = 0;
    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const t = (Date.now() - startRef.current) / 1000;

      drawBase(w, h);
      for (const cloud of llgsCanvasClouds) {
        drawCloud(w, h, t, cloud, !animate);
      }
      drawStars(w, h, t, !animate);
      drawCalmVeil(w, h);

      frame += 1;
      if (frame % 120 === 0) {
        snapshotRef.current = llgsCanvasClouds
          .map((c) => {
            const cx =
              c.bx * w +
              Math.sin(t * c.speed + c.phase) * c.driftX;
            const cy =
              c.by * h +
              Math.cos(t * c.speed * 0.88 + c.phase) * c.driftY;
            return `${c.id}:${Math.round(cx)},${Math.round(cy)}`;
          })
          .join('|');
        canvas.dataset.llgsSnapshot = snapshotRef.current;
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [animate, particleCount]);

  if (Platform.OS !== 'web') return null;

  return (
    <canvas
      ref={canvasRef}
      data-testid="llgs-aurora-canvas"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
      aria-hidden={true}
    />
  );
}

/**
 * Globale helle Liquid-Glass-Space-Aurora.
 * Web: ein Canvas-Loop (Nebula-Drift + Sterne). Native: statische Gradient-Layer.
 */
export function LightLiquidGlassSpaceBackground({
  animated = true,
  dimmed = false,
}: LightLiquidGlassSpaceBackgroundProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { width } = useWindowDimensions();
  const shouldAnimate = animated && !prefersReducedMotion;
  const isMobile = width < 768;
  const particleCount = isMobile ? 20 : llgsStarField.length;

  useEffect(() => {
    ensureWebDocumentTransparent();
  }, []);

  if (Platform.OS === 'web') {
    return (
      <View
        style={styles.root}
        pointerEvents="none"
        aria-hidden={true}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="light-liquid-glass-space-background"
      >
        <WebAuroraCanvas animate={shouldAnimate} particleCount={particleCount} />
        {dimmed ? <View style={styles.dimOverlay} pointerEvents="none" /> : null}
      </View>
    );
  }

  return (
    <View style={styles.root} pointerEvents="none" aria-hidden={true} testID="light-liquid-glass-space-background">
      <LinearGradient colors={[...llgsBaseGradient]} style={StyleSheet.absoluteFillObject} />
      {dimmed ? <View style={styles.dimOverlay} pointerEvents="none" /> : null}
    </View>
  );
}

const webFixedFull: ViewStyle = (Platform.OS === 'web'
  ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }
  : {}) as ViewStyle;

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 0,
    backgroundColor: '#EAF4FF',
    ...webFixedFull,
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(247,250,255,0.32)',
  },
});
