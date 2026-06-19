import React, { useMemo } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeMode } from '@/design/ThemeModeProvider';
import { glassFx, withAlpha } from '@/design/tokens/motion';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { CareLightCard } from './CareLightCard';
import { elevation, motion, radius, sheen as sheenTokens } from '@/theme';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accentColor?: string;
  variant?: 'default' | 'elevated';
  /** Glossy top sheen overlay via LinearGradient (WP 027). */
  sheen?: boolean;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

export function PremiumCard({
  children,
  style,
  onPress,
  accentColor,
  variant = 'default',
  sheen = false,
}: Props) {
  const { mode } = useThemeMode();
  const shellHostsAurora = useShellHostsAurora();

  if (mode === 'light' && !shellHostsAurora) {
    return (
      <CareLightCard accentColor={accentColor} onPress={onPress} style={style as ViewStyle}>
        {children}
      </CareLightCard>
    );
  }

  const scale = useSharedValue(1);
  const glow = accentColor ?? glassFx.borderStrong;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        shadowHost: {
          borderRadius: radius.card,
          shadowColor: glow,
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.16,
          shadowRadius: 16,
          elevation: 10,
        },
        wrapper: {
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: accentColor ? withAlpha(accentColor, 0.32) : glassFx.border,
          overflow: 'hidden',
          position: 'relative',
        },
        gradient: {
          ...StyleSheet.absoluteFillObject,
          borderRadius: radius.card,
        },
        innerBorder: {
          ...StyleSheet.absoluteFillObject,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: glassFx.innerBorder,
        },
        topSheen: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: sheenTokens.height,
          backgroundColor: sheenTokens.color,
        },
        sheenOverlay: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '46%',
          borderTopLeftRadius: radius.card,
          borderTopRightRadius: radius.card,
        },
        accentRim: {
          position: 'absolute',
          top: 0,
          left: 24,
          right: 24,
          height: 2,
          borderRadius: 2,
        },
        content: {
          padding: 20,
        },
      }),
    [accentColor, glow],
  );

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const gradColors = variant === 'elevated' ? glassFx.surfaceElevated : glassFx.surface;

  const inner = (
    <View style={[styles.wrapper, elevation.card]}>
      <LinearGradient
        colors={gradColors}
        start={sheenTokens.gradientStart}
        end={sheenTokens.gradientEnd}
        style={styles.gradient}
      />
      <View style={styles.innerBorder} pointerEvents="none" />
      {sheen ? (
        <LinearGradient
          colors={glassFx.sheen}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.5 }}
          style={styles.sheenOverlay}
          pointerEvents="none"
        />
      ) : (
        <View style={styles.topSheen} />
      )}
      {accentColor ? (
        <View style={[styles.accentRim, { backgroundColor: accentColor }]} />
      ) : null}
      <View style={styles.content}>{children}</View>
    </View>
  );

  if (!onPress) {
    return <Animated.View style={[styles.shadowHost, animStyle, style]}>{inner}</Animated.View>;
  }

  return (
    <Animated.View style={[styles.shadowHost, animStyle, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.987, motion.spring);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, motion.spring);
        }}
        style={webCursor}
      >
        {inner}
      </Pressable>
    </Animated.View>
  );
}
