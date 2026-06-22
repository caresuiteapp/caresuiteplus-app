import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { neonGlow, withAlpha } from '@/design/tokens/motion';
import { useAccessibility } from '@/hooks/useAccessibility';
import { buttonHeights, motion, radius } from '@/theme';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';

type Variant = 'primary' | 'success' | 'danger';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
};

const GRADIENTS: Record<Variant, readonly [string, string, ...string[]]> = {
  primary: careSuiteAuroraTheme.gradients.buttonPrimary,
  success: careSuiteAuroraTheme.gradients.buttonSuccess,
  danger: careSuiteAuroraTheme.gradients.buttonDanger,
};

export function AuroraGradientButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  fullWidth = false,
}: Props) {
  const { typography } = useLegacyTheme();
  const { scaleFontSize } = useAccessibility();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isDisabled = disabled || loading;
  const colors = GRADIENTS[variant];

  const labelStyle =
    Platform.OS === 'web'
      ? { fontSize: typography.button.fontSize ?? 16, lineHeight: typography.button.lineHeight ?? 22 }
      : { fontSize: scaleFontSize(16), lineHeight: scaleFontSize(22) };

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
        <View
          style={[
            styles.inner,
            { height: buttonHeights.md },
            fullWidth && styles.fullWidth,
            isDisabled && styles.disabled,
            neonGlow(careSuiteAuroraTheme.accent.violet, 0.35, 20, 10),
            style,
          ]}
        >
          <LinearGradient colors={[...colors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text allowFontScaling style={[typography.button, labelStyle, styles.label]}>
              {label}
            </Text>
          )}
        </View>
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
    minWidth: 120,
    borderWidth: 1,
    borderColor: withAlpha('#FFFFFF', 0.12),
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
  label: { color: '#FFFFFF', fontWeight: '700' },
});
