import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ClientDetailLinkTile } from './ClientDetailLinkTile';
import { OfficeRecordDeleteButton } from './OfficeRecordDeleteButton';
import {
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  PremiumKpiCard,
  SectionPanel,
} from '@/components/ui';
import { LockedActionBanner } from '@/components/permissions';
import { useClientRecord } from '@/hooks/useClientRecord';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { deleteClient } from '@/lib/office/clientDetailService';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { buildClientRecordOverview } from '@/lib/clients/clientRecordOverview';
import { buildClientDetailKpis } from '@/lib/office/clientDetailStats';
import type { ClientRecordTabKey } from '@/lib/clients/clientIntakeFieldRules';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { SENSITIVITY_LABELS } from '@/types/portal/visibility';
import { clientEditRoute, clientRecordRoute, clientRecordTabRoute } from '@/lib/navigation/clientRoutes';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { colors, spacing, typography } from '@/theme';

type ClientDetailSummaryPanelProps = {
  clientId: string;
  onDeleted?: () => void;
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

function statusVariant(status: string) {
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

const LINKED_AREAS: Array<{
  id: string;
  icon: string;
  label: string;
  tab: ClientRecordTabKey;
  countKey: 'documents' | 'assignments' | 'appointments' | 'invoices';
  accentColor: string;
}> = [
  { id: 'documents', icon: '📄', label: 'Dokumente', tab: 'dokumente', countKey: 'documents', accentColor: colors.cyan },
  { id: 'assignments', icon: '📅', label: 'Einsätze', tab: 'einsaetze', countKey: 'assignments', accentColor: colors.orange },
  { id: 'appointments', icon: '🗓️', label: 'Termine', tab: 'uebersicht', countKey: 'appointments', accentColor: colors.violet },
  { id: 'invoices', icon: '🧾', label: 'Rechnungen', tab: 'abrechnung', countKey: 'invoices', accentColor: colors.amber },
];

export function ClientDetailSummaryPanel({ clientId, onDeleted }: ClientDetailSummaryPanelProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { mode } = useLegacyTheme();
  const { can, roleLabel, isReadOnly } = usePermissions();
  const { detail, careContexts, tabs, loading, error, refresh } = useClientRecord(clientId);
  const notFound = !loading && !error && !detail;

  const overview = useMemo(
    () => (detail ? buildClientRecordOverview(detail, careContexts, tabs) : null),
    [detail, careContexts, tabs],
  );

  const kpis = useMemo(
    () => (detail ? buildClientDetailKpis(detail, mode) : []),
    [detail, mode],
  );

  const kpiCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const kpi of kpis) {
      map[kpi.id] = Number(kpi.value) || 0;
    }
    return map;
  }, [kpis]);

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

  if (!detail || !overview) return null;

  const fullName = `${detail.firstName} ${detail.lastName}`;
  const location = [detail.zip, detail.city].filter(Boolean).join(' ');
  const canViewSensitive = can('office.clients.view_sensitive');
  const isSensitive = detail.sensitivity === 'health' || detail.sensitivity === 'restricted';
  const addressLine = [detail.street, location].filter(Boolean).join(', ') || null;
  const contactPerson = detail.contacts[0]
    ? `${detail.contacts[0].name} (${detail.contacts[0].relationship})`
    : null;

  const openRecordTab = (tab: ClientRecordTabKey) => {
    router.push(clientRecordTabRoute(detail.id, tab) as never);
  };

  return (
    <View style={styles.panel}>
      <PremiumCard accentColor={colors.orange}>
        <Text style={styles.name}>{fullName}</Text>
        <View style={styles.badgeRow}>
          <PremiumBadge
            label={WORKFLOW_STATUS_LABELS[detail.status]}
            variant={statusVariant(detail.status)}
            dot
          />
          {detail.careLevel ? (
            <PremiumBadge label={formatCareLevel(detail.careLevel)} variant="cyan" />
          ) : null}
          {canViewSensitive && isSensitive ? (
            <PremiumBadge label={SENSITIVITY_LABELS[detail.sensitivity]} variant="muted" />
          ) : null}
        </View>
        {location ? <Text style={styles.location}>{location}</Text> : null}

        <View style={styles.heroActions}>
          <PremiumButton
            title="Akte öffnen"
            variant="primary"
            onPress={() => router.push(clientRecordRoute(detail.id) as never)}
            style={styles.heroActionPrimary}
          />
          {can('office.clients.edit') ? (
            <PremiumButton
              title="Bearbeiten"
              variant="secondary"
              onPress={() => router.push(clientEditRoute(detail.id) as never)}
              style={styles.heroActionSecondary}
            />
          ) : null}
        </View>
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

      <View style={styles.kpiRow}>
        {kpis.map((kpi) => (
          <PremiumKpiCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            iconKey={kpi.iconKey}
            accentColor={kpi.accentColor}
            style={styles.kpiItem}
          />
        ))}
      </View>

      <SectionPanel title="Kontakt" subtitle="Erreichbarkeit und Adresse">
        <SummaryRow label="Telefon" value={detail.phone ?? detail.primaryContactPhone} />
        <SummaryRow label="E-Mail" value={detail.email} />
        <SummaryRow label="Adresse" value={addressLine} />
        {contactPerson ? <SummaryRow label="Angehörige:r" value={contactPerson} /> : null}
      </SectionPanel>

      <SectionPanel title="Versorgung" subtitle="Kostenträger und Leistungsart">
        <SummaryRow label="Kostenträger" value={overview.primaryCostBearer !== '—' ? overview.primaryCostBearer : null} />
        <SummaryRow label="Leistungsart" value={overview.serviceTypes !== '—' ? overview.serviceTypes : null} />
      </SectionPanel>

      <SectionPanel title="Verknüpfte Bereiche" subtitle="Direkt in der Akte öffnen">
        <View style={styles.linkGrid}>
          {LINKED_AREAS.map((area) => (
            <ClientDetailLinkTile
              key={area.id}
              icon={area.icon}
              label={area.label}
              count={kpiCountMap[area.countKey] ?? 0}
              accentColor={area.accentColor}
              onPress={() => openRecordTab(area.tab)}
            />
          ))}
        </View>
      </SectionPanel>

      {detail.nextActionHint ? (
        <PremiumCard accentColor={colors.amber}>
          <Text style={styles.hintLabel}>Nächster Schritt</Text>
          <Text style={styles.hint}>{detail.nextActionHint}</Text>
        </PremiumCard>
      ) : null}

      {can('office.clients.delete') ? (
        <OfficeRecordDeleteButton
          recordLabel="Klient:in"
          displayName={fullName}
          onDelete={() => {
            if (!tenantId) {
              return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
            }
            return deleteClient(
              detail.id,
              tenantId,
              profile?.roleKey,
              profile?.id,
              profile?.displayName,
            );
          }}
          onDeleted={onDeleted}
        />
      ) : null}
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
    marginBottom: spacing.sm,
  },
  heroActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  heroActionPrimary: {
    flex: 1,
  },
  heroActionSecondary: {
    flex: 1,
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kpiItem: {
    flex: 1,
    minWidth: 120,
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
  linkGrid: {
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
});
