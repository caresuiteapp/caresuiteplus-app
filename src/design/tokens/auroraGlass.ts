import { useMemo } from 'react';
import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { llgsTypography } from '@/design/tokens/lightLiquidGlassSpace';
import {
  resolveLlganGlassSurface,
  resolveLlganViewGlass,
  type LightSpaceIntensity,
  type LlganViewContext,
} from '@/design/tokens/lightLiquidGlassAuroraNebula';
import { careSuiteModalScrim } from '@/design/tokens/lightTheme';
import { ensureLightLiquidGlassSurfaceCss } from '@/design/web/ensureLightLiquidGlassSurfaceCss';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { systemLiquidGlass } from './systemLiquidGlass';
import { portalPremium, usePortalPremiumTheme } from './portalPremium';
import { useSurfaceContrastTone } from './surfaceContrast';

function resolveSurfaceIsLight(
  tone: ReturnType<typeof useSurfaceContrastTone>,
  fallback: boolean,
): boolean {
  if (tone === 'light') return true;
  if (tone === 'dark') return false;
  return fallback;
}

/**
 * Shell glass surface tokens — always light milchglas over the space backdrop.
 */
export type SurfaceContrastText = {
  primary: string;
  secondary: string;
  muted: string;
};

/** Dunkle Schrift auf hellen/weißen Flächen. */
export const lightSurfaceText: SurfaceContrastText = {
  primary: llgsTypography.primary,
  secondary: llgsTypography.secondary,
  muted: llgsTypography.muted,
};

/** Readable typography for the canonical dark spatial glass surfaces. */
export const darkGlassSurfaceText: SurfaceContrastText = {
  primary: systemLiquidGlass.text.primary,
  secondary: systemLiquidGlass.text.secondary,
  muted: systemLiquidGlass.text.muted,
};

/** WCAG-kontrastfähiger Orange-/Amber-Ton für Links/CTAs auf hellen Portal-Flächen (≥4.5:1). */
export const PORTAL_LIGHT_LINK_ORANGE = '#B45309';

export function surfaceContrastText(isDarkBackground: boolean): SurfaceContrastText {
  return isDarkBackground ? darkGlassSurfaceText : lightSurfaceText;
}

/** Frosted milchglas — Liquid Glass über hellem Space-Aurora-Hintergrund. */
const llganDefaultSurface = resolveLlganGlassSurface('default');
const llganSubtleSurface = resolveLlganGlassSurface('subtle');

export const lightLiquidGlass = {
  page: 'transparent',
  panel: llganDefaultSurface.panel,
  card: llganDefaultSurface.card,
  sidebar: llganDefaultSurface.sidebar,
  elevated: 'rgba(255,255,255,0.30)',
  modal: llganDefaultSurface.modal,
  input: llganSubtleSurface.input,
  chip: llganSubtleSurface.chip,
  chipActive: 'rgba(130,170,255,0.16)',
  table: llganSubtleSurface.panel,
  row: 'transparent',
  rowHover: 'rgba(15,27,51,0.04)',
  rowAlt: 'rgba(15,27,51,0.02)',
  rowSelected: 'rgba(139, 92, 246, 0.10)',
  header: 'rgba(15,27,51,0.03)',
  listItem: 'rgba(15,27,51,0.03)',
  border: llganDefaultSurface.borderWhite,
  borderAccent: llganDefaultSurface.borderAccent,
  borderStrong: 'rgba(130,170,255,0.28)',
  innerBorder: 'rgba(255,255,255,0.68)',
  blur: {
    light: llganSubtleSurface.blurMobile,
    medium: llganDefaultSurface.blurDesktop,
    heavy: llganDefaultSurface.blurDesktop + 4,
  },
  text: {
    primary: llgsTypography.primary,
    secondary: llgsTypography.secondary,
    muted: llgsTypography.muted,
  },
  shadow: llganDefaultSurface.shadow,
  shadowInset: llganDefaultSurface.shadowInset,
  saturate: llganDefaultSurface.saturate,
} as const;

