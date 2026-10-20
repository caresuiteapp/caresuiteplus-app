import { useMemo } from "react";
import { Platform, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useLegacyTheme } from "@/design/tokens/themeBridge";
import { withAlpha } from "@/design/tokens/motion";
import type { LlganViewContext } from "@/design/tokens/lightLiquidGlassAuroraNebula";
import { systemLiquidGlass } from "@/design/tokens/systemLiquidGlass";
import {
  portalPremium,
  usePortalPremiumTheme,
} from "@/design/tokens/portalPremium";
import {
  lightLiquidGlass,
  lightLiquidGlassWebFx,
  lightSurfaceText,
} from "@/design/tokens/auroraGlass";
import { useSurfaceContrastTone } from "@/design/tokens/surfaceContrast";
import { resolveUserFacingSubtitle } from "@/lib/ui/uiVisibility";
import { radius, spacing } from "@/theme";
import { useDeviceClass } from "@/hooks/useDeviceClass";

type SectionPanelProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  headerAlign?: "left" | "center";
  headerVariant?: "default" | "hero";
  accentColor?: string;
  fillHeight?: boolean;
  surface?: "glass" | "open";
  viewContext?: LlganViewContext;
  /** Erzwingt einen konsistent dunklen, kontrastreichen Formularbereich. */
  onDarkSurface?: boolean;
};

export function SectionPanel({
  title,
  subtitle,
  children,
  headerAlign = "left",
  headerVariant = "default",
  accentColor,
  fillHeight = false,
  surface = "glass",
  viewContext,
  onDarkSurface = false,
}: SectionPanelProps) {
  const { colors, typography } = useLegacyTheme();
  const portal = usePortalPremiumTheme();
  const { isPhone } = useDeviceClass();
  const surfaceTone = useSurfaceContrastTone();
  const forceLightSurface = !onDarkSurface && surfaceTone === "light";
  const openSurface = surface === "open";
  const nativePortalSection = portal.active && isPhone;
  const effectiveOpenSurface = openSurface || nativePortalSection;
  const moduleAccent = accentColor ?? colors.cyan;
  const userSubtitle = resolveUserFacingSubtitle(subtitle);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        panel: {
          width: "100%",
          borderRadius: effectiveOpenSurface ? 0 : radius.lg,
          borderWidth: effectiveOpenSurface ? 0 : 1,
          borderColor: onDarkSurface
            ? "rgba(105, 215, 255, 0.48)"
            : withAlpha(moduleAccent, 0.44),
          backgroundColor: effectiveOpenSurface
            ? "transparent"
            : onDarkSurface
              ? "#0A2747"
              : portal.active
                ? portalPremium.surface
                : forceLightSurface
                  ? lightLiquidGlass.panel
                  : systemLiquidGlass.panel,
          overflow: fillHeight ? "visible" : "hidden",
          position: "relative",
          ...(effectiveOpenSurface || Platform.OS !== "web"
            ? null
            : ({
                ...(forceLightSurface
                  ? lightLiquidGlassWebFx()
                  : {
                      backdropFilter: `blur(${systemLiquidGlass.blur.desktop}px) saturate(${systemLiquidGlass.saturate})`,
                      WebkitBackdropFilter: `blur(${systemLiquidGlass.blur.desktop}px) saturate(${systemLiquidGlass.saturate})`,
                      boxShadow: onDarkSurface
                        ? "0 12px 28px rgba(0, 8, 24, 0.28)"
                        : portal.active
                          ? portalPremium.shadow.card
                          : systemLiquidGlass.shadowSoft,
                    }),
              } as unknown as ViewStyle)),
          ...(fillHeight ? { flexGrow: 1, width: "100%" } : null),
        },
        innerBorder: {
          ...StyleSheet.absoluteFill,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: onDarkSurface
            ? "rgba(196, 235, 255, 0.12)"
            : portal.active
              ? portalPremium.innerBorder
              : forceLightSurface
                ? lightLiquidGlass.innerBorder
                : systemLiquidGlass.innerBorder,
        },
        header: {
          paddingHorizontal: nativePortalSection ? spacing.xs : spacing.md,
          paddingTop: headerVariant === "hero" ? spacing.lg : spacing.md,
          paddingBottom: headerVariant === "hero" ? spacing.md : spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: onDarkSurface
            ? "rgba(105, 215, 255, 0.34)"
            : withAlpha(moduleAccent, 0.32),
          alignItems: headerAlign === "center" ? "center" : "flex-start",
        },
        title: {
          ...(headerVariant === "hero" ? typography.h1 : typography.h3),
          color: onDarkSurface
            ? "#FFFFFF"
            : portal.active
              ? portalPremium.text.primary
              : forceLightSurface
                ? lightSurfaceText.primary
                : systemLiquidGlass.text.primary,
          textAlign: headerAlign === "center" ? "center" : "left",
        },
        subtitle: {
          ...(headerVariant === "hero" ? typography.body : typography.caption),
          marginTop: headerVariant === "hero" ? spacing.xs : 4,
          color: onDarkSurface
            ? "#BED6E8"
            : portal.active
              ? portalPremium.text.secondary
              : forceLightSurface
                ? lightSurfaceText.secondary
                : systemLiquidGlass.text.secondary,
          textAlign: headerAlign === "center" ? "center" : "left",
        },
        body: {
          padding: nativePortalSection
            ? spacing.xs
            : fillHeight
              ? spacing.lg
              : spacing.md,
          gap: fillHeight ? spacing.md : spacing.sm,
          width: "100%",
          ...(fillHeight
            ? { flexGrow: 1, alignItems: "stretch" as const }
            : headerAlign === "center"
              ? { alignItems: "center" as const }
              : null),
        },
      }),
    [
      effectiveOpenSurface,
      nativePortalSection,
      typography,
      headerAlign,
      headerVariant,
      moduleAccent,
      fillHeight,
      forceLightSurface,
      portal.active,
      onDarkSurface,
    ],
  );

  return (
    <View
      style={styles.panel}
      {...(Platform.OS === "web"
        ? ({
            dataSet: {
              csHealthosComponent: "section",
              csHealthosSurface: onDarkSurface ? "dark" : "adaptive",
            },
          } as object)
        : {})}
    >
      {!effectiveOpenSurface ? (
        <View style={styles.innerBorder} pointerEvents="none" />
      ) : null}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {userSubtitle ? (
          <Text style={styles.subtitle}>{userSubtitle}</Text>
        ) : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}
