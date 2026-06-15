import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeMode } from '@/design/ThemeModeProvider';
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
  pulse = false,
}: Props) {
  const { mode } = useThemeMode();

  if (mode === 'light') {
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

  const { colors, typography, gradients } = useLegacyTheme();
  const resolvedAccent = accentColor ?? colors.cyan;
  const floatY = useSharedValue(0);
  const pulseOpacity = useSharedValue(0.3);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          flex: 1,
          minWidth: '46%',
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.borderSoft,
          overflow: 'hidden',
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        },
        gradient: {
          ...StyleSheet.absoluteFillObject,
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
          flexShrink: 1,
        },
        value: {
          fontSize: 24,
          fontWeight: '800',
          letterSpacing: -0.5,
        },
        subValue: {
          ...typography.caption,
        },
        trend: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }),
    [colors.borderSoft, typography.caption],
  );

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(withTiming(-3, { duration: 2400 }), withTiming(0, { duration: 2400 })),
      -1,
      false,
    );
    if (pulse) {
      pulseOpacity.value = withRepeat(
        withSequence(withTiming(0.55, { duration: 1200 }), withTiming(0.3, { duration: 1200 })),
        -1,
        false,
      );
    }
  }, [floatY, pulse, pulseOpacity, pulse]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
    shadowOpacity: pulseOpacity.value,
  }));

  const trendColor =
    trend === 'up' ? colors.success : trend === 'down' ? colors.danger : colors.textMuted;

  return (
    <Animated.View style={[styles.wrapper, { shadowColor: resolvedAccent }, animStyle, style]}>
      <LinearGradient colors={[...gradients.card.default]} style={styles.gradient} />
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
        <Text style={[styles.value, { color: resolvedAccent }]}>{value}</Text>
        {subValue ? <Text style={styles.subValue}>{subValue}</Text> : null}
        {trendValue ? (
          <Text style={[styles.trend, { color: trendColor }]}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '·'} {trendValue}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}
