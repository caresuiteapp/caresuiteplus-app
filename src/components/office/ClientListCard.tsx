import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import type { ClientListItem } from '@/types/modules/office';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { SENSITIVITY_LABELS } from '@/types/portal/visibility';
import { colors, spacing, typography } from '@/theme';

type ClientListCardProps = {
  client: ClientListItem;
  onPress?: () => void;
  selected?: boolean;
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

export function ClientListCard({ client, onPress, selected = false }: ClientListCardProps) {
  const location = [client.zip, client.city].filter(Boolean).join(' ');

  const inner = (
    <>
      <View style={styles.header}>
        <Text style={styles.name}>
          {client.lastName}, {client.firstName}
        </Text>
        {client.careLevel ? (
          <PremiumBadge label={formatCareLevel(client.careLevel)} variant="cyan" />
        ) : null}
      </View>
      {location ? <Text style={styles.location}>{location}</Text> : null}
      <View style={styles.badges}>
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[client.status]}
          variant={statusVariant(client.status)}
          dot
        />
        <PremiumBadge
          label={SENSITIVITY_LABELS[client.sensitivity]}
          variant="muted"
        />
      </View>
    </>
  );

  if (!onPress) {
    return <PremiumCard style={styles.card}>{inner}</PremiumCard>;
  }

  return (
    <Pressable onPress={onPress}>
      <PremiumCard
        style={[styles.card, selected ? styles.cardSelected : null]}
        accentColor={colors.orange}
      >
        {inner}
      </PremiumCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  cardSelected: {
    borderColor: colors.orange,
    borderWidth: 2,
    backgroundColor: 'rgba(255,149,0,0.08)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: 4,
  },
  name: {
    ...typography.bodyStrong,
    flex: 1,
  },
  location: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
