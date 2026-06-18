import { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { resolveCareSuitePalette } from '@/design/tokens/colors';
import { AuroraBackground } from '@/components/ui/effects';

type CareSuiteBackgroundProps = {
  mode?: 'light' | 'dark';
  children: ReactNode;
  style?: ViewStyle;
  /** Disable aurora drift animation (dark mode only). */
  animated?: boolean;
};

export function CareSuiteBackground({
  mode = 'dark',
  children,
  style,
  animated = true,
}: CareSuiteBackgroundProps) {
  if (mode === 'dark') {
    return (
      <View style={[styles.root, style]}>
        <AuroraBackground animated={animated} />
        {children}
      </View>
    );
  }

  const palette = resolveCareSuitePalette('light');
  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={[palette.background.app, palette.background.soft, palette.background.app]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.orbitGlow} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  orbitGlow: {
    position: 'absolute',
    top: '12%',
    right: '-10%',
    width: '55%',
    height: '35%',
    borderRadius: 999,
    backgroundColor: 'rgba(6,182,212,0.10)',
  },
});
