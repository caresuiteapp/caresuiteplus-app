import { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { careSuiteColors } from '@/design/tokens/colors';
import { resolveCareSuitePalette } from '@/design/tokens/colors';

type CareSuiteBackgroundProps = {
  mode?: 'light' | 'dark';
  children: ReactNode;
  style?: ViewStyle;
};

export function CareSuiteBackground({ mode = 'dark', children, style }: CareSuiteBackgroundProps) {
  const palette = resolveCareSuitePalette(mode);
  const gradient: [string, string, ...string[]] =
    mode === 'light'
      ? [palette.background.app, palette.background.soft, palette.background.app]
      : [palette.background.dark, palette.background.darkElevated, palette.background.app];

  return (
    <View style={[styles.root, style]}>
      <LinearGradient colors={gradient} style={StyleSheet.absoluteFillObject} />
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
    backgroundColor: `${careSuiteColors.light.brand.cyan}18`,
  },
});
