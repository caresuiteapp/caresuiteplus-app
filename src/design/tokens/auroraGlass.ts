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
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import {
  AURORA_CHIP_ACTIVE,
  AURORA_ROW_SELECTED,
  careSuiteAuroraTheme,
} from '@/theme/careSuiteAurora';

/**
 * Aurora dark-glass surface tokens for the system-wide animated backdrop.
 * Page roots stay transparent; panels/cards/inputs use these rgba values.
 */
export const auroraGlass = {
  page: 'transparent',
  panel: careSuiteAuroraTheme.glass.background,
  card: careSuiteAuroraTheme.glass.backgroundStrong,
  elevated: 'rgba(30,35,48,0.82)',
  modal: 'rgba(11, 14, 22, 0.92)',
  input: 'rgba(26,32,42,0.75)',
  chip: 'rgba(255,255,255,0.06)',
  chipActive: AURORA_CHIP_ACTIVE,
  table: careSuiteAuroraTheme.glass.background,
  row: 'transparent',
  rowHover: 'rgba(255,255,255,0.04)',
  rowAlt: 'rgba(255,255,255,0.02)',
  rowSelected: AURORA_ROW_SELECTED,
  header: 'rgba(255,255,255,0.04)',
  listItem: 'rgba(255,255,255,0.04)',
  border: careSuiteAuroraTheme.glass.border,
  borderStrong: careSuiteAuroraTheme.glass.borderStrong,
  innerBorder: 'rgba(255,255,255,0.06)',
  blur: {
    light: 8,
    medium: 16,
    heavy: 24,
  },
  /** Readable light text on dark glass panels (desktop aurora). */
  text: {
    primary: careSuiteAuroraTheme.text.primary,
    secondary: careSuiteAuroraTheme.text.secondary,
    muted: careSuiteAuroraTheme.text.muted,
  },
} as const;

/** Frosted milchglas — Liquid Glass über hellem Space-Aurora-Hintergrund. */
const llganDefaultSurface = resolveLlganGlassSurface('default');
const llganSubtleSurface = resolveLlganGlassSurface('subtle');

export const lightLiquidGlass = {
  page: 'transparent',
  panel: llganDefaultSurface.panel,
  card: llganDefaultSurface.card,
  sidebar: llganDefaultSurface.sidebar,
  elevated: 'rgba(255,255,255,0.78)',
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
  innerBorder: 'rgba(255,255,255,0.45)',
  blur: {
    light: llganSubtleSurface.blurMobile,
    medium: llganDefaultSurface.blurDesktop,
    heavy: llganDefaultSurface.blurDesktop + 2,
  },
  text: {
    primary: llgsTypography.primary,
    secondary: llgsTypography.secondary,
    muted: llgsTypography.secondary,
  },
  shadow: llganDefaultSurface.shadow,
  shadowInset: llganDefaultSurface.shadowInset,
  saturate: llganDefaultSurface.saturate,
} as const;

/** Web backdrop-blur + Schatten für Milchglas-Oberflächen. */
export function lightLiquidGlassWebFx(
  blurPx = llganDefaultSurface.blurDesktop,
  saturate = llganDefaultSurface.saturate,
): ViewStyle {
  if (Platform.OS !== 'web') return {};
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
  const intensity = resolveShellIntensity(variant, options.intensity, options.viewContext);
  const llganSurface = options.viewContext || variant === 'modal'
    ? resolveLlganViewGlass(options.viewContext ?? 'form', intensity)
    : resolveLlganGlassSurface(intensity);

  return useMemo(() => {
    const light = isLight && active;
    const tokens = light ? lightLiquidGlass : auroraGlass;
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

    const borderColor = light ? llganSurface.borderAccent : auroraGlass.border;
    const blurPx = light ? llganSurface.blurDesktop : auroraGlass.blur.medium;
    const saturate = light ? llganSurface.saturate : undefined;

    return {
      borderWidth: 1,
      borderColor,
      backgroundColor,
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? light
          ? lightLiquidGlassWebFx(blurPx, saturate)
          : ({
              backdropFilter: `blur(${blurPx}px)`,
              WebkitBackdropFilter: `blur(${blurPx}px)`,
            } as ViewStyle)
        : null),
    };
  }, [active, intensity, isLight, llganSurface, variant]);
}