/** Canonical dark spatial glass used by Office, Assist, auth and portals. */
export const auroraGlass = {
  ...lightLiquidGlass,
  panel: systemLiquidGlass.panel,
  card: systemLiquidGlass.card,
  sidebar: systemLiquidGlass.panelStrong,
  elevated: systemLiquidGlass.pageElevated,
  modal: systemLiquidGlass.panelStrong,
  input: systemLiquidGlass.input,
  chip: systemLiquidGlass.chip,
  chipActive: systemLiquidGlass.chipActive,
  table: systemLiquidGlass.table,
  rowHover: systemLiquidGlass.rowHover,
  rowAlt: systemLiquidGlass.rowAlt,
  rowSelected: systemLiquidGlass.rowSelected,
  header: systemLiquidGlass.rowAlt,
  listItem: systemLiquidGlass.rowAlt,
  border: systemLiquidGlass.border,
  borderAccent: systemLiquidGlass.borderActive,
  borderStrong: systemLiquidGlass.borderStrong,
  innerBorder: systemLiquidGlass.innerBorder,
  blur: {
    light: systemLiquidGlass.blur.mobile,
    medium: systemLiquidGlass.blur.desktop,
    heavy: systemLiquidGlass.blur.modal,
  },
  text: darkGlassSurfaceText,
  shadow: systemLiquidGlass.shadow,
  shadowInset: systemLiquidGlass.shadowInset,
  saturate: systemLiquidGlass.saturate,
} as const;

/**
 * Opaque premium surfaces used inside both portal shells.
 *
 * The portal backdrop is intentionally dark, but its working areas follow the
 * bright dashboard language. Reusing translucent LLGAN tokens here lets the
 * backdrop bleed through and turns otherwise light pages grey. Keep this token
 * shape identical to the glass contracts so legacy calendar, messenger and
 * workflow components can participate without page-specific overrides.
 */
export const portalPremiumGlass = {
  ...lightLiquidGlass,
  panel: portalPremium.surfaceRaised,
  card: portalPremium.surface,
  sidebar: portalPremium.surfaceRaised,
  elevated: portalPremium.surfaceRaised,
  modal: portalPremium.surfaceRaised,
  input: portalPremium.surfaceRaised,
  chip: portalPremium.surfaceSoft,
  chipActive: portalPremium.surfaceMuted,
  table: portalPremium.surfaceRaised,
  rowHover: '#EDF6FF',
  rowAlt: '#F4F9FF',
  rowSelected: portalPremium.surfaceMuted,
  header: portalPremium.surfaceSoft,
  listItem: '#F4F9FF',
  border: portalPremium.borderSoft,
  borderAccent: portalPremium.borderStrong,
  borderStrong: portalPremium.border,
  innerBorder: portalPremium.borderSoft,
  blur: { light: 0, medium: 0, heavy: 0 },
  text: portalPremium.text,
  shadow: portalPremium.shadow.card,
  shadowInset: 'inset 0 1px 0 rgba(255,255,255,0.88)',
  saturate: 100,
} as const;

/** RN Web data attribute for global milchglas CSS (see lightLiquidGlassSurfaceCss). */
export type LlganGlassSurfaceKind = 'panel' | 'card' | 'chip' | 'input' | 'button' | 'modal';

export function llganGlassDataSet(kind: LlganGlassSurfaceKind): {
  dataSet?: { csLlganGlass: string };
} {
  if (Platform.OS !== 'web') return {};
  ensureLightLiquidGlassSurfaceCss('strong');
  return { dataSet: { csLlganGlass: kind } };
}

/** Web backdrop-blur + Schatten für Milchglas-Oberflächen. */
export function lightLiquidGlassWebFx(
  blurPx = llganDefaultSurface.blurDesktop,
  saturate = llganDefaultSurface.saturate,
): ViewStyle {
  if (Platform.OS !== 'web') return {};

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const mobileWeb =
    viewportWidth < 768 ||
    (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);

  if (mobileWeb) {
    const mobileBlur = Math.max(18, blurPx - 12);
    return {
      backdropFilter: `blur(${mobileBlur}px) saturate(${saturate})`,
      WebkitBackdropFilter: `blur(${mobileBlur}px) saturate(${saturate})`,
      boxShadow: `${llganDefaultSurface.shadow}, ${llganDefaultSurface.shadowInset}`,
    } as ViewStyle;
  }

  return {
    backdropFilter: `blur(${blurPx}px) saturate(${saturate})`,
    WebkitBackdropFilter: `blur(${blurPx}px) saturate(${saturate})`,
    boxShadow: `${llganDefaultSurface.shadow}, ${llganDefaultSurface.shadowInset}`,
  } as ViewStyle;
}

