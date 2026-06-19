import React, { useMemo } from 'react';
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
import { useThemeMode } from '@/design/ThemeModeProvider';
import { useAuroraGlassButtonStyles } from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { useAccessibility } from '@/hooks/useAccessibility';
import { CareLightButton } from './CareLightButton';
import { buttonHeights, elevation, motion, radius } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost';
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
  const shellHostsAurora = useShellHostsAurora();

  if (mode === 'light' && !shellHostsAurora) {
    const lightStyle = fullWidth
      ? StyleSheet.flatten([styles.fullWidth, style])
      : StyleSheet.flatten(style);
    return (
      <CareLightButton
        title={title}
        onPress={onPress}
        variant={variant}
        loading={loading}
        style={lightStyle ?? undefined}
      />
    );
  }

  const { colors, typography } = useLegacyTheme();
  const auroraButtonStyles = useAuroraGlassButtonStyles();
  const { scaleFontSize } = useAccessibility();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isPrimary = variant === 'primary';
  const height = size === 'sm' ? buttonHeights.sm : buttonHeights.md;
  const isDisabled = disabled || loading;
  const labelStyle = useMemo(
    () => ({
      fontSize: scaleFontSize(typography.button.fontSize ?? 16),
      lineHeight: scaleFontSize(typography.button.lineHeight ?? 22),
    }),
    [scaleFontSize, typography.button.fontSize, typography.button.lineHeight],
  );

  const content = (
    <View
      style={[
        styles.inner,
        { height, minWidth: fullWidth ? undefined : 120 },
        fullWidth && styles.fullWidth,
        !isPrimary && variant === 'secondary' && auroraButtonStyles.secondary,
        !isPrimary && variant === 'ghost' && auroraButtonStyles.ghost,
        isDisabled && styles.disabled,
        isPrimary && elevation.orangeGlow,
        style,
      ]}
    >
      {isPrimary ? (
        <LinearGradient
          colors={['#FF9500', '#FFB020']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#0A0500' : colors.textPrimary} />
      ) : (
        <Text
          allowFontScaling
          style={[
            auroraButtonStyles.label,
            labelStyle,
            isPrimary && styles.primaryText,
            !isPrimary && auroraButtonStyles.secondaryText,
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
  disabled: {
    opacity: 0.5,
  },
  primaryText: {
    color: '#0A0500',
  },
});
