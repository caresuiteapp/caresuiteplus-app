import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { ClientRecordHero } from '@/components/office/ClientRecordHero';
import { OfficeRecordDeleteButton } from '@/components/office/OfficeRecordDeleteButton';
import { ClientRecordOverviewPanel } from '@/components/office/ClientRecordOverviewPanel';
import { CareLightKpiCard } from '@/components/ui/CareLightKpiCard';
import { CareLightPageShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  SectionPanel,
  SegmentedTabs,
} from '@/components/ui';
import { useClientRecord } from '@/hooks/useClientRecord';
import { useClientFullDetail } from '@/hooks/useClientFullDetail';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { archiveClient, deleteClient } from '@/lib/office';
import { formatClientAddressLine } from '@/lib/clients/clientAddressResolver';
import { buildClientRecordOverview } from '@/lib/clients/clientRecordOverview';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { getCatalogLabel } from '@/lib/catalogs/systemCatalogs';
import { CLIENT_RECORD_TAB_LABELS, type ClientCareContext, type ClientRecordTabKey } from '@/lib/clients/clientIntakeFieldRules';
import { buildClientDetailKpis } from '@/lib/office/clientDetailStats';
import { clientEditRoute } from '@/lib/navigation/clientRoutes';
import { ClientRecordTabContent } from '@/screens/business/office/ClientRecordTabPanels';
import { KontaktAdresseTab } from '@/screens/office/ClientFullDetailTabs';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { spacing } from '@/theme';

function resolvePrimaryAddress(
  detail: NonNullable<ReturnType<typeof useClientRecord>['detail']>,
  fullClient: ReturnType<typeof useClientFullDetail>['data'],
): string {
  const primary = fullClient?.addresses.find((a) => a.isPrimary) ?? fullClient?.addresses[0];
  if (primary) {
    return formatClientAddressLine(primary.street, primary.zip, primary.city) || '—';
  }
  return formatClientAddressLine(detail.street, detail.zip, detail.city) || '—';
}

function StammdatenTab({
  detail,
  fullClient,
  canViewSensitive,
  careContexts,
}: {
  detail: NonNullable<ReturnType<typeof useClientRecord>['detail']>;
  fullClient: ReturnType<typeof useClientFullDetail>['data'];
  canViewSensitive: boolean;
  careContexts: ClientCareContext[];
}) {
  const router = useRouter();
  const serviceTypes =
    careContexts.length > 0
      ? careContexts.map((ctx) => getCatalogLabel('leistungsart', ctx)).join(' · ')
      : '—';
  const phone = detail.phone ?? detail.primaryContactPhone ?? fullClient?.phone ?? '—';
  const email = detail.email ?? fullClient?.email ?? '—';

  return (
    <View style={styles.tabPanel}>
      <SectionPanel title="Stammdaten">
        <DetailInfoRow label="Name" value={`${detail.firstName} ${detail.lastName}`.trim()} />
        <DetailInfoRow
          label="Geburtsdatum"
          value={
            detail.dateOfBirth
              ? new Date(detail.dateOfBirth).toLocaleDateString('de-DE')
              : fullClient?.core.dateOfBirth
                ? new Date(fullClient.core.dateOfBirth).toLocaleDateString('de-DE')
                : null
          }
        />
        <DetailInfoRow label="Adresse" value={resolvePrimaryAddress(detail, fullClient)} />
        <DetailInfoRow label="Telefon" value={phone} />
        <DetailInfoRow label="E-Mail" value={email} />
        <DetailInfoRow label="Pflegegrad" value={formatCareLevel(detail.careLevel) || '—'} />
        <DetailInfoRow label="Leistungsart" value={serviceTypes} />
      </SectionPanel>
      {fullClient ? (
        <SectionPanel title="Weitere Stammdaten">
          <DetailInfoRow label="Anrede" value={fullClient.core.salutation} />
          <DetailInfoRow label="Geschlecht" value={fullClient.core.gender} />
          <DetailInfoRow label="Status" value={detail.status} />
          <DetailInfoRow
            label="Versichertennummer"
            value={
              fullClient.core.insuranceNumber
                ? canViewSensitive
                  ? fullClient.core.insuranceNumber
                  : '••• Geschützt'
                : null
            }
          />
          <DetailInfoRow
            label="Schlüsseltresor"
            value={
              fullClient.core.keySafeCode
                ? canViewSensitive
                  ? fullClient.core.keySafeCode
                  : '••• Geschützt'
                : null
            }
          />
          {fullClient.core.diagnoses.length > 0 ? (
            <DetailInfoRow
              label="Diagnosen"
              value={
                canViewSensitive
                  ? fullClient.core.diagnoses.join(', ')
                  : '••• Geschützt'
              }
            />
          ) : null}
        </SectionPanel>
      ) : null}
      <PremiumButton
        title="Stammdaten bearbeiten"
        variant="secondary"
        onPress={() => router.push(clientEditRoute(detail.id) as never)}
      />
    </View>
  );
}

