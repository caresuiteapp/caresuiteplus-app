import { useMemo } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useAuroraAdaptiveText, useAuroraGlass, auroraGlass, darkGlassSurfaceText } from '@/design/tokens/auroraGlass';
import { radius, spacing, typography } from '@/theme';

type PremiumInputProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
  /** Erzwingt helle Schrift auf dunklem Eingabefeld (auroraGlass.input). */
  onDarkSurface?: boolean;
};

export function PremiumInput({
  label,
  hint,
  error,
  onDarkSurface = false,
  style,
  ...props
}: PremiumInputProps) {
  const { colors, active, tokens } = useAuroraGlass();
  const adaptiveText = useAuroraAdaptiveText();
  const text = onDarkSurface ? darkGlassSurfaceText : adaptiveText;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          gap: spacing.xs,
        },
        label: {
          ...typography.label,
          color: text.primary,
        },
        input: {
          minHeight: 48,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: onDarkSurface ? auroraGlass.border : active ? tokens.border : colors.borderStrong,
          backgroundColor: onDarkSurface ? auroraGlass.input : active ? tokens.input : colors.bgInput,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          color: text.primary,
          fontSize: 15,
        },
        inputError: {
          borderColor: colors.danger,
        },
        hint: {
          ...typography.caption,
          color: text.muted,
        },
        error: {
          ...typography.caption,
          color: colors.danger,
        },
      }),
    [active, colors.danger, onDarkSurface, text.muted, text.primary, tokens.border, tokens.input],
  );

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={text.muted}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}
