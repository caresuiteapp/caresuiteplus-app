import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
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
import { galaxyGradients, galaxyPalette } from '@/design/tokens/galaxy';
import { useThemeMode } from '@/design/ThemeModeProvider';
import { useAccessibility } from '@/hooks/useAccessibility';
import { CareLightButton } from './CareLightButton';
import { buttonHeights, colors, elevation, motion, radius, typography } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'prepared';
type Size = 'sm' | 'md';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
};

const VARIANT_GRADIENTS: Partial<Record<Variant, readonly [string, string]>> = {
  primary: galaxyGradients.primaryCta,
  danger: [galaxyPalette.danger, '#F87171'],
  success: [galaxyPalette.success, '#4ADE80'],
  prepared: [galaxyPalette.glowViolet, galaxyPalette.glowBlue],
};

export function PremiumButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  fullWidth = false,
}: Props) {
  const { mode } = useThemeMode();

  if (mode === 'light') {
    const lightVariant =
      variant === 'danger' || variant === 'success' || variant === 'prepared'
        ? 'secondary'
        : variant;
    const lightStyle = fullWidth
      ? StyleSheet.flatten([styles.fullWidth, style])
      : StyleSheet.flatten(style);
    return (
      <CareLightButton
        title={title}
        onPress={onPress}
        variant={lightVariant as 'primary' | 'secondary' | 'ghost'}
        loading={loading}
        style={lightStyle ?? undefined}
      />
    );
  }

  const { scaleFontSize } = useAccessibility();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const gradientVariant = VARIANT_GRADIENTS[variant];
  const isFilled = Boolean(gradientVariant);
  const height = size === 'sm' ? buttonHeights.sm : buttonHeights.md;
  const isDisabled = disabled || loading;
  const labelStyle = {
    fontSize: scaleFontSize(16),
    lineHeight: scaleFontSize(22),
  };

  const content = (
    <View
      style={[
        styles.inner,
        { height, minWidth: fullWidth ? undefined : 120 },
        fullWidth && styles.fullWidth,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        isDisabled && styles.disabled,
        isFilled && variant === 'primary' && elevation.orangeGlow,
        style,
      ]}
    >
      {gradientVariant ? (
        <LinearGradient
          colors={[...gradientVariant]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={isFilled ? '#0A0500' : colors.textPrimary} />
      ) : (
        <Text
          allowFontScaling
          numberOfLines={1}
          style={[
            typography.button,
            labelStyle,
            isFilled && styles.filledText,
            !isFilled && styles.secondaryText,
          ]}
        >
          {title}
        </Text>
      )}
    </View>
  );

  return (
    <Animated.View style={[animStyle, fullWidth && styles.fullWidth]}>
      <Pressable
        disabled={isDisabled}
        onPress={onPress}
        onPressIn={() => {
          if (!isDisabled) scale.value = withSpring(0.96, motion.spring);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, motion.spring);
        }}
      >
        {content}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  inner: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  fullWidth: {
    width: '100%',
  },
  secondary: {
    backgroundColor: galaxyPalette.cardGlass,
    borderColor: galaxyPalette.borderGlass,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: galaxyPalette.borderGlass,
  },
  disabled: {
    opacity: 0.5,
  },
  filledText: {
    color: '#0A0500',
    fontWeight: '600',
  },
  secondaryText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
