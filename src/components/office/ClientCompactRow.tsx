import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumBadge } from '@/components/ui';
import { ClientAnimalAvatar } from '@/components/clients/ClientAnimalAvatar';
import {
  formatClientListLocation,
  resolveClientListServiceLabel,
} from '@/lib/office/clientListDisplay';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import type { ClientListItem } from '@/types/modules/office';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';

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
      <ClientAnimalAvatar clientId={client.id} clientName={fullName} size={38} />
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
    gap: careSpacing.sm,
    paddingVertical: careSpacing.sm,
    paddingHorizontal: careSpacing.md,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: careSuiteAuroraTheme.glass.border,
    borderRadius: careRadius.lg,
    backgroundColor: careSuiteAuroraTheme.glass.background,
    minHeight: 64,
  },
  rowSelected: {
    backgroundColor: 'rgba(105,232,255,0.12)',
    borderColor: careSuiteAuroraTheme.accent.cyan,
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    color: careSuiteAuroraTheme.text.primary,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  meta: {
    color: careSuiteAuroraTheme.text.muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: careSpacing.xs,
    flexShrink: 0,
    alignItems: 'center',
  },
});
