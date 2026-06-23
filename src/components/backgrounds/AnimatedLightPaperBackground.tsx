import { createElement, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
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

type WebDomHostProps = {
  className?: string;
  style?: CSSProperties;
  html?: string;
  testID?: string;
  cycleS?: number;
};

/** RN Web View strips dangerouslySetInnerHTML/className — use a native div on web. */
function WebDomHost({ className, style, html, testID, cycleS }: WebDomHostProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    if (className != null) el.className = className;
    if (html != null) el.innerHTML = html;
    if (cycleS != null) el.setAttribute('data-lpb-cycle-s', String(cycleS));
    else el.removeAttribute('data-lpb-cycle-s');
  }, [className, html, cycleS]);

  if (Platform.OS !== 'web') return null;

  return createElement('div', {
    ref: (node: HTMLDivElement | null) => {
      hostRef.current = node;
    },
    style,
    ...(testID ? { 'data-testid': testID } : {}),
  });
}

/**
 * Animated light paper texture — independent CSS layer motion on web (120s loop).
 * Static SVG base always visible on web; animated overlay hides its own base wash.
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

  const overlayClassName = paused
    ? 'lpb-root lpb-root--overlay lpb-root--paused'
    : 'lpb-root lpb-root--overlay';

  return (
    <>
      <StaticLightPaperBackground dimmed={false} testID={`${testID}-static-base`} />
      <WebDomHost
        className={overlayClassName}
        style={{
          ...WEB_FIXED_FILL,
          overflow: 'hidden',
          zIndex: 0,
          pointerEvents: 'none',
        }}
        html={lightPaperBackgroundAnimatedSvg}
        testID={testID}
        cycleS={LPB_CYCLE_S}
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
