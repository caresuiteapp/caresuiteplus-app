import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ContextCard } from '@/components/detail';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { LockedActionBanner } from '@/components/permissions';
import { useClientDetail } from '@/hooks/useClientDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { SENSITIVITY_LABELS } from '@/types/portal/visibility';
import { clientEditRoute, clientRecordRoute } from '@/lib/navigation/clientRoutes';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { colors, spacing, typography } from '@/theme';

type ClientDetailSummaryPanelProps = {
  clientId: string;
};

function SummaryRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function ClientDetailSummaryPanel({ clientId }: ClientDetailSummaryPanelProps) {
  const router = useRouter();
  const { can, roleLabel, isReadOnly } = usePermissions();
  const { data: client, loading, error, refresh, notFound } = useClientDetail(clientId);

  if (loading) {
    return <LoadingState message="Klient:in wird geladen…" />;
  }

  if (notFound || error) {
    return (
      <View style={styles.panel}>
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Der Datensatz existiert nicht.'}
          onRetry={refresh}
        />
      </View>
    );
  }

  if (!client) return null;

  const fullName = `${client.firstName} ${client.lastName}`;
  const location = [client.zip, client.city].filter(Boolean).join(' ');
  const canViewSensitive = can('office.clients.view_sensitive');
  const isSensitive = client.sensitivity === 'health' || client.sensitivity === 'restricted';

  return (
    <View style={styles.panel}>
      <PremiumCard accentColor={colors.orange}>
        <Text style={styles.name}>{fullName}</Text>
        <View style={styles.badgeRow}>
          <PremiumBadge label={WORKFLOW_STATUS_LABELS[client.status]} variant="orange" dot />
          {client.careLevel ? (
            <PremiumBadge label={formatCareLevel(client.careLevel)} variant="cyan" />
          ) : null}
          {canViewSensitive ? (
            <PremiumBadge label={SENSITIVITY_LABELS[client.sensitivity]} variant="muted" />
          ) : null}
        </View>
        {location ? <Text style={styles.location}>{location}</Text> : null}
      </PremiumCard>

      {isReadOnly ? (
        <LockedActionBanner
          title="Lesemodus"
          message="Sie können Klient:innen-Daten einsehen, aber nicht bearbeiten."
          roleLabel={roleLabel}
        />
      ) : null}

      {isSensitive && !canViewSensitive ? (
        <LockedActionBanner
          title="Datenschutz-Hinweis"
          message="Gesundheitsdaten sind eingeschränkt. Sensible Felder werden maskiert."
          roleLabel={roleLabel}
        />
      ) : null}

      <SectionPanel title="Kontakt" subtitle="Erreichbarkeit und Adresse">
        <SummaryRow label="Telefon" value={client.phone ?? client.primaryContactPhone} />
        <SummaryRow label="E-Mail" value={client.email} />
        <SummaryRow
          label="Adresse"
          value={[client.street, location].filter(Boolean).join(', ') || null}
        />
        {client.contacts[0] ? (
          <SummaryRow
            label="Angehörige:r"
            value={`${client.contacts[0].name} (${client.contacts[0].relationship})`}
          />
        ) : (
          <EmptyState title="Keine Angehörigen" message="Noch keine Kontaktperson hinterlegt." />
        )}
      </SectionPanel>

      <SectionPanel title="Verknüpfte Bereiche" subtitle="Aktuelle Vorgänge">
        <View style={styles.contextGrid}>
          <ContextCard
            icon="📅"
            label="Einsätze"
            count={client.contextCounts.assignments}
            accentColor={colors.orange}
          />
          <ContextCard
            icon="📄"
            label="Dokumente"
            count={client.contextCounts.documents}
            accentColor={colors.cyan}
          />
          <ContextCard
            icon="🧾"
            label="Rechnungen"
            count={client.contextCounts.invoices}
            accentColor={colors.amber}
          />
          <ContextCard
            icon="🗓️"
            label="Termine"
            count={client.contextCounts.appointments}
            accentColor={colors.violet}
          />
        </View>
      </SectionPanel>

      {client.nextActionHint ? (
        <PremiumCard accentColor={colors.amber}>
          <Text style={styles.hintLabel}>Nächster Schritt</Text>
          <Text style={styles.hint}>{client.nextActionHint}</Text>
        </PremiumCard>
      ) : null}

      <View style={styles.actions}>
        {can('office.clients.edit') ? (
          <PremiumButton
            title="Stammdaten bearbeiten"
            variant="primary"
            fullWidth
            onPress={() => router.push(clientEditRoute(client.id) as never)}
          />
        ) : null}
        <PremiumButton
          title="Vollständige Akte öffnen"
          variant="secondary"
          fullWidth
          onPress={() => router.push(clientRecordRoute(client.id) as never)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  name: {
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  location: {
    ...typography.caption,
    color: colors.textMuted,
  },
  row: {
    marginBottom: spacing.sm,
  },
  rowLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 2,
  },
  rowValue: {
    ...typography.body,
  },
  contextGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  hintLabel: {
    ...typography.label,
    color: colors.orange,
    marginBottom: spacing.xs,
  },
  hint: {
    ...typography.body,
  },
  actions: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
});
