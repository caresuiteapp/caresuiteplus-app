import { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useThemeMode } from '@/design/ThemeModeProvider';
import {
  GlobalPersistentSpaceMotionBackground,
  StaticLightPaperBackground,
} from '@/components/backgrounds';
import { AuroraBackground } from './aurorabackground';

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
 * Dark: animated aurora gradient. Light: persistent 240s canvas space motion (G.1).
 * Mount once at app/_layout root — never inside columns or per-screen.
 */
export function GlobalAnimatedBackground({
  mode: modeOverride,
  animated = true,
  style,
  children,
  dimmed = false,
}: GlobalAnimatedBackgroundProps) {
  const { mode: themeMode } = useThemeMode();
  const mode = modeOverride ?? themeMode;

  if (mode === 'dark') {
    return (
      <View style={[styles.root, style]} pointerEvents="box-none">
        <AuroraBackground animated={animated} />
        {children}
      </View>
    );
  }

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