export type ShellGlassVariant = 'chip' | 'input' | 'panel' | 'card' | 'modal' | 'elevated';

export type ShellGlassIntensityOptions = {
  intensity?: LightSpaceIntensity;
  viewContext?: LlganViewContext;
};

function resolveShellIntensity(
  variant: ShellGlassVariant,
  intensity?: LightSpaceIntensity,
  viewContext?: LlganViewContext,
): LightSpaceIntensity {
  if (intensity) return intensity;
  if (viewContext === 'settings' || viewContext === 'form' || viewContext === 'table') {
    return 'default';
  }
  if (variant === 'chip' || variant === 'input') return 'subtle';
  if (variant === 'card') return viewContext === 'dashboard' ? 'strong' : 'default';
  return 'default';
}

/** Milchglas/Dark-Glass für Shell-Chips (Profil, Suche, Sidebar). */
export function useShellGlassSurfaceStyle(
  variant: ShellGlassVariant = 'chip',
  options: ShellGlassIntensityOptions = {},
): ViewStyle {
  const active = useAuroraGlassActive();
  const { isLight } = useLegacyTheme();
  const portal = usePortalPremiumTheme();
  const surfaceTone = useSurfaceContrastTone();
  const surfaceIsLight = portal.active || resolveSurfaceIsLight(surfaceTone, isLight);
  const intensity = resolveShellIntensity(variant, options.intensity, options.viewContext);
  const llganSurface =
    options.viewContext || variant === 'modal'
      ? resolveLlganViewGlass(options.viewContext ?? 'form', intensity)
      : resolveLlganGlassSurface(intensity);

  return useMemo(() => {
    const light = active && surfaceIsLight && !portal.active;
    const tokens = portal.active ? portalPremiumGlass : light ? lightLiquidGlass : auroraGlass;
    const backgroundColor =
      variant === 'chip'
        ? light
          ? llganSurface.chip
          : tokens.chip
        : variant === 'input'
          ? light
            ? llganSurface.input
            : tokens.input
          : variant === 'panel'
            ? light
              ? llganSurface.panel
              : tokens.panel
            : variant === 'card'
              ? light
                ? llganSurface.card
                : tokens.card
              : variant === 'modal'
                ? light
                  ? llganSurface.modal
                  : tokens.modal
                : tokens.elevated;

    const borderColor = light ? llganSurface.borderAccent : tokens.border;
    const blurPx = light ? llganSurface.blurDesktop : auroraGlass.blur.medium;
    const saturate = light ? llganSurface.saturate : undefined;

    return {
      borderWidth: 1,
      borderColor,
      backgroundColor,
      overflow: Platform.OS === 'web' ? 'visible' : 'hidden',
      ...(light
        ? lightLiquidGlassWebFx(blurPx, saturate)
        : portal.active && Platform.OS === 'web'
          ? ({ boxShadow: portalPremium.shadow.card } as ViewStyle)
          : Platform.OS === 'web'
            ? ({
                backdropFilter: `blur(${blurPx}px)`,
                WebkitBackdropFilter: `blur(${blurPx}px)`,
              } as ViewStyle)
            : null),
    };
  }, [active, llganSurface, portal.active, surfaceIsLight, variant]);
}

export type AuroraGlassTokens = typeof auroraGlass;
export type LightLiquidGlassTokens = typeof lightLiquidGlass;
export type PortalPremiumGlassTokens = typeof portalPremiumGlass;
export type GlassSurfaceTokens =
  | AuroraGlassTokens
  | LightLiquidGlassTokens
  | PortalPremiumGlassTokens;

function resolveActiveGlassTokens(isLight: boolean, isPortal = false): GlassSurfaceTokens {
  if (isPortal) return portalPremiumGlass;
  return isLight ? lightLiquidGlass : auroraGlass;
}

/** True when root shell hosts animated background (light or dark glass). */
export function useAuroraGlassActive(): boolean {
  const shellActive = useShellHostsAurora();
  const portal = usePortalPremiumTheme();
  return portal.active || shellActive;
}

