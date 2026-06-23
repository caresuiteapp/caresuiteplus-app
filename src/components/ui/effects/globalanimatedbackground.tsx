import { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useThemeMode } from '@/design/ThemeModeProvider';
import { StaticLightPaperBackground } from '@/components/backgrounds';
import { AuroraBackground } from './aurorabackground';

type GlobalAnimatedBackgroundProps = {
  /** Override ThemeModeProvider (e.g. CareSuiteBackground legacy `mode` prop). */
  mode?: 'light' | 'dark';
  /** Disable aurora drift (dark mode only). Light mode is always static. */
  animated?: boolean;
  style?: ViewStyle;
  children?: ReactNode;
  /** Leichte Abdunklung (Modals / Formulare). */
  dimmed?: boolean;
  /** @deprecated Office routes use the same static light background. */
  isOfficeRoute?: boolean;
};

/**
 * Single shell-root background for CareSuite+.
 * Dark: animated aurora gradient. Light: static paper texture (no animation).
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
      <StaticLightPaperBackground dimmed={dimmed} />
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
