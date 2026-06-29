import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAiPageContext } from '@/ai/useAiPageContext';
import { ContextCard, clientRecordKpiGridStyle, DetailInfoRow } from '@/components/detail';
import { ClientRecordHero } from '@/components/office/ClientRecordHero';
import { ClientSectionEditModal } from '@/components/office/ClientSectionEditModal';
import { ClientMasterDataEditModal } from '@/components/office/ClientMasterDataEditModal';
import { useSectionEditModal } from '@/hooks/useSectionEditModal';
import { OfficeRecordDeleteButton } from '@/components/office/OfficeRecordDeleteButton';
import { ClientRecordOverviewPanel } from '@/components/office/ClientRecordOverviewPanel';
import { ScreenShell } from '@/components/layout';
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
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { archiveClient, deleteClient } from '@/lib/office';
import { formatClientAddressLine } from '@/lib/clients/clientAddressResolver';
import { buildClientRecordOverview } from '@/lib/clients/clientRecordOverview';
import { formatCareLevel, formatSalutation } from '@/lib/formatters/unitFormatters';
import { getCatalogLabel } from '@/lib/catalogs/systemCatalogs';
import { CLIENT_RECORD_TAB_LABELS, resolveClientRecordTabKey, type ClientCareContext, type ClientRecordTabKey, type IntakeSectionKey } from '@/lib/clients/clientIntakeFieldRules';
import { buildClientDetailKpis } from '@/lib/office/clientDetailStats';
import { ClientRecordTabContent } from '@/screens/business/office/ClientRecordTabPanels';
import { AngehoerigeTab, KontaktAdresseTab } from '@/screens/office/ClientFullDetailTabs';
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
  onEditMasterData,
}: {
  detail: NonNullable<ReturnType<typeof useClientRecord>['detail']>;
  fullClient: ReturnType<typeof useClientFullDetail>['data'];
  canViewSensitive: boolean;
  careContexts: ClientCareContext[];
  onEditMasterData?: () => void;
}) {
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
          <DetailInfoRow label="Anrede" value={formatSalutation(fullClient.core.salutation) || '—'} />
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
      {onEditMasterData ? (
        <PremiumButton
          title="Stammdaten bearbeiten"
          variant="secondary"
          onPress={onEditMasterData}
        />
      ) : null}
    </View>
  );
}

