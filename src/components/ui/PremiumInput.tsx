import { useMemo } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
} from "react-native";
import { lightSurfaceText } from "@/design/tokens/auroraGlass";
import type { LlganViewContext } from "@/design/tokens/lightLiquidGlassAuroraNebula";
import { useLegacyTheme } from "@/design/tokens/themeBridge";
import { systemLiquidGlass } from "@/design/tokens/systemLiquidGlass";
import {
  portalPremium,
  usePortalPremiumTheme,
} from "@/design/tokens/portalPremium";
import { useSurfaceContrastTone } from "@/design/tokens/surfaceContrast";
import { radius, spacing, typography } from "@/theme";

type PremiumInputProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
  onDarkSurface?: boolean;
  onLightSurface?: boolean;
  viewContext?: LlganViewContext;
  sensitiveBusinessValue?: boolean;
};

export function PremiumInput({
  label,
  hint,
  error,
  onDarkSurface = false,
  onLightSurface = false,
  viewContext,
  sensitiveBusinessValue = false,
  style,
  onChangeText,
  ...props
}: PremiumInputProps) {
  const { colors } = useLegacyTheme();
  const portal = usePortalPremiumTheme();
  const surfaceTone = useSurfaceContrastTone();
  const lightSurface =
    !onDarkSurface &&
    (portal.active || onLightSurface || surfaceTone === "light");
  const text = onDarkSurface
    ? { primary: "#FFFFFF", secondary: "#D6E8F6", muted: "#91ACC3" }
    : lightSurface
      ? lightSurfaceText
      : {
          primary: systemLiquidGlass.text.primary,
          secondary: systemLiquidGlass.text.secondary,
          muted: systemLiquidGlass.text.muted,
        };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: { gap: spacing.xs },
        label: {
          ...typography.label,
          color: text.primary,
          fontWeight: onDarkSurface ? "800" : typography.label.fontWeight,
        },
        input: {
          minHeight: 48,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: onDarkSurface
            ? "rgba(119, 207, 250, 0.48)"
            : lightSurface
              ? portal.active
                ? portalPremium.borderStrong
                : colors.borderStrong
              : systemLiquidGlass.borderStrong,
          backgroundColor: onDarkSurface
            ? "#071A31"
            : lightSurface
              ? portal.active
                ? portalPremium.surfaceRaised
                : colors.bgInput
              : systemLiquidGlass.input,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          color: text.primary,
          fontSize: 15,
          fontWeight: onDarkSurface ? "600" : "400",
        },
        inputError: { borderColor: colors.danger },
        hint: { ...typography.caption, color: text.muted },
        error: { ...typography.caption, color: colors.danger },
      }),
    [colors, lightSurface, onDarkSurface, portal.active, text],
  );

  return (
    <View
      style={styles.wrapper}
      {...(Platform.OS === "web"
        ? ({
            dataSet: {
              csHealthosComponent: "input",
              csHealthosContext: viewContext ?? "default",
              csHealthosSurface: onDarkSurface ? "dark" : "adaptive",
            },
          } as object)
        : {})}
    >
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={text.muted}
        {...(Platform.OS === "web"
          ? ({
              dataSet: {
                csHealthosComponent: "input-control",
                csHealthosSurface: onDarkSurface ? "dark" : "adaptive",
              },
            } as object)
          : {})}
        style={[
          styles.input,
          error ? styles.inputError : null,
          sensitiveBusinessValue && Platform.OS === "web"
            ? ({ WebkitTextSecurity: "disc" } as unknown as TextStyle)
            : null,
          style,
        ]}
        onChangeText={onChangeText}
        {...(Platform.OS === "web"
          ? {
              onChange: (event) => {
                const value =
                  typeof event?.nativeEvent?.text === "string"
                    ? event.nativeEvent.text
                    : ((event as unknown as { target?: { value?: string } })
                        .target?.value ?? "");
                onChangeText?.(value);
              },
            }
          : {})}
        {...props}
        {...(sensitiveBusinessValue
          ? ({
              autoComplete: "off",
              importantForAutofill: "no",
              textContentType: "none",
              ...(Platform.OS === "web"
                ? {
                    name: `caresuite-business-value-${props.nativeID ?? "input"}`,
                    "data-1p-ignore": "true",
                    "data-lpignore": "true",
                    "data-form-type": "other",
                  }
                : {}),
            } as TextInputProps)
          : {})}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}
