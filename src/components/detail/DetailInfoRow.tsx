import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careTypography } from '@/design/tokens/typography';
import { spacing } from '@/theme';

type DetailInfoRowProps = {
  label: string;
  value: string | null | undefined;
};

export function DetailInfoRow({ label, value }: DetailInfoRowProps) {
  const { c } = useCareLightPalette();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        },
        label: {
          ...careTypography.caption,
          color: c.muted,
          marginBottom: 2,
        },
        value: {
          ...careTypography.bodyStrong,
          color: c.text,
        },
      }),
    [c],
  );

  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}
