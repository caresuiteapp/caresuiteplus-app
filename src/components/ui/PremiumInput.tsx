import { useMemo } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import {
  useAuroraAdaptiveText,
  useAuroraGlass,
  auroraGlass,
  darkGlassSurfaceText,
  lightLiquidGlassWebFx,
} from '@/design/tokens/auroraGlass';
import {
  resolveLlganViewGlass,
  type LlganViewContext,
} from '@/design/tokens/lightLiquidGlassAuroraNebula';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { radius, spacing, typography } from '@/theme';

type PremiumInputProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
  /** Erzwingt helle Schrift auf dunklem Eingabefeld (auroraGlass.input). */
  onDarkSurface?: boolean;
  /** LLGAN view — `form` in modal dialogs for visible borders on light glass. */
  viewContext?: LlganViewContext;
};

export function PremiumInput({
  label,
  hint,
  error,
  onDarkSurface = false,
  viewContext,
  style,
  ...props
}: PremiumInputProps) {
  const { colors, active, tokens } = useAuroraGlass();
  const { isLight } = useLegacyTheme();
  const adaptiveText = useAuroraAdaptiveText();
  const text = onDarkSurface ? darkGlassSurfaceText : adaptiveText;
  const formGlass = resolveLlganViewGlass(viewContext ?? 'form', 'default');
  const useFormGlass = Boolean(viewContext) && active && isLight && !onDarkSurface;

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
          borderColor: onDarkSurface
            ? auroraGlass.border
            : useFormGlass
              ? formGlass.borderAccent
              : active
                ? tokens.border
                : colors.borderStrong,
          backgroundColor: onDarkSurface
            ? auroraGlass.input
            : useFormGlass
              ? formGlass.input
              : active
                ? tokens.input
                : colors.bgInput,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          color: text.primary,
          fontSize: 15,
          ...(Platform.OS === 'web' && useFormGlass
            ? lightLiquidGlassWebFx(formGlass.blurButton, formGlass.saturateButton)
            : {}),
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
    [
      active,
      colors.danger,
      colors.borderStrong,
      colors.bgInput,
      formGlass.borderAccent,
      formGlass.input,
      onDarkSurface,
      text.muted,
      text.primary,
      tokens.border,
      tokens.input,
      useFormGlass,
    ],
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