export function ClientRecordScreen({
  initialTabOverride,
  clientId: clientIdProp,
  embedded = false,
  onDeleted,
  onEditMasterData,
  initialMasterDataEditOpen = false,
}: {
  initialTabOverride?: ClientRecordTabKey;
  clientId?: string;
  embedded?: boolean;
  embeddedInModal?: boolean;
  onDeleted?: () => void;
  onEditMasterData?: () => void;
  /** Opens ClientMasterDataEditModal on first render (e.g. list deep link ?edit=1). */
  initialMasterDataEditOpen?: boolean;
} = {}) {
  const { id: routeId, tab: tabParam, edit: editParam } = useLocalSearchParams<{
    id: string;
    tab?: string;
    edit?: string;
  }>();
  const id = clientIdProp ?? routeId;
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can } = usePermissions();
  const { detail, careContexts, tabs, loading, error, refresh } = useClientRecord(id);
  const fullQuery = useClientFullDetail(id);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const resolvedTabParam = resolveClientRecordTabKey(initialTabOverride ?? tabParam);
  const initialTab =
    resolvedTabParam && tabs.includes(resolvedTabParam)
      ? resolvedTabParam
      : 'uebersicht';
  const [activeTab, setActiveTab] = useState<ClientRecordTabKey>(initialTab);
  const [masterDataEditOpen, setMasterDataEditOpen] = useState(initialMasterDataEditOpen);
  const sectionEdit = useSectionEditModal<IntakeSectionKey>();

  useEffect(() => {
    const resolved = resolveClientRecordTabKey(resolvedTabParam);
    if (resolved && tabs.includes(resolved)) {
      setActiveTab(resolved);
    }
  }, [resolvedTabParam, tabs]);

  const handleEditMasterData = onEditMasterData ?? (() => setMasterDataEditOpen(true));
  const hostsLocalEditModal = !onEditMasterData;

  useEffect(() => {
    if (embedded || editParam !== '1' || !detail) return;
    if (!can('office.clients.edit')) return;
    if (onEditMasterData) {
      onEditMasterData();
    } else {
      setMasterDataEditOpen(true);
    }
    router.setParams({ edit: undefined } as never);
  }, [editParam, embedded, detail, router, onEditMasterData, can]);

  const tabOptions = tabs.map((t) => ({ key: t, label: CLIENT_RECORD_TAB_LABELS[t] ?? t }));

  const overview = useMemo(
    () => (detail ? buildClientRecordOverview(detail, careContexts, tabs) : null),
    [detail, careContexts, tabs],
  );

  const kpis = useMemo(
    () => (detail ? buildClientDetailKpis(detail, 'light') : []),
    [detail],
  );

  useAiPageContext({
    pageTitle: 'Klient:innenakte',
    entityType: 'client',
    entityId: detail?.id,
    entityLabel: detail ? `${detail.firstName} ${detail.lastName}`.trim() : undefined,
    activeTab,
    summary: overview?.fullName,
    metadata: {
      careContexts,
      status: detail?.status,
      careLevel: detail?.careLevel,
    },
  });

  if (loading) {
    return embedded ? (
      <LoadingState message="Akte wird geladen…" />
    ) : (
      <ScreenShell title="Klient:innenakte" subtitle="Wird geladen…">
        <LoadingState message="Akte wird geladen…" />
      </ScreenShell>
    );
  }

  if (error) {
    return embedded ? (
      <ErrorState message={error} onRetry={refresh} />
    ) : (
      <ScreenShell title="Klient:innenakte" subtitle="Fehler">
        <ErrorState message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  if (!detail || !overview) {
    return embedded ? (
      <EmptyState title="Nicht gefunden" message="Klient:in nicht gefunden." />
    ) : (
      <ScreenShell title="Klient:innenakte" subtitle="Nicht gefunden">
        <EmptyState title="Nicht gefunden" message="Klient:in nicht gefunden." />
      </ScreenShell>
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

  const headerActions =
    canArchive || canEdit ? (
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
            onPress={handleEditMasterData}
          />
        ) : null}
      </View>
    ) : null;

  const recordBody = (
    <>
      {!embedded ? (
        <ClientRecordHero
          firstName={detail.firstName}
          lastName={detail.lastName}
          careLevel={detail.careLevel}
          city={detail.city ?? null}
          status={detail.status}
          careContexts={careContexts}
          archiveError={archiveError}
          showEdit={canEdit}
          onEdit={handleEditMasterData}
        />
      ) : null}

      <View style={clientRecordKpiGridStyle}>
        {kpis.map((kpi) => (
          <ContextCard
            key={kpi.id}
            icon={kpi.icon ?? '📊'}
            label={kpi.label}
            count={Number(kpi.value) || 0}
            accentColor={kpi.accentColor}
          />
        ))}
      </View>

      <SegmentedTabs
        tabs={tabOptions}
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k as ClientRecordTabKey)}
        layout="wrap"
        rows={2}
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
            onEditMasterData={canEdit ? handleEditMasterData : undefined}
          />
        )}
        {activeTab === 'kontakt' && fullQuery.data ? (
          <View style={styles.tabStack}>
            <KontaktAdresseTab client={fullQuery.data} />
            <AngehoerigeTab client={fullQuery.data} />
          </View>
        ) : activeTab === 'kontakt' ? (
          <SectionPanel title="Kontakt & Adresse">
            <DetailInfoRow
              label="Adresse"
              value={formatClientAddressLine(detail.street, detail.zip, detail.city) || '—'}
            />
            <DetailInfoRow label="Telefon" value={detail.phone ?? '—'} />
            <DetailInfoRow label="E-Mail" value={detail.email ?? '—'} />
          </SectionPanel>
        ) : null}
        {activeTab === 'leistungsbereiche' ? (
          <ClientRecordTabContent
            tab="leistungsbereiche"
            clientId={detail.id}
            fullClient={fullQuery.data}
            canViewSensitive={fullQuery.canViewSensitive}
            onRecordRefresh={handleRecordRefresh}
          />
        ) : null}
        {!['uebersicht', 'stammdaten', 'kontakt', 'leistungsbereiche'].includes(activeTab) ? (
          <ClientRecordTabContent
            tab={activeTab}
            clientId={detail.id}
            fullClient={fullQuery.data}
            canViewSensitive={fullQuery.canViewSensitive}
            onRecordRefresh={handleRecordRefresh}
          />
        ) : null}
      </View>

      {canDelete ? (
        <SectionPanel title="Gefahrenzone" subtitle="Irreversible Aktionen">
          <OfficeRecordDeleteButton
            recordLabel="Klient:in"
            displayName={`${detail.firstName} ${detail.lastName}`}
            confirmTitle="Klient:in wirklich löschen?"
            buttonTitle="Klient:in löschen"
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
            onDeleted={() => {
              if (onDeleted) {
                onDeleted();
                return;
              }
              router.replace('/office/clients' as never);
            }}
          />
        </SectionPanel>
      ) : null}
    </>
  );

  if (embedded) {
    return (
      <>
        <View style={styles.embeddedRoot}>{recordBody}</View>
        {hostsLocalEditModal && sectionEdit.activeSection ? (
          <ClientSectionEditModal
            visible={sectionEdit.isOpen}
            clientId={detail.id}
            section={sectionEdit.activeSection}
            onClose={sectionEdit.closeSection}
            onSaved={() => {
              sectionEdit.closeSection();
              void handleRecordRefresh();
            }}
          />
        ) : null}
        {hostsLocalEditModal && masterDataEditOpen ? (
          <ClientMasterDataEditModal
            visible={masterDataEditOpen}
            clientId={detail.id}
            onClose={() => setMasterDataEditOpen(false)}
            onSaved={() => {
              setMasterDataEditOpen(false);
              void handleRecordRefresh();
            }}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <ScreenShell
        title="Klient:innenakte"
        subtitle={`${detail.firstName} ${detail.lastName}`}
        rightSlot={headerActions}
      >
        {recordBody}
      </ScreenShell>
      {hostsLocalEditModal && sectionEdit.activeSection ? (
        <ClientSectionEditModal
          visible={sectionEdit.isOpen}
          clientId={detail.id}
          section={sectionEdit.activeSection}
          onClose={sectionEdit.closeSection}
          onSaved={() => {
            sectionEdit.closeSection();
            void handleRecordRefresh();
          }}
        />
      ) : null}
      {hostsLocalEditModal && masterDataEditOpen ? (
        <ClientMasterDataEditModal
          visible={masterDataEditOpen}
          clientId={detail.id}
          onClose={() => setMasterDataEditOpen(false)}
          onSaved={() => {
            setMasterDataEditOpen(false);
            void handleRecordRefresh();
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
  },
  tabStack: {
    gap: careSpacing.md,
  },
  tabPanel: {
    gap: careSpacing.md,
    paddingBottom: spacing.xxl,
  },
  embeddedRoot: {
    gap: careSpacing.md,
    padding: careSpacing.md,
    paddingBottom: spacing.xxl,
  },
});
