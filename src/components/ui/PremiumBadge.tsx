import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { resolveAccentTextChipStyle } from '@/design/tokens/accentContrast';
import { useLightLiquidGlassShell } from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';
import { colors } from '@/theme';

type Variant = 'orange' | 'cyan' | 'green' | 'muted' | 'red' | 'purple' | 'pink' | 'warning' | 'yellow';

type Props = {
  label: string;
  variant?: Variant;
  style?: ViewStyle;
  dot?: boolean;
  size?: 'default' | 'compact';
};

const CONFIG: Record<Variant, { text: string; bg: string; border: string }> = {
  orange: { text: colors.orange, bg: 'rgba(255,149,0,0.16)', border: 'rgba(255,149,0,0.32)' },
  warning: { text: '#B45309', bg: 'rgba(217,119,6,0.12)', border: 'rgba(217,119,6,0.28)' },
  yellow: { text: '#CA8A04', bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.28)' },
  cyan: { text: colors.cyan, bg: 'rgba(98,243,255,0.12)', border: 'rgba(98,243,255,0.24)' },
  green: { text: colors.success, bg: 'rgba(34,197,94,0.14)', border: 'rgba(34,197,94,0.28)' },
  muted: { text: colors.textMuted, bg: 'rgba(139,149,167,0.12)', border: 'rgba(139,149,167,0.20)' },
  red: { text: colors.danger, bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.28)' },
  purple: {
    text: careSuiteAuroraTheme.accent.violet,
    bg: 'rgba(139, 92, 246, 0.18)',
    border: 'rgba(139, 92, 246, 0.32)',
  },
  pink: {
    text: careSuiteAuroraTheme.accent.pink,
    bg: 'rgba(236, 72, 153, 0.16)',
    border: 'rgba(236, 72, 153, 0.30)',
  },
};

export function PremiumBadge({ label, variant = 'orange', style, dot = false, size = 'default' }: Props) {
  const { isLight } = useLegacyTheme();
  const useLightShell = useLightLiquidGlassShell() || isLight;
  const base = CONFIG[variant] ?? CONFIG.muted;
  const chip = useLightShell ? null : isLight ? resolveAccentTextChipStyle(base.text) : null;
  const compact = size === 'compact';

  return (
    <View
      style={[
        styles.badge,
        compact ? styles.badgeCompact : null,
        {
          backgroundColor: chip?.backgroundColor ?? base.bg,
          borderColor: chip?.borderColor ?? base.border,
        },
        style,
      ]}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: chip?.color ?? base.text }]} /> : null}
      <Text
        style={[compact ? styles.labelCompact : styles.label, { color: chip?.color ?? base.text }]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {label}
      </Text>
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
    maxWidth: '100%',
  },
  badgeCompact: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  labelCompact: {
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
});
