import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careTypography } from '@/design/tokens/typography';
import { formatDateForDisplay } from '@/lib/formatters/dateTimeFormatters';
import { spacing } from '@/theme';

type DetailInfoRowProps = {
  label: string;
  value: string | null | undefined;
};

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function resolveDisplayValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '—') return trimmed;
  if (ISO_DATE_ONLY.test(trimmed)) return formatDateForDisplay(trimmed);
  return value;
}

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
  const displayValue = resolveDisplayValue(value);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{displayValue}</Text>
    </View>
  );
}
