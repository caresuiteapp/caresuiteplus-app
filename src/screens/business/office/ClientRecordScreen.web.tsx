import { usePageFlag } from '@/hooks/usePageFlag';
import { usePageTab } from '@/hooks/usePageTab';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAiPageContext } from '@/ai/useAiPageContext';
import { DetailInfoRow } from '@/components/detail';
import { ClientRecordNavigation, ClientRecordMetrics } from '@/components/office/ClientRecordNavigation.web';
import { ClientRecordHero } from '@/components/office/ClientRecordHero.web';
import { ClientSectionEditModal } from '@/components/office/ClientSectionEditModal';
import { ClientMasterDataEditModal } from '@/components/office/ClientMasterDataEditModal';
import { useSectionEditModal } from '@/hooks/useSectionEditModal';
import { OfficeRecordDeleteButton } from '@/components/office/OfficeRecordDeleteButton';
import { ClientRecordOverviewPanel } from '@/components/office/ClientRecordOverviewPanel.web';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  SectionPanel,
} from '@/components/ui';
import { useClientRecord } from '@/hooks/useClientRecord';
import { useClientFullDetail } from '@/hooks/useClientFullDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { loadClientIntakeDraft } from '@/lib/clients/clientIntakeDraftStorage';
import { persistClientIntakeDocuments } from '@/features/intakeDocuments/intakeDocumentService';
import { archiveClient, deleteClient } from '@/lib/office';
import { formatClientAddressLine } from '@/lib/clients/clientAddressResolver';
import { resolveClientInsuranceDisplay } from '@/lib/clients/clientInsurancePresentation.web';
import { buildClientRecordOverview, resolveClientCostBearer } from '@/lib/clients/clientRecordOverview.web';
import { formatCareLevel, formatSalutation } from '@/lib/formatters/unitFormatters';
import { getCatalogLabel } from '@/lib/catalogs/systemCatalogs';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { resolveClientRecordTabKey, type ClientCareContext, type ClientRecordTabKey, type IntakeSectionKey } from '@/lib/clients/clientIntakeFieldRules';
import { ClientRecordTabContent } from '@/screens/business/office/ClientRecordTabPanels.web';
import { AngehoerigeTab, KontaktAdresseTab } from '@/screens/office/ClientFullDetailTabs';
import { careSpacing } from '@/design/tokens/spacing';
import { spacing } from '@/theme';
import { SurfaceContrastProvider } from '@/design/tokens/surfaceContrast';

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
        <DetailInfoRow label="Kostenträger" value={resolveClientCostBearer(detail)} />
        <DetailInfoRow label="Versichertennummer" value={resolveClientInsuranceDisplay(fullClient ?? detail, canViewSensitive)} />
        <DetailInfoRow label="Leistungsart" value={serviceTypes} />
      </SectionPanel>
      {fullClient ? (
        <SectionPanel title="Weitere Stammdaten">
          <DetailInfoRow label="Anrede" value={formatSalutation(fullClient.core.salutation) || '—'} />
          <DetailInfoRow label="Geschlecht" value={fullClient.core.gender ? getCatalogLabel('gender', fullClient.core.gender) : null} />
          <DetailInfoRow label="Status" value={WORKFLOW_STATUS_LABELS[detail.status]} />
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

export function ClientRecordScreen(props: {
  initialTabOverride?: ClientRecordTabKey;
  clientId?: string;
  embedded?: boolean;
  embeddedInModal?: boolean;
  onDeleted?: () => void;
  onEditMasterData?: () => void;
  initialMasterDataEditOpen?: boolean;
} = {}) {
  const { id: routeId } = useLocalSearchParams<{ id: string }>();
  const tenantId = useServiceTenantId();
  const { user, profile } = useAuth();
  const recordScope = `${tenantId}:${props.clientId ?? routeId}:${user?.id ?? profile?.id}:${profile?.roleKey}`;
  return (
    <SurfaceContrastProvider tone="light">
      <ClientRecordScreenContent key={recordScope} {...props} />
    </SurfaceContrastProvider>
  );
}

function ClientRecordScreenContent({
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
  const { profile, user } = useAuth();
  const tenantId = useServiceTenantId();
  const { can } = usePermissions();
  const { detail, careContexts, tabs, loading, error, refresh } = useClientRecord(id);
  const fullQuery = useClientFullDetail(id);
  const fullClient = fullQuery.data?.id === id ? fullQuery.data : null;
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const resolvedTabParam = resolveClientRecordTabKey(initialTabOverride ?? tabParam);
  const initialTab =
    resolvedTabParam && tabs.includes(resolvedTabParam)
      ? resolvedTabParam
      : 'uebersicht';
  const [storedTab, setActiveTab] = usePageTab<ClientRecordTabKey>('ClientRecordScreen.activeTab', initialTab);
  const activeTab = tabs.includes(storedTab) ? storedTab : initialTab;
  const selectTab = (tab: ClientRecordTabKey) => {
    if (!tabs.includes(tab)) return;
    setActiveTab(tab);
    if (Platform.OS === 'web') router.setParams({ tab });
  };
  const [masterDataEditOpen, setMasterDataEditOpen] = usePageFlag('ClientRecordScreen.masterDataEditOpen', initialMasterDataEditOpen);
  const localSignedRecoveryAttemptedRef = useRef<string | null>(null);
  const sectionEdit = useSectionEditModal<IntakeSectionKey>();

  useEffect(() => {
    const userId = user?.id ?? profile?.id ?? null;
    if (!userId || !tenantId || !id || localSignedRecoveryAttemptedRef.current === id) return;
    localSignedRecoveryAttemptedRef.current = id;

    let cancelled = false;
    void loadClientIntakeDraft(userId, tenantId).then(async (draft) => {
      if (cancelled || !draft || draft.clientId !== id) return;
      const containsSignedDocument = draft.form.intakeDocuments.some((document) =>
        Object.values(document.signatures).some((signature) => Boolean(signature?.dataUrl)),
      );
      if (!containsSignedDocument) return;

      const recovered = await persistClientIntakeDocuments(
        tenantId,
        id,
        draft.form,
        profile?.id ?? user?.id ?? null,
      );
      if (!cancelled && recovered.ok) {
        await Promise.all([refresh(), fullQuery.refresh()]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [fullQuery, id, profile?.id, refresh, tenantId, user?.id]);

  useEffect(() => {
    const resolved = resolveClientRecordTabKey(resolvedTabParam);
    if (resolved && tabs.includes(resolved)) {
      setActiveTab(resolved);
    }
  }, [resolvedTabParam, tabs, setActiveTab]);

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
  }, [editParam, embedded, detail, router, onEditMasterData, can, setMasterDataEditOpen]);

  const overview = useMemo(
    () => (detail ? buildClientRecordOverview(detail, careContexts, tabs, undefined, fullQuery.canViewSensitive) : null),
    [detail, careContexts, tabs, fullQuery.canViewSensitive],
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

  const recordBody = (
    <div className="cr-shell">
      <ClientRecordHero
        clientId={detail.id}
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

      <ClientRecordMetrics
        documents={detail.contextCounts.documents}
        appointments={detail.contextCounts.appointments}
        assignments={detail.contextCounts.assignments}
        openItems={overview.openItemsCount}
        tabs={tabs}
        onChange={selectTab}
      />

      <ClientRecordNavigation tabs={tabs} value={activeTab} onChange={selectTab}>
      <View style={styles.tabPanel}>
        {activeTab === 'uebersicht' && overview ? (
          <ClientRecordOverviewPanel overview={overview} onNavigateTab={selectTab} clientId={detail.id} />
        ) : null}
        {activeTab === 'stammdaten' && (
          <StammdatenTab
            detail={detail}
            fullClient={fullClient}
            canViewSensitive={fullQuery.canViewSensitive}
            careContexts={careContexts}
            onEditMasterData={canEdit ? handleEditMasterData : undefined}
          />
        )}
        {activeTab === 'kontakt' && fullClient ? (
          <View style={styles.tabStack}>
            <KontaktAdresseTab client={fullClient} />
            <AngehoerigeTab client={fullClient} />
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
            fullClient={fullClient}
            canViewSensitive={fullQuery.canViewSensitive}
            onRecordRefresh={handleRecordRefresh}
          />
        ) : null}
        {!['uebersicht', 'stammdaten', 'kontakt', 'leistungsbereiche'].includes(activeTab) ? (
          <ClientRecordTabContent
            tab={activeTab}
            clientId={detail.id}
            fullClient={fullClient}
            canViewSensitive={fullQuery.canViewSensitive}
            onRecordRefresh={handleRecordRefresh}
          />
        ) : null}
      </View>

      </ClientRecordNavigation>

      {canArchive || canDelete ? (
        <details className="cr-record-management">
          <summary>Akte verwalten</summary>
          <p>Archivierte Akten bleiben erhalten. Das Löschen entfernt die Akte dauerhaft.</p>
          <div className="cr-management-actions">
            {canArchive ? <PremiumButton title="Akte archivieren" size="sm" variant="ghost" loading={archiving} onPress={handleArchive} /> : null}
            {canDelete ? (
          <OfficeRecordDeleteButton
            recordLabel="Klient:in"
            displayName={`${detail.firstName} ${detail.lastName}`}
            confirmTitle="Klient:in wirklich löschen?"
            buttonTitle="Klient:in löschen"
            onDelete={() => {
              if (!tenantId) {
                return Promise.resolve({ ok: false as const, error: 'Die Unternehmenszuordnung fehlt.' });
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
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
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
        subtitle="Betreuung, Unterlagen und Kontakt an einem Ort"
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
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
  },
  kpiCard: {
    flex: 1,
    minWidth: 142,
  },
});
