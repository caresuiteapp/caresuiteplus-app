import { createElement, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  LPB_CYCLE_S,
  lightPaperAnimLayers,
  lightPaperBackgroundAnimatedSvg,
  lightPaperBackgroundAnimationCss,
  type LightPaperAnimLayer,
} from '@/design/tokens/lightPaperBackgroundAnimated';
import { usePrefersReducedMotion } from '@/hooks/useprefersreducedmotion';
import { StaticLightPaperBackground, type StaticLightPaperBackgroundProps } from './StaticLightPaperBackground';

export type AnimatedLightPaperBackgroundProps = StaticLightPaperBackgroundProps;

const BODY_BG_STYLE_ID = 'caresuite-animated-light-paper-body-bg';
const ANIM_STYLE_ID = 'caresuite-animated-light-paper-keyframes';

const WEB_FIXED_FILL: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100vw',
  height: '100vh',
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
  if (!document.getElementById(ANIM_STYLE_ID)) {
    const tag = document.createElement('style');
    tag.id = ANIM_STYLE_ID;
    tag.textContent = lightPaperBackgroundAnimationCss;
    document.head.appendChild(tag);
  }
}

function normalizeSvgHtml(html: string): string {
  return html.replace(/^<\?xml[^?]*\?>\s*/i, '');
}

/** Smooth 120s loop matching ease-in-out 0% → 50% → 100% keyframes. */
function layerMotionProgress(tSec: number, cycleS: number, delayS: number): number {
  const phase = (((tSec + delayS) % cycleS) + cycleS) % cycleS / cycleS;
  return (1 - Math.cos(phase * Math.PI * 2)) / 2;
}

type LayerPivot = { cx: number; cy: number };

function formatLayerTransform(layer: LightPaperAnimLayer, eased: number, pivot: LayerPivot): string {
  const tx = layer.dx * eased;
  const ty = layer.dy * eased;
  const scale = 1 + (layer.scalePeak - 1) * eased;
  const { cx, cy } = pivot;
  return `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) translate(${cx.toFixed(2)} ${cy.toFixed(2)}) scale(${scale.toFixed(6)}) translate(${(-cx).toFixed(2)} ${(-cy).toFixed(2)})`;
}

/**
 * Chromium ignores CSS transform keyframes on SVG `<g>` (animationName runs but matrix stays identity).
 * Drive motion via SVG transform attributes + requestAnimationFrame instead.
 */
export function startSvgLayerMotion(host: HTMLElement, paused: boolean): () => void {
  const entries: Array<{ node: SVGGElement; layer: LightPaperAnimLayer; pivot: LayerPivot }> = [];

  for (const layer of lightPaperAnimLayers) {
    const node = host.querySelector<SVGGElement>(`.${layer.className}`);
    if (!node) continue;
    node.style.animation = 'none';
    try {
      const bbox = node.getBBox();
      entries.push({
        node,
        layer,
        pivot: { cx: bbox.x + bbox.width / 2, cy: bbox.y + bbox.height / 2 },
      });
    } catch {
      entries.push({ node, layer, pivot: { cx: 0, cy: 0 } });
    }
  }

  let rafId = 0;
  let isActive = true;

  const frame = () => {
    if (!isActive) return;
    if (!paused) {
      const t = performance.now() / 1000;
      for (const { node, layer, pivot } of entries) {
        const eased = layerMotionProgress(t, LPB_CYCLE_S, layer.delayS);
        node.setAttribute('transform', formatLayerTransform(layer, eased, pivot));
      }
    }
    rafId = requestAnimationFrame(frame);
  };

  rafId = requestAnimationFrame(frame);

  return () => {
    isActive = false;
    cancelAnimationFrame(rafId);
  };
}

type SyncHostOptions = {
  className?: string;
  html?: string;
  cycleS?: number;
  onSynced?: () => void;
};

function syncWebDomHost(el: HTMLDivElement, { className, html, cycleS, onSynced }: SyncHostOptions) {
  ensureWebStyles();
  if (className != null) el.className = className;
  if (html != null) el.innerHTML = normalizeSvgHtml(html);
  if (cycleS != null) el.setAttribute('data-lpb-cycle-s', String(cycleS));
  else el.removeAttribute('data-lpb-cycle-s');
  onSynced?.();
}

type WebDomHostProps = {
  className?: string;
  style?: CSSProperties;
  html?: string;
  testID?: string;
  cycleS?: number;
  onHostElement?: (el: HTMLDivElement | null) => void;
  onSynced?: () => void;
};

/** RN Web View strips dangerouslySetInnerHTML/className — use a native div on web. */
function WebDomHost({
  className,
  style,
  html,
  testID,
  cycleS,
  onHostElement,
  onSynced,
}: WebDomHostProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  const syncHost = useCallback(
    (el: HTMLDivElement | null) => {
      hostRef.current = el;
      onHostElement?.(el);
      if (!el) return;
      syncWebDomHost(el, { className, html, cycleS, onSynced });
    },
    [className, html, cycleS, onSynced, onHostElement],
  );

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    syncWebDomHost(el, { className, html, cycleS, onSynced });
  }, [className, html, cycleS, onSynced]);

  if (Platform.OS !== 'web') return null;

  return createElement('div', {
    ref: syncHost,
    style,
    ...(testID ? { 'data-testid': testID } : {}),
  });
}

/**
 * Animated light paper texture — independent SVG layer motion on web (120s loop).
 * Falls back to static PNG/SVG when reduced motion, native, or animated=false.
 */
export function AnimatedLightPaperBackground({
  dimmed = false,
  animated = true,
  testID = 'animated-light-paper-background',
}: AnimatedLightPaperBackgroundProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const shouldAnimate = animated && !prefersReducedMotion && Platform.OS === 'web';
  const [paused, setPaused] = useState(false);
  const [motionHost, setMotionHost] = useState<HTMLDivElement | null>(null);
  const [syncRevision, setSyncRevision] = useState(0);

  const handleSynced = useCallback(() => {
    setSyncRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    ensureWebStyles();
  }, []);

  useEffect(() => {
    if (!shouldAnimate || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onVisibility = () => setPaused(document.hidden);
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [shouldAnimate]);

  useEffect(() => {
    if (!shouldAnimate || !motionHost) return;
    return startSvgLayerMotion(motionHost, paused);
  }, [shouldAnimate, motionHost, paused, syncRevision]);

  if (!shouldAnimate) {
    return <StaticLightPaperBackground dimmed={dimmed} testID={testID} />;
  }

  const rootClassName = paused ? 'lpb-root lpb-root--paused' : 'lpb-root';

  return (
    <>
      <WebDomHost
        className={rootClassName}
        style={{
          ...WEB_FIXED_FILL,
          overflow: 'hidden',
          zIndex: 0,
          pointerEvents: 'none',
        }}
        html={lightPaperBackgroundAnimatedSvg}
        testID={testID}
        cycleS={LPB_CYCLE_S}
        onHostElement={setMotionHost}
        onSynced={handleSynced}
      />
      {dimmed ? <View style={styles.dimOverlay} pointerEvents="none" /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
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
    backgroundColor: 'rgba(249,251,255,0.22)',
  },
});
