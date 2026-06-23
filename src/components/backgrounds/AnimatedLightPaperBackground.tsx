import { useEffect, useState } from 'react';
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

  return (
    <View
      style={styles.root}
      pointerEvents="none"
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
      nativeID="caresuite-animated-light-paper-bg"
      // @ts-expect-error — web-only className for animation pause
      className={paused ? 'lpb-root lpb-root--paused' : 'lpb-root'}
      data-lpb-cycle-s={LPB_CYCLE_S}
    >
      <View
        style={styles.svgHost}
        pointerEvents="none"
        accessibilityIgnoresInvertColors
        aria-hidden
        // @ts-expect-error — web-only dangerouslySetInnerHTML
        dangerouslySetInnerHTML={{ __html: lightPaperBackgroundAnimatedSvg }}
      />
      {dimmed ? <View style={styles.dimOverlay} pointerEvents="none" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 0,
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
  svgHost: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
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
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(249,251,255,0.22)',
  },
});
