import { useMemo } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { useGlassInputStyle } from '@/design/tokens/carelightadaptive';
import { radius, spacing, typography } from '@/theme';

type PremiumInputProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
};

export function PremiumInput({
  label,
  hint,
  error,
  style,
  ...props
}: PremiumInputProps) {
  const { colors } = useLegacyTheme();
  const glassInput = useGlassInputStyle();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          gap: spacing.xs,
        },
        label: {
          ...typography.label,
          color: colors.textPrimary,
        },
        input: {
          minHeight: 48,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.bgInput,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          color: colors.textPrimary,
          fontSize: 15,
        },
        inputError: {
          borderColor: colors.danger,
        },
        hint: {
          ...typography.caption,
          color: colors.textMuted,
        },
        error: {
          ...typography.caption,
          color: colors.danger,
        },
      }),
    [colors],
  );

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, glassInput, error ? styles.inputError : null, style]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}
