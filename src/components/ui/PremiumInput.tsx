import { useMemo } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import {
  darkGlassSurfaceText,
  lightSurfaceText,
} from '@/design/tokens/auroraGlass';
import type { LlganViewContext } from '@/design/tokens/lightLiquidGlassAuroraNebula';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { systemLiquidGlass } from '@/design/tokens/systemLiquidGlass';
import { portalPremium, usePortalPremiumTheme } from '@/design/tokens/portalPremium';
import { radius, spacing, typography } from '@/theme';

type PremiumInputProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
  /** Erzwingt helle Schrift auf dunklem Eingabefeld (auroraGlass.input). */
  onDarkSurface?: boolean;
  /** Erzwingt dunkle, kontrastreiche Schrift auf einer hellen Arbeitsfläche. */
  onLightSurface?: boolean;
  /** LLGAN view — `form` in modal dialogs for visible borders on light glass. */
  viewContext?: LlganViewContext;
};

export function PremiumInput({
  label,
  hint,
  error,
  onDarkSurface = false,
  onLightSurface = false,
  viewContext,
  style,
  onChangeText,
  ...props
}: PremiumInputProps) {
  const { colors } = useLegacyTheme();
  const portal = usePortalPremiumTheme();
  const lightSurface = portal.active || onLightSurface;
  const text = lightSurface
    ? lightSurfaceText
    : onDarkSurface
      ? darkGlassSurfaceText
      : {
          primary: systemLiquidGlass.text.primary,
          secondary: systemLiquidGlass.text.secondary,
          muted: systemLiquidGlass.text.muted,
        };

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
          borderColor: lightSurface
            ? portal.active
              ? portalPremium.borderStrong
              : colors.borderStrong
            : systemLiquidGlass.borderStrong,
          backgroundColor: lightSurface
            ? portal.active
              ? portalPremium.surfaceRaised
              : colors.bgInput
            : systemLiquidGlass.input,
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
    [
      colors.danger,
      colors.borderStrong,
      colors.bgInput,
      lightSurface,
      portal.active,
      text.muted,
      text.primary,
    ],
  );

  return (
    <View
      style={styles.wrapper}
      {...(Platform.OS === 'web'
        ? ({
            dataSet: {
              csHealthosComponent: 'input',
              csHealthosContext: viewContext ?? 'default',
            },
          } as object)
        : {})}
    >
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={text.muted}
        style={[styles.input, error ? styles.inputError : null, style]}
        onChangeText={onChangeText}
        {...(Platform.OS === 'web'
          ? {
              onChange: (event) => {
                const value =
                  typeof event?.nativeEvent?.text === 'string'
                    ? event.nativeEvent.text
                    : ((event as unknown as { target?: { value?: string } }).target?.value ?? '');
                onChangeText?.(value);
              },
            }
          : {})}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}