/** Active glass token set — light liquid or dark aurora based on theme mode. */
export function useActiveGlassTokens(): GlassSurfaceTokens {
  const active = useAuroraGlassActive();
  const { isLight } = useLegacyTheme();
  const portal = usePortalPremiumTheme();
  const surfaceTone = useSurfaceContrastTone();
  const surfaceIsLight = portal.active || resolveSurfaceIsLight(surfaceTone, isLight);
  return active ? resolveActiveGlassTokens(surfaceIsLight, portal.active) : lightLiquidGlass;
}

/** Light frosted shell (LLGAN) — dark text on milchglas, matches desktop portal/office. */
export function useLightLiquidGlassShell(): boolean {
  const active = useAuroraGlassActive();
  const { isLight } = useLegacyTheme();
  const portal = usePortalPremiumTheme();
  const surfaceTone = useSurfaceContrastTone();
  return portal.active || (active && resolveSurfaceIsLight(surfaceTone, isLight));
}

/** Composer/input strip on dark glass — false on light LLGAN shell (mobile + desktop). */
export function useComposerDarkSurface(): boolean {
  const active = useAuroraGlassActive();
  const { isDark } = useLegacyTheme();
  const portal = usePortalPremiumTheme();
  const surfaceTone = useSurfaceContrastTone();
  if (surfaceTone === 'light') return false;
  if (surfaceTone === 'dark') return !portal.active && active;
  return !portal.active && active && isDark;
}

export type MessagingGlassSurface = {
  useLightGlass: boolean;
  surfaces: GlassSurfaceTokens;
  onDarkSurface: boolean;
  ink: SurfaceContrastText | null;
};

/** Portal messaging "glass" variant — light surfaces on light theme for readable mobile layout. */
export function useMessagingGlassSurface(isGlassVariant: boolean): MessagingGlassSurface {
  const { isLight } = useLegacyTheme();
  const portal = usePortalPremiumTheme();
  const surfaceTone = useSurfaceContrastTone();
  const useLightSurfaces = portal.active || resolveSurfaceIsLight(surfaceTone, isLight);
  const surfaces = portal.active
    ? portalPremiumGlass
    : useLightSurfaces
      ? lightLiquidGlass
      : auroraGlass;
  const onDarkSurface = !useLightSurfaces;
  const ink = isGlassVariant ? surfaceContrastText(onDarkSurface) : null;
  return { useLightGlass: useLightSurfaces, surfaces, onDarkSurface, ink };
}

/** Adaptive text colors — glass text when shell active, theme palette otherwise. */
export function useAuroraAdaptiveText() {
  const active = useAuroraGlassActive();
  const { colors, isLight } = useLegacyTheme();
  const portal = usePortalPremiumTheme();
  const surfaceTone = useSurfaceContrastTone();
  const surfaceIsLight = portal.active || resolveSurfaceIsLight(surfaceTone, isLight);
  const glass = resolveActiveGlassTokens(surfaceIsLight, portal.active);

  return useMemo(() => {
    if (portal.active) {
      return {
        primary: portalPremium.text.primary,
        secondary: portalPremium.text.secondary,
        muted: portalPremium.text.muted,
        border: portalPremium.borderSoft,
      };
    }
    if (surfaceTone === 'light' || (active && surfaceIsLight)) {
      return {
        primary: lightLiquidGlass.text.primary,
        secondary: lightLiquidGlass.text.secondary,
        muted: lightLiquidGlass.text.muted,
        border: colors.borderSoft,
      };
    }
    if (surfaceTone === 'dark' || active) {
      return {
        primary: glass.text.primary,
        secondary: glass.text.secondary,
        muted: glass.text.muted,
        border: colors.borderSoft,
      };
    }
    return {
      primary: colors.textPrimary,
      secondary: isLight ? colors.textPrimary : colors.textSecondary,
      muted: isLight ? colors.textSecondary : colors.textMuted,
      border: colors.borderSoft,
    };
  }, [
    active,
    colors.borderSoft,
    colors.textMuted,
    colors.textPrimary,
    colors.textSecondary,
    glass.text.muted,
    glass.text.primary,
    glass.text.secondary,
    isLight,
    portal.active,
    surfaceTone,
    surfaceIsLight,
  ]);
}

