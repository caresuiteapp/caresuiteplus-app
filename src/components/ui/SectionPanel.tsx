import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  useAuroraAdaptiveText,
  useAuroraGlassActive,
  useAuroraGlassPanelStyle,
} from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { withAlpha } from '@/design/tokens/motion';
import type { LlganViewContext } from '@/design/tokens/lightLiquidGlassAuroraNebula';
import { resolveUserFacingSubtitle } from '@/lib/ui/uiVisibility';
import { radius, spacing } from '@/theme';

type SectionPanelProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Center header title and subtitle (e.g. Zentrale dashboard). */
  headerAlign?: 'left' | 'center';
  /** Larger hero-style header typography. */
  headerVariant?: 'default' | 'hero';
  /** Module accent — tints panel border and header divider. */
  accentColor?: string;
  /** Stretch panel + body to fill parent height (Zentrale module grid). */
  fillHeight?: boolean;
  /** `open` = kein Milchglas-Panel, Nebula bleibt sichtbar (Zentrale KPI-Grid). */
  surface?: 'glass' | 'open';
  /** LLGAN view — use `form` inside modal dialogs for readable nested panels. */
  viewContext?: LlganViewContext;
};

export function SectionPanel({
  title,
  subtitle,
  children,
  headerAlign = 'left',
  headerVariant = 'default',
  accentColor,
  fillHeight = false,
  surface = 'glass',
  viewContext,
}: SectionPanelProps) {
  const { colors, typography, isDark, isLight } = useLegacyTheme();
  const text = useAuroraAdaptiveText();
  const auroraActive = useAuroraGlassActive();
  const glassPanelStyle = useAuroraGlassPanelStyle({
    intensity: 'default',
    viewContext,
  });
  const openSurface = surface === 'open';
  const glassSurface = !openSurface && (isDark || auroraActive);
  const moduleAccent = accentColor ?? colors.cyan;
  const lightGlassShell = !openSurface && isLight && auroraActive;
  const userSubtitle = resolveUserFacingSubtitle(subtitle);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        panel: {
          width: '100%',
          borderRadius: openSurface ? 0 : radius.lg,
          borderWidth: openSurface ? 0 : 1,
          borderColor: withAlpha(moduleAccent, auroraActive ? 0.38 : isDark ? 0.45 : 0.35),
          backgroundColor: openSurface
            ? 'transparent'
            : auroraActive
              ? 'transparent'
              : isDark
                ? 'transparent'
                : colors.bgSurface,
          overflow: fillHeight ? 'visible' : 'hidden',
          position: 'relative',
          ...(fillHeight ? { flexGrow: 1, width: '100%' } : null),
        },
        innerBorder: {
          ...StyleSheet.absoluteFillObject,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.72)',
        },
        header: {
          paddingHorizontal: spacing.md,
          paddingTop: headerVariant === 'hero' ? spacing.lg : spacing.md,
          paddingBottom: headerVariant === 'hero' ? spacing.md : spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: withAlpha(moduleAccent, glassSurface ? 0.35 : 0.25),
          alignItems: headerAlign === 'center' ? 'center' : 'flex-start',
        },
        title: {
          ...(headerVariant === 'hero' ? typography.h1 : typography.h3),
          color: text.primary,
          textAlign: headerAlign === 'center' ? 'center' : 'left',
        },
        subtitle: {
          ...(headerVariant === 'hero' ? typography.body : typography.caption),
          marginTop: headerVariant === 'hero' ? spacing.xs : 4,
          color: lightGlassShell ? text.primary : text.secondary,
          textAlign: headerAlign === 'center' ? 'center' : 'left',
        },
        body: {
          padding: fillHeight ? spacing.lg : spacing.md,
          gap: fillHeight ? spacing.md : spacing.sm,
          width: '100%',
          ...(fillHeight
            ? { flexGrow: 1, alignItems: 'stretch' as const }
            : headerAlign === 'center'
              ? { alignItems: 'center' as const }
              : null),
        },
      }),
    [
      auroraActive,
      colors.bgSurface,
      glassSurface,
      isDark,
      isLight,
      openSurface,
      lightGlassShell,
      text.primary,
      text.secondary,
      typography.caption,
      typography.h3,
      typography.h1,
      typography.body,
      headerAlign,
      headerVariant,
      moduleAccent,
      surface,
      fillHeight,
    ],
  );

  return (
    <View style={[styles.panel, lightGlassShell ? glassPanelStyle : null]}>
      {glassSurface && !lightGlassShell ? (
        <View style={styles.innerBorder} pointerEvents="none" />
      ) : null}
      {lightGlassShell ? <View style={styles.innerBorder} pointerEvents="none" /> : null}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {userSubtitle ? <Text style={styles.subtitle}>{userSubtitle}</Text> : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}
