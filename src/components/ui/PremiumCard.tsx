import React, { useMemo } from 'react';
import {
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
import { useLegacyTheme } from '@/design/tokens/themeBridge';
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

export function PremiumCard({
  children,
  style,
  onPress,
  accentColor,
  variant = 'default',
  sheen = false,
}: Props) {
  const { mode } = useThemeMode();

  if (mode === 'light') {
    return (
      <CareLightCard accentColor={accentColor} onPress={onPress} style={style as ViewStyle}>
        {children}
      </CareLightCard>
    );
  }

  const { colors, gradients } = useLegacyTheme();
  const scale = useSharedValue(1);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.borderSoft,
          overflow: 'hidden',
          position: 'relative',
        },
        gradient: {
          ...StyleSheet.absoluteFillObject,
          borderRadius: radius.card,
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
          height: '42%',
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
    [colors.borderSoft],
  );

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const gradColors =
    variant === 'elevated' ? gradients.card.elevated : gradients.card.default;

  const inner = (
    <View style={[styles.wrapper, elevation.card, style]}>
      <LinearGradient
        colors={[...gradColors]}
        start={sheenTokens.gradientStart}
        end={sheenTokens.gradientEnd}
        style={styles.gradient}
      />
      {sheen ? (
        <LinearGradient
          colors={[...gradients.sheen.subtle]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.35 }}
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
    return <Animated.View style={animStyle}>{inner}</Animated.View>;
  }

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.987, motion.spring);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, motion.spring);
        }}
      >
        {inner}
      </Pressable>
    </Animated.View>
  );
}
