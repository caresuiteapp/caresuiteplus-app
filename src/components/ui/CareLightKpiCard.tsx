import { useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { useAuroraGlassActive } from '@/design/tokens/auroraGlass';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { designTokens } from '@/theme';

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
  const { isDark, c } = useCareLightPalette();
  const auroraActive = useAuroraGlassActive();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          flex: 1,
          minWidth: 140,
          backgroundColor: auroraActive
            ? careLightColors.surface
            : isDark
              ? 'rgba(255,255,255,0.04)'
              : careLightColors.surface,
          borderRadius: careRadius.md,
          borderWidth: 1,
          borderColor: auroraActive
            ? careLightColors.border
            : isDark
              ? designTokens.glass.border
              : careLightColors.border,
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
          color: auroraActive
            ? careLightColors.muted
            : isDark
              ? c.muted
              : careLightColors.muted,
          fontWeight: '600',
        },
        value: {
          ...careTypography.h2,
          fontSize: 28,
          fontWeight: '800',
          flexShrink: 0,
          color: auroraActive ? careLightColors.text : undefined,
        },
        subValue: {
          ...careTypography.caption,
          color: auroraActive
            ? careLightColors.muted
            : isDark
              ? c.muted
              : careLightColors.muted,
        },
      }),
    [auroraActive, c.muted, isDark],
  );

  return (
    <View style={[styles.card, style]}>
      <View style={[styles.iconBadge, { backgroundColor: `${accentColor}18` }]}>
        <Text style={styles.icon}>{icon ?? '📊'}</Text>
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[
          styles.value,
          !auroraActive ? { color: accentColor } : null,
        ]}
        numberOfLines={1}
      >
        {String(value)}
      </Text>
      {subValue ? <Text style={styles.subValue}>{subValue}</Text> : null}
    </View>
  );
}
