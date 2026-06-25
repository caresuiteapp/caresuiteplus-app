import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { sanitizeUiText } from '@/lib/ui/uiVisibility';
import { colors, radius, spacing, typography } from '@/theme';

type Variant = 'info' | 'success' | 'warning' | 'danger';

type Props = {
  title?: string;
  message: string;
  variant?: Variant;
  icon?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
};

const CONFIG: Record<
  Variant,
  { bg: string; border: string; title: string; icon: string }
> = {
  info: {
    bg: 'rgba(56,189,248,0.10)',
    border: 'rgba(56,189,248,0.28)',
    title: colors.info,
    icon: 'ℹ️',
  },
  success: {
    bg: 'rgba(34,197,94,0.12)',
    border: 'rgba(34,197,94,0.28)',
    title: colors.success,
    icon: '✓',
  },
  warning: {
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.28)',
    title: colors.warning,
    icon: '⚠',
  },
  danger: {
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.28)',
    title: colors.danger,
    icon: '✕',
  },
};

export function InfoBanner({
  title,
  message,
  variant = 'info',
  icon,
  dismissible = false,
  onDismiss,
  actionLabel,
  onAction,
  style,
}: Props) {
  const text = useAuroraAdaptiveText();
  const cfg = CONFIG[variant];
  const displayIcon = icon ?? cfg.icon;
  const safeTitle = title ? sanitizeUiText(title) : undefined;
  const safeMessage = sanitizeUiText(message);

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: cfg.bg, borderColor: cfg.border },
        style,
      ]}
      accessibilityRole="alert"
    >
      <Text style={styles.icon}>{displayIcon}</Text>
      <View style={styles.content}>
        {safeTitle ? (
          <Text style={[styles.title, { color: cfg.title }]}>{safeTitle}</Text>
        ) : null}
        <Text style={[styles.message, { color: text.primary }]}>{safeMessage}</Text>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.action, { color: cfg.title }]}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {dismissible && onDismiss ? (
        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Schließen"
        >
          <Text style={[styles.dismiss, { color: text.muted }]}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  icon: {
    fontSize: 18,
    lineHeight: 22,
    marginTop: 1,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...typography.bodyStrong,
  },
  message: {
    ...typography.body,
    fontSize: 14,
  },
  action: {
    ...typography.caption,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  dismiss: {
    fontSize: 16,
    padding: 2,
  },
});
