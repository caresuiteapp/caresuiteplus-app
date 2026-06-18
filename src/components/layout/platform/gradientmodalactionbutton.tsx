import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { galaxyGradients } from '@/design/tokens/galaxy';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';

export type GradientModalActionButtonVariant = 'primary' | 'glass' | 'danger';

export type GradientModalActionButtonProps = {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  variant?: GradientModalActionButtonVariant;
};

export function GradientModalActionButton({
  title,
  onPress,
  loading = false,
  variant = 'glass',
}: GradientModalActionButtonProps) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';

  return (
    <Pressable
      onPress={loading ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        (variant === 'glass' || isDanger) && styles.glass,
        isDanger && styles.danger,
        pressed && styles.pressed,
        loading && styles.loading,
      ]}
      accessibilityRole="button"
    >
      {isPrimary ? (
        <LinearGradient
          colors={[...galaxyGradients.primaryCta]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <Text style={styles.label}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    paddingHorizontal: careSpacing.sm + 2,
    paddingVertical: careSpacing.xs + 2,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  glass: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.28)',
  },
  danger: {
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderColor: 'rgba(239,68,68,0.45)',
  },
  pressed: {
    opacity: 0.88,
  },
  loading: {
    opacity: 0.7,
  },
  label: {
    ...careTypography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
