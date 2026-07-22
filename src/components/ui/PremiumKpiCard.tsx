import { useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeMode } from '@/design/ThemeModeProvider';
import {
  useAuroraAdaptiveText,
  useAuroraGlass,
  useAuroraGlassActive,
  useAuroraGlassCardStyle,
} from '@/design/tokens/auroraGlass';
import { glassFx } from '@/design/tokens/motion';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { careLightColors } from '@/design/tokens/lightTheme';
import { SpaceKpiIcon } from '@/components/icons/space';
import { CareLightKpiCard } from './CareLightKpiCard';
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
  const { mode } = useThemeMode();
  const shellHostsAurora = useShellHostsAurora();
  const auroraActive = useAuroraGlassActive();
  const { tokens: glass } = useAuroraGlass();
  const { colors, typography, gradients } = useLegacyTheme();
  const text = useAuroraAdaptiveText();
  const glassCardStyle = useAuroraGlassCardStyle();
  const resolvedAccent = accentColor ?? colors.cyan;
  const isLight = variant === 'light' && !shellHostsAurora;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          flex: 1,
          minWidth: '46%',
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: isLight
            ? careLightColors.border
            : auroraActive
              ? glass.border
              : colors.borderSoft,
          backgroundColor: isLight
            ? careLightColors.surface
            : auroraActive
              ? glass.card
              : gradients.card.default[0],
          overflow: 'hidden',
          shadowOpacity: isLight ? 0.1 : 0.3,
          shadowRadius: isLight ? 8 : 14,
          shadowOffset: { width: 0, height: isLight ? 2 : 6 },
          elevation: isLight ? 3 : 8,
        },
        gradient: {
          ...StyleSheet.absoluteFillObject,
        },
        innerBorder: {
          ...StyleSheet.absoluteFillObject,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: glassFx.innerBorder,
        },
        rim: {
          height: 2,
          width: '50%',
          alignSelf: 'center',
          borderRadius: 1,
          opacity: 0.85,
        },
        content: {
          padding: 14,
          gap: 4,
        },
        iconBubble: {
          width: 36,
          height: 36,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 4,
          overflow: 'hidden',
        },
        label: {
          ...typography.caption,
          textTransform: labelCase === 'uppercase' ? 'uppercase' : 'none',
          letterSpacing: labelCase === 'uppercase' ? 0.4 : 0,
          flexShrink: 0,
          color: isLight ? careLightColors.muted : text.secondary,
        },
        value: {
          fontSize: 24,
          fontWeight: '800',
          letterSpacing: -0.5,
          flexShrink: 0,
          color: isLight ? careLightColors.text : undefined,
        },
        subValue: {
          ...typography.caption,
          color: isLight ? careLightColors.muted : text.muted,
        },
        trend: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }),
    [
      auroraActive,
      colors.borderSoft,
      glass.border,
      glass.card,
      gradients.card.default,
      isLight,
      text.muted,
      text.secondary,
      labelCase,
      typography.caption,
    ],
  );

  if (mode === 'light' && !shellHostsAurora) {
    return (
      <CareLightKpiCard
        label={label}
        value={String(value)}
        subValue={subValue}
        icon={icon}
        accentColor={accentColor}
        style={style}
      />
    );
  }

  const trendColor = isLight
    ? trend === 'up'
      ? careLightColors.green
      : trend === 'down'
        ? careLightColors.danger
        : careLightColors.muted
    : trend === 'up'
      ? colors.success
      : trend === 'down'
        ? colors.danger
        : text.muted;

  const surfaceGradient = auroraActive ? glassFx.surface : gradients.card.default;

  return (
    <View
      style={[
        styles.wrapper,
        !isLight && auroraActive ? glassCardStyle : null,
        { shadowColor: isLight ? 'rgba(7,18,42,0.12)' : resolvedAccent },
        style,
      ]}
    >
      {!isLight ? <LinearGradient colors={[...surfaceGradient]} style={styles.gradient} /> : null}
      {!isLight && auroraActive ? <View style={styles.innerBorder} pointerEvents="none" /> : null}
      <View style={[styles.rim, { backgroundColor: resolvedAccent }]} />
      <View style={styles.content}>
        {icon ? (
          <View style={styles.iconBubble}>
            <SpaceKpiIcon icon={icon} accentColor={resolvedAccent} size={36} />
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
          style={[styles.value, !isLight ? { color: resolvedAccent } : null]}
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