/** Full glass token set + legacy colors when inactive. */
export function useAuroraGlass() {
  const active = useAuroraGlassActive();
  const { colors, isLight, isDark } = useLegacyTheme();
  const portal = usePortalPremiumTheme();
  const surfaceTone = useSurfaceContrastTone();
  const surfaceIsLight = portal.active || resolveSurfaceIsLight(surfaceTone, isLight);
  const tokens = active ? resolveActiveGlassTokens(surfaceIsLight, portal.active) : auroraGlass;

  return useMemo(
    () => ({
      active,
      isDark: portal.active || surfaceIsLight ? false : isDark,
      isLight: surfaceIsLight,
      tokens,
      colors,
    }),
    [active, colors, isDark, portal.active, surfaceIsLight, tokens],
  );
}

/** Glass panel surface (lists, section wrappers). */
export function useAuroraGlassPanelStyle(options: ShellGlassIntensityOptions = {}): ViewStyle {
  const active = useAuroraGlassActive();
  const { isLight } = useLegacyTheme();
  const portal = usePortalPremiumTheme();
  const surfaceTone = useSurfaceContrastTone();
  const surfaceIsLight = portal.active || resolveSurfaceIsLight(surfaceTone, isLight);
  const intensity = options.intensity ?? 'default';
  const llganSurface =
    options.viewContext && surfaceIsLight
      ? resolveLlganViewGlass(options.viewContext, intensity)
      : resolveLlganGlassSurface(intensity);
  const glass = resolveActiveGlassTokens(surfaceIsLight, portal.active);
  const frosted = surfaceIsLight && !portal.active;

  return useMemo(
    () =>
      active
        ? {
            backgroundColor: frosted ? llganSurface.panel : glass.panel,
            borderColor: frosted ? llganSurface.borderAccent : glass.border,
            borderWidth: 1,
            ...(frosted
              ? lightLiquidGlassWebFx(llganSurface.blurDesktop, llganSurface.saturate)
              : portal.active && Platform.OS === 'web'
                ? ({ boxShadow: portalPremium.shadow.card } as ViewStyle)
                : {}),
          }
        : {},
    [active, frosted, glass.border, glass.panel, llganSurface, portal.active],
  );
}

/** Card-level glass surface. */
export function useAuroraGlassCardStyle(options: ShellGlassIntensityOptions = {}): ViewStyle {
  const active = useAuroraGlassActive();
  const { isLight } = useLegacyTheme();
  const portal = usePortalPremiumTheme();
  const surfaceTone = useSurfaceContrastTone();
  const surfaceIsLight = portal.active || resolveSurfaceIsLight(surfaceTone, isLight);
  const intensity = resolveShellIntensity('card', options.intensity, options.viewContext);
  const viewContext = options.viewContext ?? 'dashboard';
  const llganSurface = surfaceIsLight
    ? resolveLlganViewGlass(viewContext, intensity)
    : resolveLlganGlassSurface(intensity);
  const glass = resolveActiveGlassTokens(surfaceIsLight, portal.active);
  const frosted = surfaceIsLight && !portal.active;

  return useMemo(
    () =>
      active
        ? {
            backgroundColor: frosted ? llganSurface.card : glass.card,
            borderColor: frosted ? llganSurface.borderWhite : glass.border,
            borderWidth: 1,
            borderRadius: careRadius.lg,
            ...(frosted
              ? {
                  ...lightLiquidGlassWebFx(llganSurface.blurDesktop, llganSurface.saturate),
                  ...(Platform.OS !== 'web'
                    ? {
                        boxShadow: `${llganSurface.shadow}, ${llganSurface.shadowInset}`,
                      }
                    : {}),
                }
              : portal.active && Platform.OS === 'web'
                ? ({ boxShadow: portalPremium.shadow.card } as ViewStyle)
                : {}),
          }
        : {},
    [active, frosted, glass.border, glass.card, llganSurface, portal.active],
  );
}

/** Form input glass fill. */
export function useAuroraGlassInputStyle(): ViewStyle {
  const active = useAuroraGlassActive();
  const { isLight } = useLegacyTheme();
  const portal = usePortalPremiumTheme();
  const surfaceTone = useSurfaceContrastTone();
  const surfaceIsLight = portal.active || resolveSurfaceIsLight(surfaceTone, isLight);
  const glass = resolveActiveGlassTokens(surfaceIsLight, portal.active);

  return useMemo(
    () =>
      active
        ? {
            backgroundColor: glass.input,
            borderColor: glass.border,
            borderWidth: 1,
            borderRadius: careRadius.lg,
          }
        : {},
    [active, glass.border, glass.input],
  );
}

