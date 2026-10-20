import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSuiteColors } from '@/design/tokens/colors';
import { careTypography } from '@/design/tokens/typography';
import { CareSuiteLogo } from './CareSuiteLogo';
import type { CareSuiteLogoSize } from './CareSuiteLogoMark';

type CareSuiteWordmarkProps = {
  size?: 'sm' | 'md' | 'lg' | 'nav';
  showPlus?: boolean;
  /** Force dark-on-light wordmark (e.g. light sidebar). Default adapts to aurora shell. */
  variant?: 'default' | 'aurora' | 'light';
  style?: ViewStyle;
};

function resolveLogoSize(size: CareSuiteWordmarkProps['size']): CareSuiteLogoSize {
  if (size === 'lg') return 'lg';
  if (size === 'md' || size === 'nav') return 'md';
  return 'sm';
}

export function CareSuiteWordmark({
  size = 'md',
  showPlus = true,
  variant = 'default',
  style,
}: CareSuiteWordmarkProps) {
  const text = useAuroraAdaptiveText();
  const titleSize = size === 'lg' ? 28 : size === 'md' ? 22 : 18;
  const logoSize = resolveLogoSize(size);
  const titleColor =
    variant === 'light' ? careSuiteColors.light.brand.navy : text.primary;
  const taglineColor = variant === 'light' ? careSuiteColors.light.text.muted : text.muted;

  return (
    <View style={[styles.row, style]} accessibilityRole="header">
      <CareSuiteLogo size={logoSize} />
      <View>
        <Text style={[styles.title, { fontSize: titleSize, color: titleColor }]}>
          CareSuite{showPlus ? '+' : ''}
        </Text>
        <Text style={[styles.tagline, { color: taglineColor }]}>Pflege & Betreuung</Text>
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
    fontWeight: '800',
  },
  tagline: {
    ...careTypography.caption,
  },
});
