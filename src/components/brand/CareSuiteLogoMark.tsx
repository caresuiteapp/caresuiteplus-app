import { Image, StyleSheet, View, type ViewStyle } from 'react-native';
import { CARESUITE_MASCOT } from './brandassets';

type CareSuiteLogoMarkProps = {
  size?: 'sm' | 'md' | 'lg';
  /** @deprecated Transparent mascot works on all surfaces; kept for call-site compatibility. */
  onDark?: boolean;
  style?: ViewStyle;
};

const SIZES = { sm: 36, md: 48, lg: 64 } as const;

export function CareSuiteLogoMark({ size = 'md', style }: CareSuiteLogoMarkProps) {
  const dim = SIZES[size];

  return (
    <View style={[styles.wrap, { width: dim, height: dim }, style]}>
      <Image
        source={CARESUITE_MASCOT}
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
