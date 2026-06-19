import { useMemo } from 'react';
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';

/**
 * Aurora dark-glass surface tokens for the system-wide animated backdrop.
 * Page roots stay transparent; panels/cards/inputs use these rgba values.
 */
export const auroraGlass = {
  page: 'transparent',
  panel: 'rgba(23,27,34,0.65)',
  card: 'rgba(23,27,34,0.72)',
  elevated: 'rgba(30,35,48,0.82)',
  modal: 'rgba(16,24,39,0.88)',
  input: 'rgba(26,32,42,0.75)',
  chip: 'rgba(255,255,255,0.06)',
  chipActive: 'rgba(255,149,0,0.14)',
  table: 'rgba(23,27,34,0.65)',
  row: 'transparent',
  rowHover: 'rgba(255,255,255,0.04)',
  rowAlt: 'rgba(255,255,255,0.02)',
  rowSelected: 'rgba(255,149,0,0.10)',
  header: 'rgba(255,255,255,0.04)',
  listItem: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.14)',
  innerBorder: 'rgba(255,255,255,0.06)',
  blur: {
    light: 8,
    medium: 16,
    heavy: 24,
  },
  /** Readable light text on dark glass panels (desktop aurora). */
  text: {
    primary: '#F9FAFB',
    secondary: '#CBD5E1',
    muted: '#94A3B8',
  },
} as const;

export type AuroraGlassTokens = typeof auroraGlass;

/** True when root shell hosts aurora dark-glass (system-wide). */
export function useAuroraGlassActive(): boolean {
  return useShellHostsAurora();
}

/** Adaptive text colors — light/white on aurora glass, theme palette otherwise. */
export function useAuroraAdaptiveText() {
  const active = useAuroraGlassActive();
  const { colors, isDark } = useLegacyTheme();

  return useMemo(() => {
    const onGlass = active || isDark;
    return {
      primary: onGlass ? auroraGlass.text.primary : colors.textPrimary,
      secondary: onGlass ? auroraGlass.text.secondary : colors.textSecondary,
      muted: onGlass ? auroraGlass.text.muted : colors.textMuted,
    };
  }, [active, colors.textMuted, colors.textPrimary, colors.textSecondary, isDark]);
}

/** Full aurora token set + legacy colors when inactive. */
export function useAuroraGlass() {
  const active = useAuroraGlassActive();
  const { colors, isDark } = useLegacyTheme();

  return useMemo(
    () => ({
      active,
      isDark: active || isDark,
      tokens: auroraGlass,
      colors,
    }),
    [active, colors, isDark],
  );
}

/** Glass panel surface (lists, section wrappers). */
export function useAuroraGlassPanelStyle(): ViewStyle {
  const active = useAuroraGlassActive();
  return useMemo(
    () =>
      active
        ? {
            backgroundColor: auroraGlass.panel,
            borderColor: auroraGlass.border,
            borderWidth: 1,
          }
        : {},
    [active],
  );
}

/** Card-level glass surface. */
export function useAuroraGlassCardStyle(): ViewStyle {
  const active = useAuroraGlassActive();
  return useMemo(
    () =>
      active
        ? {
            backgroundColor: auroraGlass.card,
            borderColor: auroraGlass.border,
            borderWidth: 1,
            borderRadius: careRadius.lg,
          }
        : {},
    [active],
  );
}

/** Form input glass fill. */
export function useAuroraGlassInputStyle(): ViewStyle {
  const active = useAuroraGlassActive();
  return useMemo(
    () =>
      active
        ? {
            backgroundColor: auroraGlass.input,
            borderColor: auroraGlass.border,
            borderWidth: 1,
            borderRadius: careRadius.lg,
          }
        : {},
    [active],
  );
}

/** Modal sheet glass body. */
export function useAuroraGlassModalStyle(): ViewStyle {
  const active = useAuroraGlassActive();
  return useMemo(
    () =>
      active
        ? {
            backgroundColor: auroraGlass.modal,
            borderColor: auroraGlass.borderStrong,
            borderWidth: 1,
            borderRadius: careRadius.lg,
          }
        : {},
    [active],
  );
}

/** Outline/ghost buttons on aurora desktop (footer Aktualisieren, etc.). */
export function useAuroraGlassButtonStyles() {
  const { active, colors } = useAuroraGlass();
  const { typography } = useLegacyTheme();
  const text = useAuroraAdaptiveText();

  return useMemo(
    () =>
      StyleSheet.create({
        secondary: {
          backgroundColor: active ? auroraGlass.chip : colors.bgPanel,
          borderColor: active ? auroraGlass.border : colors.borderStrong,
        },
        ghost: {
          backgroundColor: active ? auroraGlass.chip : 'transparent',
          borderColor: active ? auroraGlass.border : colors.borderSoft,
        },
        secondaryText: {
          color: text.primary,
        },
        label: {
          ...typography.button,
        },
      }),
    [active, colors, text.primary, typography.button],
  );
}

