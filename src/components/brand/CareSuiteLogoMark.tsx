import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careRadius } from '@/design/tokens/radius';
import { careTypography } from '@/design/tokens/typography';

type CareSuiteLogoMarkProps = {
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
};

const SIZES = { sm: 36, md: 48, lg: 64 } as const;

export function CareSuiteLogoMark({ size = 'md', style }: CareSuiteLogoMarkProps) {
  const dim = SIZES[size];
  return (
    <View style={[styles.wrap, { width: dim, height: dim, borderRadius: dim * 0.28 }, style]}>
      <LinearGradient
        colors={[careLightColors.surface, careLightColors.page]}
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
    borderColor: `${careLightColors.orange}55`,
    overflow: 'hidden',
  },
  orbit: {
    position: 'absolute',
    width: '70%',
    height: '70%',
    borderRadius: careRadius.capsule,
    borderWidth: 1,
    borderColor: `${careLightColors.cyan}66`,
    opacity: 0.7,
  },
  mark: {
    ...careTypography.h3,
    color: careLightColors.orange,
    fontWeight: '800',
  },
});
