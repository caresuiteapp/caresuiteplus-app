import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spatialCareColors } from '@/design/tokens/spatialCareSuite';
import { systemLiquidGlass } from '@/design/tokens/systemLiquidGlass';
import { SpaceKpiIcon } from '@/components/icons/space';
import { radius } from '@/theme';
import { portalPremium, usePortalPremiumTheme } from '@/design/tokens/portalPremium';
import { employeePortalWorkspace } from '@/components/portal/employee/employeePortalDesign';

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
  const portal = usePortalPremiumTheme();
  const { width } = useWindowDimensions();
  const dense = Platform.OS === 'web' && portal.kind === 'workspace' && width < 900;
  const employee = portal.kind === 'employee';
  const resolvedAccent = accentColor ?? colors.cyan;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          // Legacy surface CSS resets min-width. A real flex basis keeps KPI
          // rows wrapping instead of squeezing every card into a single row.
          ...(Platform.OS === 'web'
            ? { flexGrow: 1, flexShrink: 1, flexBasis: employee ? 112 : dense ? 124 : 168 }
            : { flex: 1 }),
          minWidth: employee ? 96 : dense ? 124 : 168,
          minHeight: employee ? 76 : dense ? 90 : 108,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: employee ? employeePortalWorkspace.line : portal.active ? portalPremium.border : systemLiquidGlass.borderStrong,
          backgroundColor: portal.active ? portalPremium.surfaceRaised : systemLiquidGlass.panelStrong,
          overflow: 'hidden',
          shadowOpacity: employee ? 0 : 0.2,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 5 },
          elevation: employee ? 0 : 6,
          ...(Platform.OS === 'web'
            ? ({ boxShadow: employee ? 'none' : portal.active ? portalPremium.shadow.card : systemLiquidGlass.shadowSoft } as unknown as ViewStyle)
            : null),
        },
        innerBorder: {
          ...StyleSheet.absoluteFill,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: portal.active ? portalPremium.innerBorder : systemLiquidGlass.innerBorder,
        },
        ambientGlow: {
          position: 'absolute',
          width: 156,
          height: 156,
          top: -92,
          right: -54,
          borderRadius: 78,
          backgroundColor: resolvedAccent,
          opacity: 0.16,
        },
        horizon: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 0,
          height: 1,
          backgroundColor: resolvedAccent,
          opacity: 0.42,
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
          minHeight: employee ? 74 : dense ? 88 : 106,
          padding: employee ? 10 : dense ? 12 : 16,
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
          color: portal.active ? portalPremium.text.secondary : systemLiquidGlass.text.secondary,
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
          color: portal.active ? portalPremium.text.muted : systemLiquidGlass.text.muted,
        },
        trend: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }),
    [
      dense,
      employee,
      labelCase,
      portal.active,
      resolvedAccent,
      typography.caption,
    ],
  );

  const trendColor =
    trend === 'up'
      ? colors.success
      : trend === 'down'
        ? colors.danger
        : portal.active
          ? portalPremium.text.muted
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
      {!employee ? <>
        <View style={styles.ambientGlow} pointerEvents="none" />
        <View style={styles.horizon} pointerEvents="none" />
        <View style={styles.innerBorder} pointerEvents="none" />
      </> : null}
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
