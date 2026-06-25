import { useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { resolveLightColoredTextColor } from '@/design/tokens/accentContrast';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { auroraGlass, lightLiquidGlass, useAuroraAdaptiveText, useAuroraGlassActive } from '@/design/tokens/auroraGlass';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { designTokens } from '@/theme';
import { SpaceKpiIcon } from '@/components/icons/space';

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
  const text = useAuroraAdaptiveText();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          flex: 1,
          minWidth: 140,
          backgroundColor: auroraActive
            ? isDark
              ? auroraGlass.card
              : lightLiquidGlass.card
            : isDark
              ? 'rgba(255,255,255,0.04)'
              : careLightColors.surface,
          borderRadius: careRadius.md,
          borderWidth: 1,
          borderColor: auroraActive
            ? isDark
              ? auroraGlass.border
              : lightLiquidGlass.border
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
          overflow: 'hidden',
        },
        label: {
          ...careTypography.caption,
          color: auroraActive ? text.secondary : isDark ? c.muted : careLightColors.muted,
          fontWeight: '600',
        },
        value: {
          ...careTypography.h2,
          fontSize: 28,
          fontWeight: '800',
        },
        subValue: {
          ...careTypography.caption,
          color: auroraActive ? text.muted : isDark ? c.muted : careLightColors.muted,
        },
      }),
    [auroraActive, c.muted, isDark, text.muted, text.secondary],
  );

  return (
    <View style={[styles.card, style]}>
      <View style={styles.iconBadge}>
        <SpaceKpiIcon icon={icon ?? '📊'} accentColor={accentColor} size={36} />
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: resolveLightColoredTextColor(accentColor, careLightColors.text) }]}>
        {String(value)}
      </Text>
      {subValue ? <Text style={styles.subValue}>{subValue}</Text> : null}
    </View>
  );
}
