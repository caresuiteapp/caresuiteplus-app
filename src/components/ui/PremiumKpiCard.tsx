import { useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeMode } from '@/design/ThemeModeProvider';
import {
  auroraGlass,
  useAuroraAdaptiveText,
  useAuroraGlassActive,
  useAuroraGlassCardStyle,
} from '@/design/tokens/auroraGlass';
import { glassFx } from '@/design/tokens/motion';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
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
  /** @deprecated Pulse animation removed — cards stay static on glass surfaces. */
  pulse?: boolean;
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
}: Props) {
  const { mode } = useThemeMode();
  const shellHostsAurora = useShellHostsAurora();
  const auroraActive = useAuroraGlassActive();
  const { colors, typography, gradients } = useLegacyTheme();
  const text = useAuroraAdaptiveText();
  const glassCardStyle = useAuroraGlassCardStyle();
  const resolvedAccent = accentColor ?? colors.cyan;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          flex: 1,
          minWidth: '46%',
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: auroraActive ? auroraGlass.border : colors.borderSoft,
          backgroundColor: auroraActive ? auroraGlass.card : gradients.card.default[0],
          overflow: 'hidden',
          shadowOpacity: 0.3,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
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
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 4,
        },
        icon: {
          fontSize: 18,
        },
        label: {
          ...typography.caption,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          flexShrink: 0,
          color: text.secondary,
        },
        value: {
          fontSize: 24,
          fontWeight: '800',
          letterSpacing: -0.5,
          flexShrink: 0,
        },
        subValue: {
          ...typography.caption,
          color: text.muted,
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
      gradients.card.default,
      text.muted,
      text.secondary,
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

  const trendColor =
    trend === 'up' ? colors.success : trend === 'down' ? colors.danger : text.muted;

  const surfaceGradient = auroraActive ? glassFx.surface : gradients.card.default;

  return (
    <View
      style={[styles.wrapper, auroraActive ? glassCardStyle : null, { shadowColor: resolvedAccent }, style]}
    >
      <LinearGradient colors={[...surfaceGradient]} style={styles.gradient} />
      {auroraActive ? <View style={styles.innerBorder} pointerEvents="none" /> : null}
      <View style={[styles.rim, { backgroundColor: resolvedAccent }]} />
      <View style={styles.content}>
        {icon ? (
          <View style={[styles.iconBubble, { backgroundColor: `${resolvedAccent}20` }]}>
            <Text style={styles.icon}>{icon}</Text>
          </View>
        ) : null}
        <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {label}
        </Text>
        <Text style={[styles.value, { color: resolvedAccent }]} numberOfLines={1}>
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