/** Modal sheet glass body. */
export function useAuroraGlassModalStyle(options: ShellGlassIntensityOptions = {}): ViewStyle {
  const active = useAuroraGlassActive();
  const { isLight } = useLegacyTheme();
  const portal = usePortalPremiumTheme();
  const surfaceTone = useSurfaceContrastTone();
  const surfaceIsLight = portal.active || resolveSurfaceIsLight(surfaceTone, isLight);
  const intensity = options.intensity ?? 'default';
  const viewGlass = resolveLlganViewGlass(options.viewContext ?? 'form', intensity);
  const glass = resolveActiveGlassTokens(surfaceIsLight, portal.active);
  const frosted = surfaceIsLight && !portal.active;

  return useMemo(
    () =>
      active
        ? {
            backgroundColor: frosted ? viewGlass.modal : glass.modal,
            borderColor: frosted ? viewGlass.borderWhite : glass.borderStrong,
            borderWidth: 1,
            borderRadius: careRadius.lg,
            overflow: 'hidden',
            ...(frosted
              ? {
                  ...lightLiquidGlassWebFx(viewGlass.blurDesktop, viewGlass.saturate),
                  boxShadow: `${viewGlass.shadow}, ${viewGlass.shadowInset}`,
                }
              : portal.active && Platform.OS === 'web'
                ? ({ boxShadow: portalPremium.shadow.floating } as ViewStyle)
                : {}),
          }
        : {},
    [active, frosted, glass.borderStrong, glass.modal, portal.active, viewGlass],
  );
}

/** Outline/ghost buttons on glass desktop (footer Aktualisieren, etc.). */
export function useAuroraGlassButtonStyles(options: ShellGlassIntensityOptions = {}) {
  const { active, tokens: glass, colors, isLight } = useAuroraGlass();
  const { typography } = useLegacyTheme();
  const portal = usePortalPremiumTheme();
  const text = useAuroraAdaptiveText();
  const viewGlass = resolveLlganViewGlass(
    options.viewContext ?? 'settings',
    options.intensity ?? 'default',
  );

  return useMemo(
    () =>
      StyleSheet.create({
        secondary: {
          backgroundColor:
            active && isLight && !portal.active
              ? viewGlass.button
              : active
                ? glass.chip
                : colors.bgPanel,
          borderColor:
            active && isLight && !portal.active
              ? viewGlass.borderButton
              : active
                ? glass.border
                : colors.borderStrong,
          ...(Platform.OS === 'web' && active && isLight && !portal.active
            ? lightLiquidGlassWebFx(viewGlass.blurButton, viewGlass.saturateButton)
            : {}),
        },
        ghost: {
          backgroundColor: active ? glass.chip : 'transparent',
          borderColor: active ? glass.border : colors.borderSoft,
        },
        secondaryText: {
          color: text.primary,
        },
        label: {
          ...typography.button,
        },
      }),
    [
      active,
      colors,
      glass.border,
      glass.chip,
      isLight,
      portal.active,
      text.primary,
      typography.button,
      viewGlass,
    ],
  );
}

/** Filter chip + segmented tab styles for glass desktop / modal forms. */
export function useAuroraGlassChipStyles(_options: ShellGlassIntensityOptions = {}) {
  const { typography } = useLegacyTheme();
  const { active, tokens: glass } = useAuroraGlass();
  const text = useAuroraAdaptiveText();

  return useMemo(
    () =>
      StyleSheet.create({
        chip: {
          minHeight: 40,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: careRadius.capsule,
          borderWidth: 1,
          borderColor: active ? glass.border : systemLiquidGlass.border,
          backgroundColor: active ? glass.chip : systemLiquidGlass.chip,
          justifyContent: 'center',
        },
        chipSelected: {
          borderColor: active ? glass.borderAccent : systemLiquidGlass.borderActive,
          backgroundColor: active ? glass.chipActive : systemLiquidGlass.chipActive,
        },
        chipPressed: {
          opacity: 0.85,
        },
        label: {
          ...typography.caption,
          fontWeight: '600' as TextStyle['fontWeight'],
          color: active ? text.secondary : systemLiquidGlass.text.secondary,
        },
        labelSelected: {
          color: active ? text.primary : systemLiquidGlass.text.primary,
          fontWeight: '700' as TextStyle['fontWeight'],
        },
        row: {
          flexDirection: 'row',
          gap: careSpacing.sm,
          paddingVertical: careSpacing.xs,
        },
        tab: {
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: careRadius.lg,
          borderWidth: 1,
          borderColor: active ? glass.border : systemLiquidGlass.border,
          backgroundColor: active ? glass.chip : systemLiquidGlass.chip,
          overflow: 'hidden',
        },
        tabActive: {
          borderColor: active ? glass.borderAccent : systemLiquidGlass.borderActive,
          backgroundColor: active ? glass.chipActive : systemLiquidGlass.chipActive,
        },
      }),
    [active, glass, text.primary, text.secondary, typography.caption],
  );
}

