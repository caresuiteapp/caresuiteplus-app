import { createElement, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  LPB_CYCLE_S,
  lightPaperAnimLayers,
  lightPaperBackgroundAnimatedSvg,
  lightPaperBackgroundAnimationCss,
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

/** Re-apply CSS animation on each SVG layer after innerHTML inject (RN Web / SVG class timing). */
function applyLayerAnimations(host: HTMLElement, paused: boolean) {
  const playState = paused ? 'paused' : 'running';
  for (const layer of lightPaperAnimLayers) {
    const node = host.querySelector<SVGElement>(`.${layer.className}`);
    if (!node) continue;
    node.style.transformBox = 'fill-box';
    node.style.transformOrigin = 'center';
    node.style.willChange = 'transform';
    node.style.animation = `lpb-kf-${layer.id} ${LPB_CYCLE_S}s ease-in-out infinite`;
    node.style.animationDelay = `-${layer.delayS}s`;
    node.style.animationPlayState = playState;
  }
}

type SyncHostOptions = {
  className?: string;
  html?: string;
  cycleS?: number;
  paused?: boolean;
};

function syncWebDomHost(el: HTMLDivElement, { className, html, cycleS, paused = false }: SyncHostOptions) {
  ensureWebStyles();
  if (className != null) el.className = className;
  if (html != null) el.innerHTML = normalizeSvgHtml(html);
  if (cycleS != null) el.setAttribute('data-lpb-cycle-s', String(cycleS));
  else el.removeAttribute('data-lpb-cycle-s');
  applyLayerAnimations(el, paused);
}

type WebDomHostProps = {
  className?: string;
  style?: CSSProperties;
  html?: string;
  testID?: string;
  cycleS?: number;
  paused?: boolean;
};

/** RN Web View strips dangerouslySetInnerHTML/className — use a native div on web. */
function WebDomHost({ className, style, html, testID, cycleS, paused = false }: WebDomHostProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  const syncHost = useCallback(
    (el: HTMLDivElement | null) => {
      hostRef.current = el;
      if (!el) return;
      syncWebDomHost(el, { className, html, cycleS, paused });
    },
    [className, html, cycleS, paused],
  );

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    syncWebDomHost(el, { className, html, cycleS, paused });
  }, [className, html, cycleS, paused]);

  if (Platform.OS !== 'web') return null;

  return createElement('div', {
    ref: syncHost,
    style,
    ...(testID ? { 'data-testid': testID } : {}),
  });
}

/**
 * Animated light paper texture — independent CSS layer motion on web (120s loop).
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
        paused={paused}
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
