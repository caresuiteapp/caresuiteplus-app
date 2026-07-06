import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { useThemeMode } from '@/design/ThemeModeProvider';
import { useHydrated } from '@/hooks/useHydrated';
import { shouldUseHeavyEffects, useDevicePerformance } from '@/lib/performance';
import { webFixedViewportCoverStyle } from '@/lib/platform/webSafeArea';
import { GlobalAnimatedBackground } from './globalanimatedbackground';

type ShellAnimatedBackgroundLayerProps = {
  /** Respect prefers-reduced-motion via GlobalAnimatedBackground internals. */
  animated?: boolean;
  testID?: string;
};

/**
 * Full-viewport animated backdrop for shell roots (portal stack, auth screens).
 * Mount once per shell — not inside scroll columns or cards.
 */
export function ShellAnimatedBackgroundLayer({
  animated = true,
  testID = 'shell-animated-background-layer',
}: ShellAnimatedBackgroundLayerProps) {
  const { mode } = useThemeMode();
  const hydrated = useHydrated();
  const perf = useDevicePerformance();
  const motionAllowed =
    animated && hydrated && shouldUseHeavyEffects(perf) && !perf.isMobile;

  return (
    <View style={styles.layer} pointerEvents="none" testID={testID}>
      <GlobalAnimatedBackground mode={mode} animated={motionAllowed} />
    </View>
  );
}

const webFixedLayer: ViewStyle =
  Platform.OS === 'web'
    ? ({
        ...webFixedViewportCoverStyle(),
        zIndex: 0,
      } as ViewStyle)
    : {};

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 0,
    ...webFixedLayer,
  },
});
