import { createElement, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import {
  LPB_CYCLE_S,
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

function setSvgPaused(host: HTMLElement | null, paused: boolean) {
  const svg = host?.querySelector('svg');
  if (!svg) return;
  if (paused) svg.pauseAnimations();
  else svg.unpauseAnimations();
}

type WebDomHostProps = {
  className?: string;
  style?: CSSProperties;
  html: string;
  testID?: string;
  paused?: boolean;
};

/**
 * Mount SVG once — never re-inject innerHTML on React re-renders.
 * Layer motion is driven by embedded SMIL animateTransform (120s loops).
 */
function WebDomHost({ className, style, html, testID, paused = false }: WebDomHostProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const htmlRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    ensureWebStyles();
    if (htmlRef.current !== html) {
      el.innerHTML = normalizeSvgHtml(html);
      htmlRef.current = html;
    }
    if (className != null) el.className = className;
    setSvgPaused(el, paused);
  }, [html, className, paused]);

  useEffect(() => {
    return () => {
      htmlRef.current = null;
    };
  }, []);

  if (Platform.OS !== 'web') return null;

  return createElement('div', {
    ref: hostRef,
    style,
    'data-lpb-cycle-s': String(LPB_CYCLE_S),
    ...(testID ? { 'data-testid': testID } : {}),
  });
}

/**
 * Animated light paper texture — independent SVG layer motion on web (120s SMIL loop).
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
        paused={paused}
      />
      {dimmed ? <View style={styles.dimOverlay} pointerEvents="none" /> : null}
    </>
  );
}

const webFixedFull: ViewStyle = (Platform.OS === 'web'
  ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }
  : {}) as ViewStyle;

const styles = StyleSheet.create({
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    ...webFixedFull,
    backgroundColor: 'rgba(249,251,255,0.22)',
  },
});