type AuroraGlassTableOptions = {
  solidSurface?: boolean;
};

/** PremiumDataTable aurora surfaces. */
export function useAuroraGlassTableStyles(options: AuroraGlassTableOptions = {}) {
  const { solidSurface = false } = options;
  const { active, tokens: glass, colors, isLight } = useAuroraGlass();
  const { typography } = useLegacyTheme();
  const portal = usePortalPremiumTheme();
  const text = useAuroraAdaptiveText();
  const tableSurface =
    isLight && active && !portal.active && !solidSurface
      ? resolveLlganGlassSurface('subtle')
      : null;

  return useMemo(
    () =>
      StyleSheet.create({
        table: {
          borderRadius: 12,
          borderWidth: 1,
          borderColor: active ? glass.border : systemLiquidGlass.border,
          backgroundColor: active
            ? tableSurface
              ? tableSurface.panel
              : glass.table
            : systemLiquidGlass.table,
          overflow: 'hidden',
          ...(Platform.OS === 'web' && tableSurface && !solidSurface
            ? lightLiquidGlassWebFx(tableSurface.blurDesktop, tableSurface.saturate)
            : null),
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: careSpacing.sm,
          paddingHorizontal: careSpacing.md,
          backgroundColor: active ? glass.header : systemLiquidGlass.rowAlt,
          borderBottomWidth: 1,
          borderBottomColor: active ? glass.innerBorder : systemLiquidGlass.innerBorder,
        },
        headerCell: {
          paddingHorizontal: careSpacing.xs,
        },
        headerText: {
          ...typography.label,
          color: text.primary,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          fontSize: 11,
          fontWeight: '700',
        },
        headerTextActive: {
          color: active ? text.primary : systemLiquidGlass.text.primary,
        },
        cellText: {
          color: text.primary,
          fontSize: 14,
        },
        dataRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: careSpacing.sm,
          paddingHorizontal: careSpacing.md,
          minHeight: 52,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: active ? glass.innerBorder : colors.borderSoft,
        },
        dataRowAlt: {
          backgroundColor: active ? glass.rowAlt : systemLiquidGlass.rowAlt,
        },
        dataRowSelected: {
          backgroundColor: active ? glass.rowSelected : systemLiquidGlass.rowSelected,
          borderLeftWidth: 3,
          borderLeftColor: active ? glass.borderAccent : systemLiquidGlass.borderActive,
        },
        dataCell: {
          paddingHorizontal: careSpacing.xs,
          justifyContent: 'center',
        },
        alignCenter: {
          alignItems: 'center',
        },
        alignRight: {
          alignItems: 'flex-end',
        },
        emptyWrap: {
          padding: careSpacing.lg,
          alignItems: 'center',
        },
        emptyText: {
          ...typography.caption,
          color: text.muted,
        },
      }),
    [
      active,
      colors,
      glass,
      solidSurface,
      tableSurface,
      text.muted,
      text.primary,
      typography.caption,
      typography.label,
    ],
  );
}

/** Adaptive primary text for table/list body cells on light or dark surfaces. */
export function useTableTextStyles() {
  const text = useAuroraAdaptiveText();
  const { typography } = useLegacyTheme();

  return useMemo(
    () =>
      StyleSheet.create({
        cellText: {
          ...typography.body,
          color: text.primary,
        },
        name: {
          ...typography.bodyStrong,
          color: text.primary,
        },
        title: {
          ...typography.bodyStrong,
          color: text.primary,
        },
        meta: {
          ...typography.caption,
          color: text.muted,
        },
        muted: {
          ...typography.caption,
          color: text.muted,
        },
      }),
    [text.muted, text.primary, typography],
  );
}