export type AuroraGlassTokens = typeof auroraGlass;
export type LightLiquidGlassTokens = typeof lightLiquidGlass;
export type GlassSurfaceTokens = AuroraGlassTokens | LightLiquidGlassTokens;

function resolveActiveGlassTokens(isLight: boolean): GlassSurfaceTokens {
  return isLight ? lightLiquidGlass : auroraGlass;
}

/** True when root shell hosts animated background (light or dark glass). */
export function useAuroraGlassActive(): boolean {
  return useShellHostsAurora();
}

/** Active glass token set — light liquid or dark aurora based on theme mode. */
export function useActiveGlassTokens(): GlassSurfaceTokens {
  const active = useAuroraGlassActive();
  const { isLight } = useLegacyTheme();
  return active ? resolveActiveGlassTokens(isLight) : auroraGlass;
}

/** Adaptive text colors — glass text when shell active, theme palette otherwise. */
export function useAuroraAdaptiveText() {
  const active = useAuroraGlassActive();
  const { colors, isLight } = useLegacyTheme();
  const glass = resolveActiveGlassTokens(isLight);

  return useMemo(() => {
    if (active) {
      return {
        primary: glass.text.primary,
        secondary: glass.text.secondary,
        muted: glass.text.muted,
        border: colors.borderSoft,
      };
    }
    return {
      primary: colors.textPrimary,
      secondary: colors.textSecondary,
      muted: colors.textMuted,
      border: colors.borderSoft,
    };
  }, [active, colors.borderSoft, colors.textMuted, colors.textPrimary, colors.textSecondary, glass.text.muted, glass.text.primary, glass.text.secondary]);
}

/** Full glass token set + legacy colors when inactive. */
export function useAuroraGlass() {
  const active = useAuroraGlassActive();
  const { colors, isLight, isDark } = useLegacyTheme();
  const tokens = active ? resolveActiveGlassTokens(isLight) : auroraGlass;

  return useMemo(
    () => ({
      active,
      isDark,
      isLight,
      tokens,
      colors,
    }),
    [active, colors, isDark, isLight, tokens],
  );
}

/** Glass panel surface (lists, section wrappers). */
export function useAuroraGlassPanelStyle(options: ShellGlassIntensityOptions = {}): ViewStyle {
  const active = useAuroraGlassActive();
  const { isLight } = useLegacyTheme();
  const intensity = options.intensity ?? 'default';
  const llganSurface =
    options.viewContext && isLight
      ? resolveLlganViewGlass(options.viewContext, intensity)
      : resolveLlganGlassSurface(intensity);
  const glass = resolveActiveGlassTokens(isLight);

  return useMemo(
    () =>
      active
        ? {
            backgroundColor: isLight ? llganSurface.panel : glass.panel,
            borderColor: isLight ? llganSurface.borderAccent : glass.border,
            borderWidth: 1,
            ...(isLight ? lightLiquidGlassWebFx(llganSurface.blurDesktop, llganSurface.saturate) : {}),
          }
        : {},
    [active, glass.border, glass.panel, isLight, llganSurface],
  );
}

/** Card-level glass surface. */
export function useAuroraGlassCardStyle(options: ShellGlassIntensityOptions = {}): ViewStyle {
  const active = useAuroraGlassActive();
  const { isLight } = useLegacyTheme();
  const intensity = resolveShellIntensity('card', options.intensity, options.viewContext);
  const viewContext = options.viewContext ?? 'dashboard';
  const llganSurface = isLight
    ? resolveLlganViewGlass(viewContext, intensity)
    : resolveLlganGlassSurface(intensity);
  const glass = resolveActiveGlassTokens(isLight);

  return useMemo(
    () =>
      active
        ? {
            backgroundColor: isLight ? llganSurface.card : glass.card,
            borderColor: isLight ? llganSurface.borderWhite : glass.border,
            borderWidth: 1,
            borderRadius: careRadius.lg,
            overflow: 'hidden',
            ...(isLight
              ? {
                  ...lightLiquidGlassWebFx(llganSurface.blurDesktop, llganSurface.saturate),
                  boxShadow: `${llganSurface.shadow}, ${llganSurface.shadowInset}`,
                }
              : {}),
          }
        : {},
    [active, glass.border, glass.card, isLight, llganSurface],
  );
}

