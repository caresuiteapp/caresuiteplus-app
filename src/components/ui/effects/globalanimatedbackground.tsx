import { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import {
  GlobalPersistentSpaceMotionBackground,
  StaticLightPaperBackground,
} from '@/components/backgrounds';

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
 * Always uses the light space/paper backdrop — no dark or black surfaces.
 * Mount once at app/_layout root — never inside columns or per-screen.
 */
export function GlobalAnimatedBackground({
  mode: _modeOverride,
  animated = true,
  style,
  children,
  dimmed = false,
}: GlobalAnimatedBackgroundProps) {
  return (
    <View style={[styles.root, styles.lightRoot, style]} pointerEvents="none">
      {animated ? (
        <GlobalPersistentSpaceMotionBackground animated dimmed={dimmed} />
      ) : (
        <StaticLightPaperBackground dimmed={dimmed} />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  lightRoot: {
    backgroundColor: 'transparent',
  },
});
