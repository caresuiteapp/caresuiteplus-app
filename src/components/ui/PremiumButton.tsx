import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { LlganGlassShell } from '@/design/web/applyLlganGlassDom';
import {
  spatialCare,
  spatialCareColors,
} from '@/design/tokens/spatialCareSuite';
import { withAlpha } from '@/design/tokens/motion';
import { useAccessibility } from '@/hooks/useAccessibility';
import { buttonHeights, motion, radius } from '@/theme';

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
  onDarkSurface?: boolean;
};

/** Eine einzige kompakte Button-Hierarchie für das gesamte System. */
export function PremiumButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  fullWidth = false,
  accessibilityLabel,
  testID,
  onDarkSurface = true,
}: Props) {
  const { scaleFontSize } = useAccessibility();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isDisabled = disabled || loading;
  const height = size === 'sm' ? buttonHeights.sm : buttonHeights.md;

  const localStyles = useMemo(
    () =>
      StyleSheet.create({
        button: {
          height,
          minWidth: fullWidth ? undefined : size === 'sm' ? 96 : 120,
          width: fullWidth ? '100%' : undefined,
          borderRadius: radius.lg,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: size === 'sm' ? 16 : 20,
          borderWidth: 1,
          borderColor:
            variant === 'ghost' ? spatialCare.border : withAlpha(spatialCareColors.cyanLight, 0.44),
          backgroundColor:
            variant === 'ghost' ? 'transparent' : withAlpha(spatialCareColors.violetMist, 0.14),
          ...(Platform.OS === 'web'
            ? ({
                boxShadow:
                  variant === 'primary'
                    ? `0 10px 26px ${withAlpha(spatialCareColors.cyanDeep, 0.28)}`
                    : '0 8px 18px rgba(4,8,24,0.22)',
              } as unknown as ViewStyle)
            : null),
        },
        label: {
          color:
            variant === 'primary' || !onDarkSurface
              ? spatialCareColors.nightDeep
              : spatialCare.textOnNight,
          fontSize: Platform.OS === 'web' ? 16 : scaleFontSize(16),
          lineHeight: Platform.OS === 'web' ? 21 : scaleFontSize(21),
          fontWeight: '800',
          textAlign: 'center',
        },
      }),
    [fullWidth, height, onDarkSurface, scaleFontSize, size, variant],
  );

  const content = (
    <LlganGlassShell kind="button" style={[localStyles.button, isDisabled && styles.disabled, style]}>
      {variant === 'primary' ? (
        <LinearGradient
          colors={['#8A78C4', '#55DDF6', '#D8C8E8']}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : variant === 'secondary' ? (
        <LinearGradient
          colors={['rgba(105,232,255,0.14)', 'rgba(139,124,255,0.1)']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      {loading ? (
        <ActivityIndicator
          color={
            variant === 'primary' || !onDarkSurface
              ? spatialCareColors.nightDeep
              : spatialCareColors.white
          }
        />
      ) : (
        <Text allowFontScaling style={localStyles.label}>{title}</Text>
      )}
    </LlganGlassShell>
  );

  return (
    <Animated.View style={[animatedStyle, fullWidth && styles.fullWidth]} pointerEvents="box-none">
      <Pressable
        disabled={isDisabled}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        testID={testID}
        style={Platform.OS === 'web' ? ({ cursor: isDisabled ? 'default' : 'pointer' } as ViewStyle) : undefined}
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
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.42 },
});
