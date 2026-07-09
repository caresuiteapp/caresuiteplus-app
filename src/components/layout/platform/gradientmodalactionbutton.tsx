import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useAuroraAdaptiveText,
  useAuroraGlassActive,
  useAuroraGlassButtonStyles,
} from '@/design/tokens/auroraGlass';
import { galaxyGradients } from '@/design/tokens/galaxy';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';

export type GradientModalActionButtonVariant = 'primary' | 'glass' | 'danger' | 'secondary';

export type GradientModalActionButtonProps = {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: GradientModalActionButtonVariant;
};

export function GradientModalActionButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'glass',
}: GradientModalActionButtonProps) {
  const { isLight } = useLegacyTheme();
  const auroraActive = useAuroraGlassActive();
  const shellHostsAurora = useShellHostsAurora();
  const lightModal = isLight && auroraActive && shellHostsAurora;
  const text = useAuroraAdaptiveText();
  const glassButtons = useAuroraGlassButtonStyles({ viewContext: 'form' });

  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isSecondary = variant === 'secondary' || variant === 'glass';

  const labelColor = lightModal
    ? isPrimary
      ? '#000000'
      : isDanger
        ? '#B91C1C'
        : text.primary
    : '#000000';

  return (
    <Pressable
      onPress={loading || disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        lightModal && isSecondary && !isDanger && glassButtons.secondary,
        lightModal && isDanger && styles.dangerLight,
        !lightModal && (variant === 'glass' || isDanger) && styles.glassDark,
        !lightModal && isDanger && styles.dangerDark,
        pressed && styles.pressed,
        (loading || disabled) && styles.loading,
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
        <ActivityIndicator color={labelColor} size="small" />
      ) : (
        <Text style={[styles.label, { color: labelColor }, lightModal && isSecondary && glassButtons.secondaryText]}>
          {title}
        </Text>
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
  glassDark: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.28)',
  },
  dangerDark: {
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderColor: 'rgba(239,68,68,0.45)',
  },
  dangerLight: {
    backgroundColor: 'rgba(254,226,226,0.72)',
    borderColor: 'rgba(239,68,68,0.35)',
  },
  pressed: {
    opacity: 0.88,
  },
  loading: {
    opacity: 0.7,
  },
  label: {
    ...careTypography.caption,
    fontWeight: '700',
  },
});
