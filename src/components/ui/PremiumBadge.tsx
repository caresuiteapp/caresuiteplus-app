import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { FeatureBadge } from '@/design/components';
import type { StatusKind } from '@/design/components/StatusBadge';
import {
  defaultPublicVisibility,
  sanitizeUiText,
  shouldShowDebugBadges,
  type UiVisibility,
} from '@/lib/ui/uiVisibility';
import { colors } from '@/theme';

type Variant = 'orange' | 'cyan' | 'green' | 'muted' | 'red';

type Props = {
  label?: string;
  variant?: Variant;
  style?: ViewStyle;
  dot?: boolean;
  /** Maps to FeatureBadge — avoids raw status keys in UI literals. */
  statusKind?: StatusKind;
  visibility?: UiVisibility;
  /** Developer diagnosis only — skips sanitization and production debug hide. */
  allowTechnical?: boolean;
};

const CONFIG: Record<Variant, { text: string; bg: string; border: string }> = {
  orange: { text: colors.orange, bg: 'rgba(255,149,0,0.16)', border: 'rgba(255,149,0,0.32)' },
  cyan: { text: colors.cyan, bg: 'rgba(98,243,255,0.12)', border: 'rgba(98,243,255,0.24)' },
  green: { text: colors.success, bg: 'rgba(34,197,94,0.14)', border: 'rgba(34,197,94,0.28)' },
  muted: { text: colors.textMuted, bg: 'rgba(139,149,167,0.12)', border: 'rgba(139,149,167,0.20)' },
  red: { text: colors.danger, bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.28)' },
};

const DEBUG_LABEL_PATTERN = /__dev__|dev\/qa|kein store-release/i;

export function PremiumBadge({
  label = '',
  variant = 'orange',
  style,
  dot = false,
  statusKind,
  visibility = defaultPublicVisibility(),
  allowTechnical = false,
}: Props) {
  if (statusKind) {
    return (
      <FeatureBadge
        kind={statusKind}
        label={label || undefined}
        dot={dot}
        visibility={visibility}
        rawKey={statusKind}
      />
    );
  }

  const cfg = CONFIG[variant];
  const displayLabel = allowTechnical ? label : sanitizeUiText(label);

  if (!allowTechnical && !shouldShowDebugBadges() && DEBUG_LABEL_PATTERN.test(label)) {
    return null;
  }

  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }, style]}>
      {dot ? <View style={[styles.dot, { backgroundColor: cfg.text }]} /> : null}
      <Text style={[styles.label, { color: cfg.text }]}>{displayLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
