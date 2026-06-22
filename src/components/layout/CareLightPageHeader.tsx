import { ReactNode, useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';

type CareLightPageHeaderProps = {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  style?: ViewStyle;
};

export function CareLightPageHeader({ title, subtitle, rightSlot, style }: CareLightPageHeaderProps) {
  const { c } = useCareLightPalette();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: careSpacing.md,
        },
        left: {
          flex: 1,
          gap: 2,
        },
        right: {
          flexShrink: 0,
        },
        title: {
          ...careTypography.h2,
          color: c.text,
          fontWeight: '800',
        },
        subtitle: {
          ...careTypography.body,
          color: c.muted,
        },
      }),
    [c.muted, c.text],
  );

  return (
    <View style={[styles.root, style]}>
      <View style={styles.left}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightSlot ? <View style={styles.right}>{rightSlot}</View> : null}
    </View>
  );
}
