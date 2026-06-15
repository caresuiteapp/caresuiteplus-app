import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';

type CareLightKpiCardProps = {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: string;
  accentColor?: string;
  style?: ViewStyle;
};

export function CareLightKpiCard({
  label,
  value,
  subValue,
  icon,
  accentColor = careLightColors.green,
  style,
}: CareLightKpiCardProps) {
  return (
    <View style={[styles.card, style]}>
      <View style={[styles.iconBadge, { backgroundColor: `${accentColor}18` }]}>
        <Text style={styles.icon}>{icon ?? '📊'}</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: accentColor }]}>{String(value)}</Text>
      {subValue ? <Text style={styles.subValue}>{subValue}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    backgroundColor: careLightColors.surface,
    borderRadius: careRadius.md,
    borderWidth: 1,
    borderColor: careLightColors.border,
    padding: careSpacing.md,
    gap: careSpacing.xs,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: careRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
  },
  label: {
    ...careTypography.caption,
    color: careLightColors.muted,
    fontWeight: '600',
  },
  value: {
    ...careTypography.h2,
    fontSize: 28,
    fontWeight: '800',
  },
  subValue: {
    ...careTypography.caption,
    color: careLightColors.muted,
  },
});