/** ListFilterSelect trigger + dropdown aurora styles. */
export function useAuroraGlassSelectStyles(options: ShellGlassIntensityOptions = {}) {
  const { active, tokens: glass, colors, isLight } = useAuroraGlass();
  const { typography } = useLegacyTheme();
  const portal = usePortalPremiumTheme();
  const text = useAuroraAdaptiveText();
  const viewGlass = resolveLlganViewGlass(
    options.viewContext ?? 'form',
    options.intensity ?? 'default',
  );

  return useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          flex: 1,
          minWidth: 0,
          gap: careSpacing.xs,
        },
        label: {
          ...typography.label,
          color: text.primary,
        },
        trigger: {
          minHeight: 44,
          borderRadius: careRadius.lg,
          borderWidth: 1,
          borderColor:
            active && isLight && !portal.active
              ? viewGlass.borderAccent
              : active
                ? glass.border
                : colors.borderStrong,
          backgroundColor:
            active && isLight && !portal.active
              ? viewGlass.input
              : active
                ? glass.input
                : colors.bgInput,
          paddingHorizontal: careSpacing.md,
          paddingVertical: careSpacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: careSpacing.sm,
          ...(Platform.OS === 'web' && active && isLight && !portal.active
            ? lightLiquidGlassWebFx(viewGlass.blurButton, viewGlass.saturateButton)
            : {}),
        },
        triggerPressed: {
          opacity: 0.9,
        },
        triggerText: {
          ...typography.body,
          color: text.primary,
          flex: 1,
        },
        chevron: {
          ...typography.caption,
          color: text.muted,
          fontWeight: '700',
        },
        optionList: {
          gap: 0,
        },
        option: {
          paddingHorizontal: careSpacing.md,
          paddingVertical: careSpacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor:
            active && isLight && !portal.active
              ? viewGlass.borderAccent
              : active
                ? glass.innerBorder
                : colors.borderSoft,
        },
        optionSelected: {
          backgroundColor: active ? glass.chipActive : systemLiquidGlass.chipActive,
        },
        optionPressed: {
          opacity: 0.85,
        },
        optionLabel: {
          ...typography.body,
          color: text.primary,
        },
        optionLabelSelected: {
          color: active ? text.primary : systemLiquidGlass.text.primary,
          fontWeight: '600',
        },
        modalBackdrop: {
          flex: 1,
          backgroundColor: careSuiteModalScrim,
          justifyContent: 'center',
          alignItems: 'center',
          padding: careSpacing.lg,
        },
        modalSheet: {
          width: '100%',
          maxWidth: 420,
          backgroundColor:
            active && isLight && !portal.active
              ? viewGlass.modal
              : active
                ? glass.modal
                : colors.bgPremium,
          borderRadius: careRadius.lg,
          padding: careSpacing.md,
          gap: careSpacing.sm,
          borderWidth: 1,
          borderColor:
            active && isLight && !portal.active
              ? viewGlass.borderWhite
              : active
                ? glass.borderStrong
                : colors.borderSoft,
          overflow: 'hidden',
          ...(Platform.OS === 'web' && active && isLight && !portal.active
            ? {
                ...lightLiquidGlassWebFx(viewGlass.blurDesktop, viewGlass.saturate),
                boxShadow: `${viewGlass.shadow}, ${viewGlass.shadowInset}`,
              }
            : {}),
        },
        modalTitle: {
          ...typography.h3,
          color: text.primary,
          marginBottom: careSpacing.xs,
        },
        modalClose: {
          alignSelf: 'center',
          paddingVertical: careSpacing.sm,
        },
        modalCloseText: {
          ...typography.bodyStrong,
          color: active ? text.primary : systemLiquidGlass.text.primary,
        },
      }),
    [
      active,
      colors,
      glass,
      isLight,
      portal.active,
      text.muted,
      text.primary,
      typography.body,
      typography.bodyStrong,
      typography.caption,
      typography.h3,
      typography.label,
      viewGlass,
    ],
  );
}