/** Filter chip + segmented tab styles for aurora desktop. */
export function useAuroraGlassChipStyles() {
  const { active, colors } = useAuroraGlass();
  const { typography } = useLegacyTheme();
  const text = useAuroraAdaptiveText();

  return useMemo(
    () =>
      StyleSheet.create({
        chip: {
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: careRadius.capsule,
          borderWidth: 1,
          borderColor: active ? auroraGlass.border : colors.borderSoft,
          backgroundColor: active ? auroraGlass.chip : colors.bgSurface,
        },
        chipSelected: {
          borderColor: colors.orange,
          backgroundColor: active ? auroraGlass.chipActive : 'rgba(255,122,26,0.10)',
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
          color: colors.orange,
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
          borderColor: active ? auroraGlass.border : colors.borderSoft,
          backgroundColor: active ? auroraGlass.chip : colors.bgSurface,
        },
        tabActive: {
          borderColor: colors.orange,
          backgroundColor: active ? auroraGlass.chipActive : 'rgba(255,122,26,0.12)',
        },
      }),
    [active, colors, text.secondary, typography.caption],
  );
}

/** PremiumDataTable aurora surfaces. */
export function useAuroraGlassTableStyles() {
  const { active, colors } = useAuroraGlass();
  const { typography } = useLegacyTheme();
  const text = useAuroraAdaptiveText();

  return useMemo(
    () =>
      StyleSheet.create({
        table: {
          borderRadius: 12,
          borderWidth: 1,
          borderColor: active ? auroraGlass.border : colors.borderSoft,
          backgroundColor: active ? auroraGlass.table : colors.bgSurface,
          overflow: 'hidden',
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: careSpacing.sm,
          paddingHorizontal: careSpacing.md,
          backgroundColor: active ? auroraGlass.header : colors.bgElevated,
          borderBottomWidth: 1,
          borderBottomColor: active ? auroraGlass.innerBorder : colors.borderSoft,
        },
        headerCell: {
          paddingHorizontal: careSpacing.xs,
        },
        headerText: {
          ...typography.label,
          color: text.muted,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          fontSize: 11,
        },
        headerTextActive: {
          color: colors.orange,
        },
        dataRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: careSpacing.sm,
          paddingHorizontal: careSpacing.md,
          minHeight: 52,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: active ? auroraGlass.innerBorder : colors.borderSoft,
        },
        dataRowAlt: {
          backgroundColor: active ? auroraGlass.rowAlt : colors.bgPremium,
        },
        dataRowSelected: {
          backgroundColor: active ? auroraGlass.rowSelected : 'rgba(255,122,26,0.10)',
          borderLeftWidth: 3,
          borderLeftColor: colors.orange,
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
    [active, colors, text.muted, typography.caption, typography.label],
  );
}

/** ListFilterSelect trigger + dropdown aurora styles. */
export function useAuroraGlassSelectStyles() {
  const { active, colors } = useAuroraGlass();
  const { typography } = useLegacyTheme();
  const text = useAuroraAdaptiveText();

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
          borderColor: active ? auroraGlass.border : colors.borderStrong,
          backgroundColor: active ? auroraGlass.input : colors.bgInput,
          paddingHorizontal: careSpacing.md,
          paddingVertical: careSpacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: careSpacing.sm,
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
          borderBottomColor: active ? auroraGlass.innerBorder : colors.borderSoft,
        },
        optionSelected: {
          backgroundColor: auroraGlass.chipActive,
        },
        optionPressed: {
          opacity: 0.85,
        },
        optionLabel: {
          ...typography.body,
          color: text.primary,
        },
        optionLabelSelected: {
          color: colors.orange,
          fontWeight: '600',
        },
        modalBackdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: careSpacing.lg,
        },
        modalSheet: {
          width: '100%',
          maxWidth: 420,
          backgroundColor: active ? '#141B28' : colors.bgPremium,
          borderRadius: careRadius.lg,
          padding: careSpacing.md,
          gap: careSpacing.sm,
          borderWidth: 1,
          borderColor: active ? auroraGlass.borderStrong : colors.borderSoft,
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
          color: colors.orange,
        },
      }),
    [active, colors, text.muted, text.primary, typography.body, typography.bodyStrong, typography.caption, typography.h3, typography.label],
  );
}
