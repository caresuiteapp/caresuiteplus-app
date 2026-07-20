import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Platform,
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
import { useAuroraGlassButtonStyles, darkGlassSurfaceText } from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { useAccessibility } from '@/hooks/useAccessibility';
import { CareLightButton } from './CareLightButton';
import { buttonHeights, motion, radius } from '@/theme';
import { AURORA_BUTTON_PRIMARY, careSuiteAuroraTheme } from '@/theme/careSuiteAurora';
import { neonGlow } from '@/design/tokens/motion';

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
  accessibilityLabel?: string;
  testID?: string;
  /** Helle Schrift auf dunklem Button-Hintergrund (ghost/secondary). */
  onDarkSurface?: boolean;
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
  onDarkSurface = false,
  accessibilityLabel,
  testID,
}: Props) {
  const { mode } = useThemeMode();
  const shellHostsAurora = useShellHostsAurora();
  const { colors, typography } = useLegacyTheme();
  const auroraButtonStyles = useAuroraGlassButtonStyles({ viewContext: 'form' });
  const { scaleFontSize } = useAccessibility();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isPrimary = variant === 'primary';
  const height = size === 'sm' ? buttonHeights.sm : buttonHeights.md;
  const isDisabled = disabled || loading;
  const surfaceTextColor = onDarkSurface ? darkGlassSurfaceText.primary : undefined;
  const labelStyle = useMemo(() => {
    if (Platform.OS === 'web') {
      return {
        fontSize: typography.button.fontSize ?? 16,
        lineHeight: typography.button.lineHeight ?? 22,
      };
    }
    return {
      fontSize: scaleFontSize(16),
      lineHeight: scaleFontSize(22),
    };
  }, [scaleFontSize, typography.button.fontSize, typography.button.lineHeight]);

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
        disabled={disabled}
        style={lightStyle ?? undefined}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      />
    );
  }

  const content = (
    <View
      style={[
        styles.inner,
        { height, minWidth: fullWidth ? undefined : 120 },
        fullWidth && styles.fullWidth,
        !isPrimary && variant === 'secondary' && auroraButtonStyles.secondary,
        !isPrimary && variant === 'ghost' && auroraButtonStyles.ghost,
        isDisabled && styles.disabled,
        isPrimary && neonGlow(careSuiteAuroraTheme.accent.violet, 0.35, 20, 10),
        style,
      ]}
    >
      {isPrimary ? (
        <LinearGradient
          colors={[...AURORA_BUTTON_PRIMARY]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#F8FBFF' : surfaceTextColor ?? colors.textPrimary} />
      ) : (
        <Text
          allowFontScaling
          style={[
            auroraButtonStyles.label,
            labelStyle,
            isPrimary && styles.primaryText,
            !isPrimary && auroraButtonStyles.secondaryText,
            surfaceTextColor ? { color: surfaceTextColor } : null,
          ]}
        >
          {title}
        </Text>
      )}
    </View>
  );

  const webPressableStyle =
    Platform.OS === 'web' ? ({ cursor: isDisabled ? 'default' : 'pointer' } as ViewStyle) : null;

  const webClickProps =
    Platform.OS === 'web' && onPress && !isDisabled
      ? ({
          // Playwright force-click and some browser automation paths bypass RN Pressable;
          // native onClick ensures consent/workflow handlers still run on web.
          onClick: (event: { preventDefault?: () => void; stopPropagation?: () => void }) => {
            event.preventDefault?.();
            event.stopPropagation?.();
            onPress();
          },
        } as Record<string, unknown>)
      : {};

  return (
    <Animated.View
      style={[animStyle, fullWidth && styles.fullWidth]}
      pointerEvents="box-none"
    >
      <Pressable
        disabled={isDisabled}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        testID={testID}
        style={[fullWidth && styles.fullWidth, webPressableStyle]}
        {...webClickProps}
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
    color: '#F8FBFF',
    fontWeight: '700',
  },
});
