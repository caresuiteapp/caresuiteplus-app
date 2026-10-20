import { StyleSheet, Text, View } from 'react-native';
import { AuroraBadge, AuroraGlassCard } from '@/components/aurora';
import { ClientAnimalAvatar } from '@/components/clients/ClientAnimalAvatar';
import type { ClientListItem } from '@/types/modules/office';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { SENSITIVITY_LABELS } from '@/types/portal/visibility';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';

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
      return 'pink' as const;
    default:
      return 'muted' as const;
  }
}

export function ClientListCard({ client, onPress, selected = false }: ClientListCardProps) {
  const location = [client.zip, client.city].filter(Boolean).join(' ');
  const fullAddress = [client.street, location].filter(Boolean).join(', ');
  const fullName = `${client.firstName} ${client.lastName}`.trim();
  const updatedAt = formatGermanDate(client.updatedAt);
  const facts = [
    { icon: '⌂', label: 'Versorgungsort', value: fullAddress || 'Noch nicht erfasst' },
    { icon: '✚', label: 'Pflegegrad', value: client.careLevel ? formatCareLevel(client.careLevel) : 'Ohne Pflegegrad' },
    { icon: '€', label: 'Kostenträger', value: client.costCarrier ?? 'Noch offen' },
    { icon: '☎', label: 'Telefon', value: client.primaryContactPhone ?? 'Noch nicht erfasst' },
  ];

  return (
    <AuroraGlassCard
      onPress={onPress}
      glow={selected}
      style={StyleSheet.flatten([styles.card, selected ? styles.cardSelected : undefined])}
    >
      <View style={styles.header}>
        <View style={styles.identity}>
          <ClientAnimalAvatar clientId={client.id} clientName={fullName} size={58} />
          <View style={styles.identityText}>
            <Text style={styles.clientName}>{client.lastName}, {client.firstName}</Text>
            <Text style={styles.clientMeta}>
              {client.dateOfBirth ? `Geb. ${formatGermanDate(client.dateOfBirth)}` : 'Geburtsdatum offen'}
              {location ? ` · ${location}` : ''}
            </Text>
          </View>
        </View>
        <View style={styles.openIndicator}>
          <Text style={styles.openIndicatorText}>→</Text>
        </View>
      </View>

      <View style={styles.badges}>
        <AuroraBadge label={WORKFLOW_STATUS_LABELS[client.status]} variant={statusVariant(client.status)} dot />
        <AuroraBadge label={SENSITIVITY_LABELS[client.sensitivity]} variant="muted" />
        {updatedAt ? <AuroraBadge label={`Stand ${updatedAt}`} variant="cyan" /> : null}
      </View>

      <View style={styles.factGrid}>
        {facts.map((fact) => (
          <View key={fact.label} style={styles.fact}>
            <Text style={styles.factIcon}>{fact.icon}</Text>
            <View style={styles.factText}>
              <Text style={styles.factLabel}>{fact.label}</Text>
              <Text style={styles.factValue} numberOfLines={2}>{fact.value}</Text>
            </View>
          </View>
        ))}
      </View>
    </AuroraGlassCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: careSpacing.sm },
  cardSelected: { borderColor: careSuiteAuroraTheme.accent.cyan, borderWidth: 2 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: careSpacing.sm,
  },
  identity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: careSpacing.sm },
  identityText: { flex: 1, minWidth: 0, gap: 3 },
  clientName: {
    color: careSuiteAuroraTheme.text.primary,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
  },
  clientMeta: {
    color: careSuiteAuroraTheme.text.secondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  openIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: careSuiteAuroraTheme.glass.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  openIndicatorText: { color: careSuiteAuroraTheme.accent.cyan, fontSize: 22, fontWeight: '900' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.xs },
  factGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
  fact: {
    flexGrow: 1,
    flexBasis: 190,
    minWidth: 160,
    minHeight: 66,
    paddingHorizontal: careSpacing.sm,
    paddingVertical: careSpacing.sm,
    borderRadius: careRadius.md,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: careSuiteAuroraTheme.glass.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
  },
  factIcon: { color: careSuiteAuroraTheme.accent.cyan, fontSize: 18, fontWeight: '900' },
  factText: { flex: 1, minWidth: 0, gap: 2 },
  factLabel: {
    color: careSuiteAuroraTheme.text.muted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  factValue: {
    color: careSuiteAuroraTheme.text.primary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
});
