import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumBadge } from '@/components/ui';
import {
  formatClientListLocation,
  resolveClientListServiceLabel,
} from '@/lib/office/clientListDisplay';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import type { ClientListItem } from '@/types/modules/office';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type ClientCompactRowProps = {
  client: ClientListItem;
  selected?: boolean;
  onPress?: () => void;
};

function statusVariant(status: ClientListItem['status']) {
  switch (status) {
    case 'aktiv':
      return 'green' as const;
    case 'fehlerhaft':
    case 'gesperrt':
      return 'red' as const;
    case 'in_bearbeitung':
    case 'entwurf':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

export function ClientCompactRow({ client, selected = false, onPress }: ClientCompactRowProps) {
  const location = formatClientListLocation(client);
  const serviceLabel = resolveClientListServiceLabel(client);
  const fullName = `${client.firstName} ${client.lastName}`;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, selected ? styles.rowSelected : null]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <View style={styles.main}>
        <Text style={styles.name} numberOfLines={1}>
          {fullName}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[location, serviceLabel].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={styles.badges}>
        {client.careLevel ? (
          <PremiumBadge label={formatCareLevel(client.careLevel)} variant="cyan" />
        ) : null}
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[client.status]}
          variant={statusVariant(client.status)}
          dot
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.bgBase,
    minHeight: 56,
  },
  rowSelected: {
    backgroundColor: 'rgba(255,149,0,0.10)',
    borderLeftWidth: 3,
    borderLeftColor: colors.orange,
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: spacing.xs,
    flexShrink: 0,
    alignItems: 'center',
  },
});
