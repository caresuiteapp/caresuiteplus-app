import { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';

type CareLightSectionProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  style?: ViewStyle;
};

export function CareLightSection({ title, subtitle, children, style }: CareLightSectionProps) {
  return (
    <View style={[styles.root, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: careSpacing.sm,
  },
  header: {
    gap: 2,
  },
  title: {
    ...careTypography.bodyStrong,
    color: careLightColors.navy,
    fontSize: 17,
  },
  subtitle: {
    ...careTypography.caption,
    color: careLightColors.muted,
  },
});
