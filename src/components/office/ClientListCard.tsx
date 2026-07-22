import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import { useTableTextStyles } from '@/design/tokens/auroraGlass';
import type { ClientListItem } from '@/types/modules/office';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { SENSITIVITY_LABELS } from '@/types/portal/visibility';
import { colors, spacing } from '@/theme';

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
  const tableText = useTableTextStyles();
  const location = [client.zip, client.city].filter(Boolean).join(' ');
  const updatedAt = client.updatedAt
    ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'short' }).format(new Date(client.updatedAt))
    : null;
  const facts = [
    { label: 'Wohnort', value: location },
    { label: 'Pflegegrad', value: client.careLevel ? formatCareLevel(client.careLevel) : null },
    { label: 'Kostenträger', value: client.costCarrier },
    { label: 'Aktualisiert', value: updatedAt },
  ].filter((fact) => Boolean(fact.value));

  const inner = (
    <View style={styles.cardContent}>
      <View style={styles.header}>
        <Text style={tableText.name}>
          {client.lastName}, {client.firstName}
        </Text>
        <View style={styles.badges}>
          <PremiumBadge
            label={WORKFLOW_STATUS_LABELS[client.status]}
            variant={statusVariant(client.status)}
            dot
          />
          <PremiumBadge label={SENSITIVITY_LABELS[client.sensitivity]} variant="muted" />
        </View>
      </View>
      {facts.length > 0 ? (
        <View style={styles.factGrid}>
          {facts.map((fact) => (
            <View key={fact.label} style={styles.fact}>
              <Text style={styles.factLabel}>{fact.label}</Text>
              <Text style={tableText.meta} numberOfLines={1}>{fact.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
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
  cardContent: { gap: spacing.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  factGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fact: {
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 130,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.13)',
    gap: 2,
  },
  factLabel: {
    color: 'rgba(248,246,255,0.72)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
