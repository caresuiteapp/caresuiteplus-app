import { useEffect } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';

const LIGHT_PAPER_BACKGROUND_PNG = require('../../../assets/images/backgrounds/light-abstract-paper-background.png');
const LIGHT_PAPER_BACKGROUND_SVG = require('../../../assets/images/backgrounds/light-abstract-paper-background.svg');

export type StaticLightPaperBackgroundProps = {
  dimmed?: boolean;
  /** Ignored — light background is always static. */
  animated?: boolean;
  testID?: string;
};

const BODY_BG_STYLE_ID = 'caresuite-static-light-paper-body-bg';

const WEB_SVG_URI =
  Platform.OS === 'web'
    ? (Image.resolveAssetSource(LIGHT_PAPER_BACKGROUND_SVG)?.uri ?? null)
    : null;

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

/**
 * Static light paper texture — fixed full-viewport image, no animation.
 */
export function StaticLightPaperBackground({
  dimmed = false,
  testID = 'static-light-paper-background',
}: StaticLightPaperBackgroundProps) {
  useEffect(() => {
    ensureWebDocumentTransparent();
  }, []);

  return (
    <View
      style={styles.root}
      pointerEvents="none"
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
      nativeID="caresuite-static-light-paper-bg"
    >
      {Platform.OS === 'web' && WEB_SVG_URI ? (
        <View
          style={[styles.image, { backgroundImage: `url(${WEB_SVG_URI})` }]}
          accessibilityIgnoresInvertColors
          aria-hidden
        />
      ) : (
        <Image
          source={LIGHT_PAPER_BACKGROUND_PNG}
          style={styles.image}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          aria-hidden
        />
      )}
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
  image: {
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
          objectFit: 'cover',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        } as const)
      : null),
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(249,251,255,0.22)',
  },
});
