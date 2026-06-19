import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { careSuiteColors } from '@/design/tokens/colors';
import { careTypography } from '@/design/tokens/typography';
import { CareSuiteLogo } from './CareSuiteLogo';

type CareSuiteWordmarkProps = {
  size?: 'sm' | 'md' | 'lg';
  showPlus?: boolean;
  style?: ViewStyle;
};

export function CareSuiteWordmark({ size = 'md', showPlus = true, style }: CareSuiteWordmarkProps) {
  const titleSize = size === 'lg' ? 28 : size === 'md' ? 22 : 18;
  return (
    <View style={[styles.row, style]} accessibilityRole="header">
      <CareSuiteLogo size={size === 'lg' ? 'lg' : size === 'md' ? 'md' : 'sm'} />
      <View>
        <Text style={[styles.title, { fontSize: titleSize }]}>
          CareSuite{showPlus ? '+' : ''}
        </Text>
        <Text style={styles.tagline}>Pflege & Betreuung</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    ...careTypography.h2,
    color: careSuiteColors.light.brand.navy,
    fontWeight: '800',
  },
  tagline: {
    ...careTypography.caption,
    color: careSuiteColors.light.text.muted,
  },
});