/** Form input glass fill. */
export function useAuroraGlassInputStyle(): ViewStyle {
  const active = useAuroraGlassActive();
  const { isLight } = useLegacyTheme();
  const glass = resolveActiveGlassTokens(isLight);

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
export function useAuroraGlassModalStyle(
  options: ShellGlassIntensityOptions = {},
): ViewStyle {
  const active = useAuroraGlassActive();
  const { isLight } = useLegacyTheme();
  const intensity = options.intensity ?? 'default';
  const viewGlass = resolveLlganViewGlass(options.viewContext ?? 'form', intensity);
  const glass = resolveActiveGlassTokens(isLight);

  return useMemo(
    () =>
      active
        ? {
            backgroundColor: isLight ? viewGlass.modal : glass.modal,
            borderColor: isLight ? viewGlass.borderWhite : glass.borderStrong,
            borderWidth: 1,
            borderRadius: careRadius.lg,
            overflow: 'hidden',
            ...(isLight
              ? {
                  ...lightLiquidGlassWebFx(viewGlass.blurDesktop, viewGlass.saturate),
                  boxShadow: `${viewGlass.shadow}, ${viewGlass.shadowInset}`,
                }
              : {}),
          }
        : {},
    [active, glass.borderStrong, glass.modal, isLight, viewGlass],
  );
}

/** Outline/ghost buttons on glass desktop (footer Aktualisieren, etc.). */
export function useAuroraGlassButtonStyles(options: ShellGlassIntensityOptions = {}) {
  const { active, tokens: glass, colors, isLight } = useAuroraGlass();
  const { typography } = useLegacyTheme();
  const text = useAuroraAdaptiveText();
  const viewGlass = resolveLlganViewGlass(options.viewContext ?? 'settings', options.intensity ?? 'default');

  return useMemo(
    () =>
      StyleSheet.create({
        secondary: {
          backgroundColor: active && isLight ? viewGlass.button : active ? glass.chip : colors.bgPanel,
          borderColor: active && isLight ? viewGlass.borderButton : active ? glass.border : colors.borderStrong,
          ...(Platform.OS === 'web' && active && isLight
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
    [active, colors, glass.border, glass.chip, isLight, text.primary, typography.button, viewGlass],
  );
}

/** Filter chip + segmented tab styles for glass desktop / modal forms. */
export function useAuroraGlassChipStyles(options: ShellGlassIntensityOptions = {}) {
  const { active, tokens: glass, colors, isLight } = useAuroraGlass();
  const { typography } = useLegacyTheme();
  const text = useAuroraAdaptiveText();
  const viewGlass = resolveLlganViewGlass(options.viewContext ?? 'form', options.intensity ?? 'default');

  return useMemo(
    () =>
      StyleSheet.create({
        chip: {
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: careRadius.capsule,
          borderWidth: 1,
          borderColor: active && isLight ? viewGlass.borderButton : active ? glass.border : colors.borderSoft,
          backgroundColor: active && isLight ? viewGlass.button : active ? glass.chip : colors.bgSurface,
          ...(Platform.OS === 'web' && active && isLight
            ? lightLiquidGlassWebFx(viewGlass.blurButton, viewGlass.saturateButton)
            : {}),
        },
        chipSelected: {
          borderColor: active && isLight ? 'rgba(120,160,255,0.32)' : careSuiteAuroraTheme.accent.violet,
          backgroundColor:
            active && isLight ? 'rgba(130,170,255,0.16)' : active ? glass.chipActive : 'rgba(139, 92, 246, 0.12)',
        },
        chipPressed: {
          opacity: 0.85,
        },
        label: {
          ...typography.caption,
          fontWeight: '600' as TextStyle['fontWeight'],
          color: text.secondary,
        },
        labelSelected: {
          color: active && isLight ? '#0F1B33' : careSuiteAuroraTheme.accent.pink,
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
          borderColor: active ? glass.border : colors.borderSoft,
          backgroundColor: active ? glass.chip : colors.bgSurface,
        },
        tabActive: {
          borderColor: careSuiteAuroraTheme.accent.violet,
          backgroundColor: active ? glass.chipActive : 'rgba(139, 92, 246, 0.12)',
        },
      }),
    [active, colors, glass.border, glass.chip, glass.chipActive, text.secondary, typography.caption],
  );
}

/** PremiumDataTable aurora surfaces. */
export function useAuroraGlassTableStyles() {
  const { active, tokens: glass, colors, isLight } = useAuroraGlass();
  const { typography } = useLegacyTheme();
  const text = useAuroraAdaptiveText();
  const tableSurface = isLight && active ? resolveLlganGlassSurface('subtle') : null;

  return useMemo(
    () =>
      StyleSheet.create({
        table: {
          borderRadius: 12,
          borderWidth: 1,
          borderColor: active ? glass.border : colors.borderSoft,
          backgroundColor: active
            ? tableSurface
              ? tableSurface.panel
              : glass.table
            : colors.bgSurface,
          overflow: 'hidden',
          ...(Platform.OS === 'web' && tableSurface
            ? lightLiquidGlassWebFx(tableSurface.blurDesktop, tableSurface.saturate)
            : null),
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: careSpacing.sm,
          paddingHorizontal: careSpacing.md,
          backgroundColor: active ? glass.header : colors.bgElevated,
          borderBottomWidth: 1,
          borderBottomColor: active ? glass.innerBorder : colors.borderSoft,
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
          color: isLight && active ? '#0F1B33' : careSuiteAuroraTheme.accent.violet,
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
          backgroundColor: active ? glass.rowAlt : colors.bgPremium,
        },
        dataRowSelected: {
          backgroundColor: active ? glass.rowSelected : 'rgba(139, 92, 246, 0.10)',
          borderLeftWidth: 3,
          borderLeftColor: careSuiteAuroraTheme.accent.violet,
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
    [active, colors, glass, isLight, tableSurface, text.muted, text.primary, typography.caption, typography.label],
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
  const text = useAuroraAdaptiveText();
  const viewGlass = resolveLlganViewGlass(options.viewContext ?? 'form', options.intensity ?? 'default');

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
          borderColor: active && isLight ? viewGlass.borderAccent : active ? glass.border : colors.borderStrong,
          backgroundColor: active && isLight ? viewGlass.input : active ? glass.input : colors.bgInput,
          paddingHorizontal: careSpacing.md,
          paddingVertical: careSpacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: careSpacing.sm,
          ...(Platform.OS === 'web' && active && isLight
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
          borderBottomColor: active && isLight ? viewGlass.borderAccent : active ? glass.innerBorder : colors.borderSoft,
        },
        optionSelected: {
          backgroundColor: active && isLight ? 'rgba(130,170,255,0.16)' : glass.chipActive,
        },
        optionPressed: {
          opacity: 0.85,
        },
        optionLabel: {
          ...typography.body,
          color: text.primary,
        },
        optionLabelSelected: {
          color: active && isLight ? '#0F1B33' : careSuiteAuroraTheme.accent.pink,
          fontWeight: '600',
        },
        modalBackdrop: {
          flex: 1,
          backgroundColor: isLight ? 'rgba(15, 27, 51, 0.16)' : 'rgba(0,0,0,0.55)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: careSpacing.lg,
        },
        modalSheet: {
          width: '100%',
          maxWidth: 420,
          backgroundColor: active && isLight ? viewGlass.modal : active ? glass.modal : colors.bgPremium,
          borderRadius: careRadius.lg,
          padding: careSpacing.md,
          gap: careSpacing.sm,
          borderWidth: 1,
          borderColor: active && isLight ? viewGlass.borderWhite : active ? glass.borderStrong : colors.borderSoft,
          overflow: 'hidden',
          ...(Platform.OS === 'web' && active && isLight
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
          color: active && isLight ? text.primary : careSuiteAuroraTheme.accent.cyan,
        },
      }),
    [active, colors, glass, isLight, text.muted, text.primary, text.secondary, typography.body, typography.bodyStrong, typography.caption, typography.h3, typography.label, viewGlass],
  );
}
