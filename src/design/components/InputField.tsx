import { useMemo } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import {
  lightLiquidGlassWebFx,
  useAuroraAdaptiveText,
  useAuroraGlassActive,
} from '@/design/tokens/auroraGlass';
import { useAuthFlowTypography } from '@/design/tokens/authTypography';
import { galaxyPalette } from '@/design/tokens/galaxy';
import { resolveLlganViewGlass } from '@/design/tokens/lightLiquidGlassAuroraNebula';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { useLegacyTheme } from '@/design/tokens/themeBridge';

type InputFieldProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
};

/** Auth / form input — LLGAN milchglas on light aurora, dark glass fallback. */
export function InputField({ label, hint, error, style, ...props }: InputFieldProps) {
  const type = useAuthFlowTypography();
  const text = useAuroraAdaptiveText();
  const auroraActive = useAuroraGlassActive();
  const { isLight } = useLegacyTheme();
  const loginGlass = resolveLlganViewGlass('login', 'strong');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          gap: careSpacing.xs,
          minWidth: 0,
        },
        label: {
          flexShrink: 0,
        },
        input: {
          minHeight: 48,
          borderRadius: careRadius.lg,
          borderWidth: 1,
          paddingHorizontal: careSpacing.md,
          paddingVertical: careSpacing.sm,
          fontSize: 15,
        },
        inputLight: {
          borderColor: loginGlass.borderAccent,
          backgroundColor: loginGlass.input,
          color: text.primary,
          ...(Platform.OS === 'web'
            ? (lightLiquidGlassWebFx(loginGlass.blurButton, loginGlass.saturateButton) as ViewStyle)
            : null),
        },
        inputDark: {
          borderColor: galaxyPalette.borderGlass,
          backgroundColor: 'rgba(255,255,255,0.04)',
          color: galaxyPalette.textPrimary,
        },
        inputError: {
          borderColor: galaxyPalette.danger,
        },
        hint: {
          flexShrink: 1,
          color: text.muted,
        },
        error: {
          fontSize: 12,
          lineHeight: 16,
          color: galaxyPalette.danger,
          flexShrink: 1,
        },
      }),
    [loginGlass, text.muted, text.primary],
  );

  const useLightInput = auroraActive && isLight;
  const placeholderColor = useLightInput ? text.muted : galaxyPalette.textMuted;

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text style={[type.label, styles.label]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={placeholderColor}
        style={[
          styles.input,
          useLightInput ? styles.inputLight : styles.inputDark,
          error ? styles.inputError : null,
          style,
        ]}
        {...props}
      />
      {error ? (
        <Text style={styles.error} numberOfLines={2}>
          {error}
        </Text>
      ) : null}
      {hint && !error ? (
        <Text style={[type.caption, styles.hint]} numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
