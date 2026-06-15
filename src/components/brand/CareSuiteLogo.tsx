import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { careSuiteColors } from '@/design/tokens/colors';
import { careRadius } from '@/design/tokens/radius';
import { careTypography } from '@/design/tokens/typography';

type CareSuiteLogoProps = {
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
};

const SIZES = { sm: 36, md: 48, lg: 64 } as const;

export function CareSuiteLogo({ size = 'md', style }: CareSuiteLogoProps) {
  const dim = SIZES[size];
  return (
    <View style={[styles.wrap, { width: dim, height: dim, borderRadius: dim * 0.28 }, style]}>
      <LinearGradient
        colors={[careSuiteColors.light.background.soft, careSuiteColors.light.background.app]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.orbit} />
      <Text style={[styles.mark, { fontSize: dim * 0.38 }]}>C+</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,122,26,0.35)',
    overflow: 'hidden',
  },
  orbit: {
    position: 'absolute',
    width: '70%',
    height: '70%',
    borderRadius: careRadius.capsule,
    borderWidth: 1,
    borderColor: 'rgba(53,215,255,0.45)',
    opacity: 0.6,
  },
  mark: {
    ...careTypography.h3,
    color: careSuiteColors.light.brand.orange,
    fontWeight: '800',
  },
});
