import { StyleSheet, Text, View } from 'react-native';
import type { TIConnectionStatus } from '@/types/modules/ti';
import { TI_CONNECTION_STATUS_LABELS } from '@/types/modules/ti';
import { colors, radius, spacing, typography } from '@/theme';

const STATUS_COLORS: Partial<Record<TIConnectionStatus, string>> = {
  kim_active: colors.cyan,
  ti_verified: colors.success,
  provider_connected: colors.cyanSoft,
  provider_configured: colors.warning,
  partially_available: colors.warning,
  blocked_missing_permission: colors.error,
  blocked_missing_consent: colors.error,
  provider_error: colors.error,
  not_configured: colors.textMuted,
  disabled: colors.textMuted,
};

type Props = {
  status: TIConnectionStatus;
};

export function TIConnectionStatusBadge({ status }: Props) {
  const color = STATUS_COLORS[status] ?? colors.textMuted;
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.text, { color }]}>{TI_CONNECTION_STATUS_LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  text: { ...typography.caption, fontWeight: '600' },
});
