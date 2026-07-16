import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { resolveLightPrimaryButtonStyle } from '@/design/tokens/accentContrast';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';

type CareLightButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  accentColor?: string;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
  testID?: string;
};

export function CareLightButton({
  title,
  onPress,
  variant = 'primary',
  accentColor = careLightColors.orange,
  loading = false,
  disabled = false,
  style,
  accessibilityLabel,
  testID,
}: CareLightButtonProps) {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const primaryStyle = isPrimary ? resolveLightPrimaryButtonStyle(accentColor) : null;

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        isPrimary && {
          backgroundColor: primaryStyle!.backgroundColor,
          borderWidth: 1,
          borderColor: primaryStyle!.borderColor,
        },
        isSecondary && styles.secondary,
        variant === 'ghost' && styles.ghost,
        pressed && !disabled && !loading && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: disabled || loading }}
      testID={testID}
    >
      <Text
        style={[
          styles.label,
          isPrimary && { color: primaryStyle!.color },
          (isSecondary || variant === 'ghost') && { color: careLightColors.text },
        ]}
      >
        {loading ? '…' : title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: careRadius.md,
    paddingHorizontal: careSpacing.md,
    paddingVertical: careSpacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  secondary: {
    backgroundColor: careLightColors.surface,
    borderWidth: 1,
    borderColor: careLightColors.borderStrong,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    ...careTypography.bodyStrong,
    fontWeight: '700',
  },
  labelPrimary: {
    color: careLightColors.surface,
  },
});