export function ClientRecordScreen({ initialTabOverride }: { initialTabOverride?: ClientRecordTabKey } = {}) {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can } = usePermissions();
  const { isDesktopOrWide } = useDeviceClass();
  const { detail, careContexts, tabs, loading, error, refresh } = useClientRecord(id);
  const fullQuery = useClientFullDetail(id);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const resolvedTabParam = initialTabOverride ?? tabParam;
  const initialTab =
    resolvedTabParam && tabs.includes(resolvedTabParam as ClientRecordTabKey)
      ? (resolvedTabParam as ClientRecordTabKey)
      : 'uebersicht';
  const [activeTab, setActiveTab] = useState<ClientRecordTabKey>(initialTab);

  useEffect(() => {
    if (resolvedTabParam && tabs.includes(resolvedTabParam as ClientRecordTabKey)) {
      setActiveTab(resolvedTabParam as ClientRecordTabKey);
    }
  }, [resolvedTabParam, tabs]);

  const tabOptions = tabs.map((t) => ({ key: t, label: CLIENT_RECORD_TAB_LABELS[t] ?? t }));

  const overview = useMemo(
    () => (detail ? buildClientRecordOverview(detail, careContexts, tabs) : null),
    [detail, careContexts, tabs],
  );

  const kpis = useMemo(
    () => (detail ? buildClientDetailKpis(detail, 'light') : []),
    [detail],
  );

  if (loading) {
    return (
      <CareLightPageShell title="Klient:innenakte" subtitle="Wird geladen…">
        <LoadingState message="Akte wird geladen…" />
      </CareLightPageShell>
    );
  }

  if (error) {
    return (
      <CareLightPageShell title="Klient:innenakte" subtitle="Fehler">
        <ErrorState message={error} onRetry={refresh} />
      </CareLightPageShell>
    );
  }

  if (!detail || !overview) {
    return (
      <CareLightPageShell title="Klient:innenakte" subtitle="Nicht gefunden">
        <EmptyState title="Nicht gefunden" message="Klient:in nicht gefunden." />
      </CareLightPageShell>
    );
  }

  const canEdit = can('office.clients.edit');
  const canArchive = can('office.clients.archive') && detail.status !== 'archiviert';
  const canDelete = can('office.clients.delete');

  async function handleRecordRefresh() {
    await Promise.all([refresh(), fullQuery.refresh()]);
  }

  async function handleArchive() {
    if (!detail || !tenantId) return;
    setArchiving(true);
    setArchiveError(null);
    const result = await archiveClient(
      detail.id,
      tenantId,
      profile?.roleKey,
      profile?.id,
      profile?.displayName,
    );
    setArchiving(false);
    if (result.ok) {
      await handleRecordRefresh();
      return;
    }
    setArchiveError(result.error);
  }

  return (
    <CareLightPageShell
      title="Klient:innenakte"
      subtitle={`${detail.firstName} ${detail.lastName}`}
      rightSlot={
        canArchive || canEdit || canDelete ? (
          <View style={styles.headerActions}>
            {canArchive ? (
              <PremiumButton
                title="Archivieren"
                size="sm"
                variant="ghost"
                loading={archiving}
                onPress={handleArchive}
              />
            ) : null}
            {canEdit ? (
              <PremiumButton
                title="Stammdaten bearbeiten"
                size="sm"
                variant="secondary"
                onPress={() => router.push(clientEditRoute(detail.id) as never)}
              />
            ) : null}
            {canDelete ? (
              <View style={styles.headerDelete}>
                <OfficeRecordDeleteButton
                  recordLabel="Klient:in"
                  displayName={`${detail.firstName} ${detail.lastName}`}
                  fullWidth={false}
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
                  onDeleted={() => router.replace('/office/clients' as never)}
                />
              </View>
            ) : null}
          </View>
        ) : null
      }
    >
      <ClientRecordHero
        firstName={detail.firstName}
        lastName={detail.lastName}
        careLevel={detail.careLevel}
        city={detail.city ?? null}
        status={detail.status}
        careContexts={careContexts}
        archiveError={archiveError}
        showEdit={canEdit}
        onEdit={() => router.push(clientEditRoute(detail.id) as never)}
      />

      <View style={[styles.kpiGrid, isDesktopOrWide && styles.kpiGridWide]}>
        {kpis.map((kpi) => (
          <CareLightKpiCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            subValue={kpi.subValue}
            icon={kpi.icon}
            iconKey={kpi.iconKey}
            accentColor={kpi.accentColor ?? careLightColors.orange}
            style={styles.kpiItem}
          />
        ))}
      </View>

      <SegmentedTabs
        tabs={tabOptions}
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k as ClientRecordTabKey)}
      />

      <View style={styles.tabPanel}>
        {activeTab === 'uebersicht' && overview ? (
          <ClientRecordOverviewPanel overview={overview} onNavigateTab={setActiveTab} />
        ) : null}
        {activeTab === 'stammdaten' && (
          <StammdatenTab
            detail={detail}
            fullClient={fullQuery.data}
            canViewSensitive={fullQuery.canViewSensitive}
            careContexts={careContexts}
          />
        )}
        {activeTab === 'kontakt' && fullQuery.data ? (
          <KontaktAdresseTab client={fullQuery.data} />
        ) : activeTab === 'kontakt' ? (
          <SectionPanel title="Kontakt & Adresse">
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Adresse</Text>
              <Text style={styles.fieldValue}>
                {formatClientAddressLine(detail.street, detail.zip, detail.city) || '—'}
              </Text>
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Telefon</Text>
              <Text style={styles.fieldValue}>{detail.phone ?? '—'}</Text>
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>E-Mail</Text>
              <Text style={styles.fieldValue}>{detail.email ?? '—'}</Text>
            </View>
          </SectionPanel>
        ) : null}
        {!['uebersicht', 'stammdaten', 'kontakt'].includes(activeTab) ? (
          <ClientRecordTabContent
            tab={activeTab}
            clientId={detail.id}
            fullClient={fullQuery.data}
            canViewSensitive={fullQuery.canViewSensitive}
            onRecordRefresh={handleRecordRefresh}
          />
        ) : null}
      </View>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
  },
  kpiGridWide: {
    flexWrap: 'nowrap',
  },
  kpiItem: {
    flex: 1,
    minWidth: 140,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
  },
  headerDelete: {
    minWidth: 96,
  },
  tabPanel: {
    gap: careSpacing.md,
    paddingBottom: spacing.xxl,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: careLightColors.border,
  },
  fieldLabel: {
    flex: 1,
    color: careLightColors.muted,
    fontWeight: '600',
  },
  fieldValue: {
    flex: 1,
    textAlign: 'right',
    color: careLightColors.text,
  },
});
