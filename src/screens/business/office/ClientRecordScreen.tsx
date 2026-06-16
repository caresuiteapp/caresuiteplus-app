import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ClientRecordHero } from '@/components/office/ClientRecordHero';
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
import { archiveClient } from '@/lib/office';
import { buildClientRecordOverview } from '@/lib/clients/clientRecordOverview';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { CLIENT_RECORD_TAB_LABELS, type ClientRecordTabKey } from '@/lib/clients/clientIntakeFieldRules';
import { buildClientDetailKpis } from '@/lib/office/clientDetailStats';
import { clientEditRoute } from '@/lib/navigation/clientRoutes';
import { ClientRecordTabContent } from '@/screens/business/office/ClientRecordTabPanels';
import {
  KontaktAdresseTab,
  StammdatenTab as FullStammdatenTab,
} from '@/screens/office/ClientFullDetailTabs';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { spacing } from '@/theme';

function StammdatenTab({
  detail,
  fullClient,
  canViewSensitive,
}: {
  detail: NonNullable<ReturnType<typeof useClientRecord>['detail']>;
  fullClient: ReturnType<typeof useClientFullDetail>['data'];
  canViewSensitive: boolean;
}) {
  const router = useRouter();
  if (fullClient) {
    return (
      <View style={styles.tabPanel}>
        <FullStammdatenTab client={fullClient} canViewSensitive={canViewSensitive} />
        <PremiumButton
          title="Stammdaten bearbeiten"
          variant="secondary"
          onPress={() => router.push(clientEditRoute(detail.id) as never)}
        />
      </View>
    );
  }

  const fields = [
    { label: 'Vorname', value: detail.firstName },
    { label: 'Nachname', value: detail.lastName },
    { label: 'Status', value: detail.status },
    { label: 'Pflegegrad', value: formatCareLevel(detail.careLevel) || '—' },
    { label: 'Ort', value: `${detail.city ?? '—'}, ${detail.zip ?? '—'}` },
    { label: 'Telefon', value: detail.phone ?? detail.primaryContactPhone ?? '—' },
  ];

  return (
    <View style={styles.tabPanel}>
      <SectionPanel title="Stammdaten">
        {fields.map((f) => (
          <View key={f.label} style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{f.label}</Text>
            <Text style={styles.fieldValue}>{f.value}</Text>
          </View>
        ))}
        <PremiumButton
          title="Stammdaten bearbeiten"
          variant="secondary"
          onPress={() => router.push(clientEditRoute(detail.id) as never)}
        />
      </SectionPanel>
    </View>
  );
}

export function ClientRecordScreen({ initialTabOverride }: { initialTabOverride?: ClientRecordTabKey } = {}) {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
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
        can('office.clients.archive') && detail.status !== 'archiviert' ? (
          <PremiumButton
            title="Archivieren"
            size="sm"
            variant="ghost"
            loading={archiving}
            onPress={handleArchive}
          />
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
          />
        )}
        {activeTab === 'kontakt' && fullQuery.data ? (
          <KontaktAdresseTab client={fullQuery.data} />
        ) : activeTab === 'kontakt' ? (
          <SectionPanel title="Kontakt & Adresse">
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Adresse</Text>
              <Text style={styles.fieldValue}>
                {[detail.street, detail.zip, detail.city].filter(Boolean).join(', ') || '—'}
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
