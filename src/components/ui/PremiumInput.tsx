import { useMemo } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useAuroraGlass } from '@/design/tokens/auroraGlass';
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
  const { colors, active, tokens } = useAuroraGlass();

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
          borderColor: active ? tokens.border : colors.borderStrong,
          backgroundColor: active ? tokens.input : colors.bgInput,
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
    [active, colors, tokens.border, tokens.input],
  );

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}
