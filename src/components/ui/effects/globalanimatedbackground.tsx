import { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { resolveCareSuitePalette } from '@/design/tokens/colors';
import { useThemeMode } from '@/design/ThemeModeProvider';
import { AuroraBackground } from './aurorabackground';

type GlobalAnimatedBackgroundProps = {
  /** Override ThemeModeProvider (e.g. CareSuiteBackground legacy `mode` prop). */
  mode?: 'light' | 'dark';
  /** Disable aurora drift (dark mode). Honours prefers-reduced-motion when true. */
  animated?: boolean;
  style?: ViewStyle;
  children?: ReactNode;
};

/**
 * Single shell-root background for CareSuite+.
 * Dark: animated aurora gradient. Light: soft page gradient.
 * Mount once at app/_layout root — never inside columns or per-screen.
 */
export function GlobalAnimatedBackground({
  mode: modeOverride,
  animated = true,
  style,
  children,
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

  const palette = resolveCareSuitePalette('light');
  return (
    <View style={[styles.root, style]} pointerEvents="box-none">
      <LinearGradient
        colors={[palette.background.app, palette.background.soft, palette.background.app]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.lightGlow} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  lightGlow: {
    position: 'absolute',
    top: '12%',
    right: '-10%',
    width: '55%',
    height: '35%',
    borderRadius: 999,
    backgroundColor: 'rgba(6,182,212,0.10)',
  },
});
