import { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SpatialCareBackground } from '@/components/backgrounds';

type GlobalAnimatedBackgroundProps = {
  /** Override ThemeModeProvider (e.g. CareSuiteBackground legacy `mode` prop). */
  mode?: 'light' | 'dark';
  /** Disable background motion (dark aurora / light paper layers). */
  animated?: boolean;
  style?: ViewStyle;
  children?: ReactNode;
  /** Leichte Abdunklung (Modals / Formulare). */
  dimmed?: boolean;
};

/**
 * Single shell-root background for CareSuite+.
 * Hosts the one canonical light CareSuite backdrop for every product area.
 * Mount once at app/_layout root — never inside columns or per-screen.
 */
export function GlobalAnimatedBackground({
  mode: _modeOverride,
  animated: _animated = true,
  style,
  children,
  dimmed = false,
}: GlobalAnimatedBackgroundProps) {
  return (
    <View style={[styles.root, styles.spatialRoot, style]} pointerEvents="none">
      <SpatialCareBackground dimmed={dimmed} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  spatialRoot: {
    backgroundColor: '#17182D',
  },
});
