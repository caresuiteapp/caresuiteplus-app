import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumCard } from '@/components/ui';
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

function formatGermanDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('de-DE').format(date);
}

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
  const fullAddress = [client.street, location].filter(Boolean).join(', ');
  const updatedAt = formatGermanDate(client.updatedAt);
  const facts = [
    { label: 'Wohnort', value: location },
    { label: 'Pflegegrad', value: client.careLevel ? formatCareLevel(client.careLevel) : null },
    { label: 'Kostenträger', value: client.costCarrier },
    { label: 'Aktualisiert', value: updatedAt },
    { label: 'Vollständige Adresse', value: fullAddress },
    { label: 'Versicherungsnummer', value: client.insuranceNumber },
    { label: 'Geburtsdatum', value: formatGermanDate(client.dateOfBirth) },
    { label: 'Telefon / Handy', value: client.primaryContactPhone },
  ].filter((fact) => Boolean(fact.value));

  const inner = (
    <View style={styles.cardContent}>
      <View style={styles.header}>
        <Text style={styles.clientName}>
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
              <Text style={styles.factValue} numberOfLines={1}>{fact.value}</Text>
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
  clientName: {
    flex: 1,
    color: '#0B2342',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
  },
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
    backgroundColor: 'rgba(225,239,255,0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(38,126,225,0.22)',
    gap: 2,
  },
  factLabel: {
    color: '#31597F',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  factValue: {
    color: '#0B2342',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
});
