import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spatialCareColors } from '@/design/tokens/spatialCareSuite';
import { systemLiquidGlass } from '@/design/tokens/systemLiquidGlass';
import { SpaceKpiIcon } from '@/components/icons/space';
import { radius } from '@/theme';

type Props = {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: string;
  accentColor?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  style?: ViewStyle;
  /** Light card only outside Aurora. Inside Aurora it resolves to canonical glass. */
  variant?: 'glass' | 'light';
  /** @deprecated Pulse animation removed — cards stay static on glass surfaces. */
  pulse?: boolean;
  /** Allow multi-line values (e.g. long mime labels on mobile). Default 1. */
  valueLines?: number;
  /** Label casing — uppercase is default for dashboard KPIs. */
  labelCase?: 'uppercase' | 'normal';
};

export function PremiumKpiCard({
  label,
  value,
  subValue,
  icon,
  accentColor,
  trend,
  trendValue,
  style,
  variant = 'glass',
  valueLines = 1,
  labelCase = 'uppercase',
}: Props) {
  const { colors, typography } = useLegacyTheme();
  const resolvedAccent = accentColor ?? colors.cyan;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          flex: 1,
          minWidth: 168,
          minHeight: 108,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: systemLiquidGlass.borderStrong,
          backgroundColor: systemLiquidGlass.panelStrong,
          overflow: 'hidden',
          shadowOpacity: 0.2,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 5 },
          elevation: 6,
          ...(Platform.OS === 'web'
            ? ({ boxShadow: systemLiquidGlass.shadowSoft } as unknown as ViewStyle)
            : null),
        },
        innerBorder: {
          ...StyleSheet.absoluteFillObject,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: systemLiquidGlass.innerBorder,
        },
        rim: {
          position: 'absolute',
          top: 0,
          left: 18,
          right: 18,
          height: 2,
          borderRadius: 1,
          opacity: 0.85,
        },
        content: {
          minHeight: 106,
          padding: 16,
          gap: 3,
          justifyContent: 'center',
        },
        iconBubble: {
          width: 30,
          height: 30,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 2,
          overflow: 'hidden',
        },
        label: {
          ...typography.caption,
          textTransform: labelCase === 'uppercase' ? 'uppercase' : 'none',
          letterSpacing: labelCase === 'uppercase' ? 0.4 : 0,
          flexShrink: 0,
          color: systemLiquidGlass.text.secondary,
        },
        value: {
          fontSize: 22,
          fontWeight: '800',
          letterSpacing: -0.5,
          flexShrink: 0,
          color: resolvedAccent,
        },
        subValue: {
          ...typography.caption,
          color: systemLiquidGlass.text.muted,
        },
        trend: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }),
    [
      labelCase,
      resolvedAccent,
      typography.caption,
    ],
  );

  const trendColor =
    trend === 'up'
      ? colors.success
      : trend === 'down'
        ? colors.danger
        : systemLiquidGlass.text.muted;

  return (
    <View
      style={[
        styles.wrapper,
        { shadowColor: spatialCareColors.nightDeep },
        style,
      ]}
      {...(Platform.OS === 'web'
        ? ({ dataSet: { csHealthosComponent: 'kpi-card' } } as object)
        : {})}
    >
      <View style={styles.innerBorder} pointerEvents="none" />
      <View style={[styles.rim, { backgroundColor: resolvedAccent }]} />
      <View style={styles.content}>
        {icon ? (
          <View style={styles.iconBubble}>
            <SpaceKpiIcon icon={icon} accentColor={resolvedAccent} size={30} />
          </View>
        ) : null}
        <Text
          style={styles.label}
          numberOfLines={2}
          adjustsFontSizeToFit={labelCase === 'uppercase'}
          minimumFontScale={0.75}
        >
          {label}
        </Text>
        <Text
          style={styles.value}
          numberOfLines={valueLines}
        >
          {value}
        </Text>
        {subValue ? <Text style={styles.subValue}>{subValue}</Text> : null}
        {trendValue ? (
          <Text style={[styles.trend, { color: trendColor }]}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '·'} {trendValue}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
