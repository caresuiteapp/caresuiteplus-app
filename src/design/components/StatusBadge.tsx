import { StyleSheet, Text, View } from 'react-native';
import { resolveAccentTextChipStyle } from '@/design/tokens/accentContrast';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import {
  UI_ACTIVE_LABEL,
  UI_BETA_LABEL,
  UI_COMING_SOON_LABEL,
  UI_DISABLED_LABEL,
  UI_ERROR_LABEL,
  UI_INTERNAL_LABEL,
  UI_PREPARED_LABEL,
  UI_REQUIRED_LABEL,
  UI_WARNING_LABEL,
} from '@/design/tokens/uiStatusLabels';
import { galaxyPalette } from '@/design/tokens/galaxy';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import {
  defaultPublicVisibility,
  userFriendlyLabel,
  type UiVisibility,
} from '@/lib/ui/uiVisibility';

export type StatusKind =
  | 'preparedOnly'
  | 'comingSoon'
  | 'coming_soon'
  | 'internal'
  | 'beta'
  | 'disabled'
  | 'active'
  | 'live'
  | 'inactive'
  | 'success'
  | 'warning'
  | 'danger'
  | 'error'
  | 'info'
  | 'required';

const STATUS_LABELS: Record<StatusKind, string> = {
  preparedOnly: UI_PREPARED_LABEL,
  comingSoon: UI_COMING_SOON_LABEL,
  coming_soon: UI_COMING_SOON_LABEL,
  internal: UI_INTERNAL_LABEL,
  beta: UI_BETA_LABEL,
  disabled: UI_DISABLED_LABEL,
  active: UI_ACTIVE_LABEL,
  live: UI_ACTIVE_LABEL,
  inactive: UI_DISABLED_LABEL,
  success: 'Erfolg',
  warning: UI_WARNING_LABEL,
  danger: UI_ERROR_LABEL,
  error: UI_ERROR_LABEL,
  info: 'Info',
  required: UI_REQUIRED_LABEL,
};

const STATUS_COLORS: Record<StatusKind, { bg: string; text: string; border: string }> = {
  preparedOnly: {
    bg: `${galaxyPalette.glowViolet}22`,
    text: galaxyPalette.glowViolet,
    border: `${galaxyPalette.glowViolet}44`,
  },
  comingSoon: {
    bg: `${galaxyPalette.glowBlue}18`,
    text: galaxyPalette.glowBlue,
    border: `${galaxyPalette.glowBlue}33`,
  },
  coming_soon: {
    bg: `${galaxyPalette.glowBlue}18`,
    text: galaxyPalette.glowBlue,
    border: `${galaxyPalette.glowBlue}33`,
  },
  internal: {
    bg: `${galaxyPalette.textMuted}22`,
    text: galaxyPalette.textMuted,
    border: `${galaxyPalette.textMuted}44`,
  },
  beta: {
    bg: `${galaxyPalette.galaxyCyan}18`,
    text: galaxyPalette.galaxyCyan,
    border: `${galaxyPalette.galaxyCyan}33`,
  },
  disabled: {
    bg: `${galaxyPalette.textMuted}18`,
    text: galaxyPalette.textMuted,
    border: `${galaxyPalette.textMuted}33`,
  },
  active: {
    bg: `${galaxyPalette.success}22`,
    text: galaxyPalette.success,
    border: `${galaxyPalette.success}44`,
  },
  live: {
    bg: `${galaxyPalette.success}22`,
    text: galaxyPalette.success,
    border: `${galaxyPalette.success}44`,
  },
  inactive: {
    bg: `${galaxyPalette.textMuted}18`,
    text: galaxyPalette.textMuted,
    border: `${galaxyPalette.textMuted}33`,
  },
  success: {
    bg: `${galaxyPalette.success}22`,
    text: galaxyPalette.success,
    border: `${galaxyPalette.success}44`,
  },
  warning: {
    bg: `${galaxyPalette.warning}22`,
    text: galaxyPalette.warning,
    border: `${galaxyPalette.warning}44`,
  },
  danger: {
    bg: `${galaxyPalette.danger}22`,
    text: galaxyPalette.danger,
    border: `${galaxyPalette.danger}44`,
  },
  error: {
    bg: `${galaxyPalette.danger}22`,
    text: galaxyPalette.danger,
    border: `${galaxyPalette.danger}44`,
  },
  info: {
    bg: `${galaxyPalette.galaxyCyan}18`,
    text: galaxyPalette.galaxyCyan,
    border: `${galaxyPalette.galaxyCyan}33`,
  },
  required: {
    bg: `${galaxyPalette.careOrange}18`,
    text: galaxyPalette.careOrange,
    border: `${galaxyPalette.careOrange}33`,
  },
};

type StatusBadgeProps = {
  kind: StatusKind;
  label?: string;
  dot?: boolean;
  visibility?: UiVisibility;
  /** Raw status key — shown only when visibility.showDeveloperDiagnostics */
  rawKey?: string;
};

/** Maps internal status keys to human-readable German labels — never shows raw keys to normal users. */
export function StatusBadge({
  kind,
  label,
  dot = false,
  visibility = defaultPublicVisibility(),
  rawKey,
}: StatusBadgeProps) {
  const { isLight } = useLegacyTheme();

  if (kind === 'internal' && !visibility.showDeveloperDiagnostics) {
    return null;
  }
  if (kind === 'preparedOnly' && !visibility.showPreparedBadges) {
    return null;
  }

  const colors = STATUS_COLORS[kind];
  const chip = isLight ? resolveAccentTextChipStyle(colors.text) : null;
  const text = label ?? STATUS_LABELS[kind];
  const showRaw =
    rawKey && visibility.showDeveloperDiagnostics && visibility.allowForbiddenTerms;

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.badge,
          {
            backgroundColor: chip?.backgroundColor ?? colors.bg,
            borderColor: chip?.borderColor ?? colors.border,
          },
        ]}
      >
        {dot ? <View style={[styles.dot, { backgroundColor: chip?.color ?? colors.text }]} /> : null}
        <Text style={[styles.text, { color: chip?.color ?? colors.text }]} numberOfLines={1}>
          {text}
        </Text>
      </View>
      {showRaw ? (
        <Text style={styles.rawKey} numberOfLines={1}>
          {rawKey}
        </Text>
      ) : null}
    </View>
  );
}

/** Resolve a raw status string to display label (UI-safe). */
export function resolveStatusLabel(raw: string): string {
  if (raw in STATUS_LABELS) {
    return STATUS_LABELS[raw as StatusKind];
  }
  if (raw === 'prepared_only' || raw === 'premium_prepared') {
    return STATUS_LABELS.preparedOnly;
  }
  return userFriendlyLabel(raw);
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    gap: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: careSpacing.xs,
    paddingHorizontal: careSpacing.sm,
    paddingVertical: 4,
    borderRadius: careRadius.capsule,
    borderWidth: 1,
    flexShrink: 0,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    flexShrink: 0,
  },
  rawKey: {
    fontSize: 10,
    lineHeight: 12,
    color: galaxyPalette.textMuted,
    fontFamily: 'monospace',
  },
});
