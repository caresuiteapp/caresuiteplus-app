import { Image, StyleSheet, View, type ViewStyle } from 'react-native';
import { CARESUITE_ROBOT_LOGO } from './brandassets';

export const CARESUITE_LOGO_SIZES = {
  sm: 36,
  md: 48,
  lg: 64,
  xl: 80,
  xxl: 96,
  hero: 112,
} as const;

export type CareSuiteLogoSize = keyof typeof CARESUITE_LOGO_SIZES;

type CareSuiteLogoMarkProps = {
  size?: CareSuiteLogoSize;
  /** @deprecated Transparent logo works on all surfaces; kept for call-site compatibility. */
  onDark?: boolean;
  style?: ViewStyle;
};

export function CareSuiteLogoMark({ size = 'md', style }: CareSuiteLogoMarkProps) {
  const dim = CARESUITE_LOGO_SIZES[size];

  return (
    <View style={[styles.wrap, { width: dim, height: dim }, style]}>
      <Image
        source={CARESUITE_ROBOT_LOGO}
        style={{ width: dim, height: dim, backgroundColor: 'transparent' }}
        resizeMode="contain"
        accessibilityLabel="CareSuite+ Logo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});
