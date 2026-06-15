import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CareLightKpiCard } from '@/components/ui/CareLightKpiCard';
import { CareLightPageShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumCard,
  SectionPanel,
  SegmentedTabs,
} from '@/components/ui';
import { useClientRecord } from '@/hooks/useClientRecord';
import { useClientFullDetail } from '@/hooks/useClientFullDetail';
import { fetchClientRecord } from '@/lib/clients/clientRecordService';
import { CLIENT_RECORD_TAB_LABELS, type ClientRecordTabKey } from '@/lib/clients/clientIntakeFieldRules';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { getCatalogLabel } from '@/lib/catalogs/systemCatalogs';
import { clientEditRoute } from '@/lib/navigation/clientRoutes';
import { ClientRecordTabContent } from '@/screens/business/office/ClientRecordTabPanels';
import {
  KontaktAdresseTab,
  StammdatenTab as FullStammdatenTab,
} from '@/screens/office/ClientFullDetailTabs';
import { colors, spacing, typography } from '@/theme';

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
      <View style={styles.tab}>
        <FullStammdatenTab client={fullClient} canViewSensitive={canViewSensitive} />
        <PremiumButton title="Stammdaten bearbeiten" variant="secondary" onPress={() => router.push(clientEditRoute(detail.id) as never)} />
      </View>
    );
  }

  const fields = [
    { label: 'Vorname', value: detail.firstName },
    { label: 'Nachname', value: detail.lastName },
    { label: 'Status', value: detail.status },
    { label: 'Pflegegrad', value: formatCareLevel(detail.careLevel) },
    { label: 'Ort', value: `${detail.city}, ${detail.zip}` },
    { label: 'Telefon', value: detail.phone ?? detail.primaryContactPhone ?? '—' },
  ];

  return (
    <View style={styles.tab}>
      <SectionPanel title="Stammdaten">
        {fields.map((f) => (
          <View key={f.label} style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{f.label}</Text>
            <Text style={styles.fieldValue}>{f.value}</Text>
          </View>
        ))}
        <PremiumButton title="Stammdaten bearbeiten" variant="secondary" onPress={() => router.push(clientEditRoute(detail.id) as never)} />
      </SectionPanel>
    </View>
  );
}

export function ClientRecordScreen({ initialTabOverride }: { initialTabOverride?: ClientRecordTabKey } = {}) {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { detail, careContexts, tabs, loading, error, refresh } = useClientRecord(id);
  const fullQuery = useClientFullDetail(id);
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

  if (!detail) {
    return (
      <CareLightPageShell title="Klient:innenakte" subtitle="Nicht gefunden">
        <EmptyState title="Nicht gefunden" message="Klient:in nicht gefunden." />
      </CareLightPageShell>
    );
  }

  const contextLabels = careContexts.map((c) => getCatalogLabel('leistungsart', c)).join(' · ');

  async function handleRecordRefresh() {
    await Promise.all([refresh(), fullQuery.refresh()]);
  }

  return (
    <CareLightPageShell title={`${detail.firstName} ${detail.lastName}`} subtitle={contextLabels}>
      <PremiumCard>
        <Text style={styles.headerMeta}>
          {formatCareLevel(detail.careLevel)} · {detail.city} · Status: {detail.status}
        </Text>
      </PremiumCard>
      <View style={styles.kpiRow}>
        <CareLightKpiCard label="Dokumente" value={String(detail.contextCounts?.documents ?? 0)} />
        <CareLightKpiCard label="Einsätze" value={String(detail.contextCounts?.assignments ?? 0)} />
        <CareLightKpiCard label="Rechnungen" value={String(detail.contextCounts?.invoices ?? 0)} />
        <CareLightKpiCard label="Termine" value={String(detail.contextCounts?.appointments ?? 0)} />
      </View>
      <SegmentedTabs tabs={tabOptions} activeKey={activeTab} onSelect={(k) => setActiveTab(k as ClientRecordTabKey)} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {activeTab === 'uebersicht' && (
          <SectionPanel title="Übersicht">
            <Text style={styles.body}>Leistungsarten: {contextLabels}</Text>
            <Text style={styles.body}>Hauptkontakt: {detail.primaryContactPhone ?? '—'}</Text>
            <Text style={styles.body}>Module: {careContexts.length} Kontext(e) aktiv</Text>
          </SectionPanel>
        )}
        {activeTab === 'stammdaten' && (
          <StammdatenTab detail={detail} fullClient={fullQuery.data} canViewSensitive={fullQuery.canViewSensitive} />
        )}
        {activeTab === 'kontakt' && fullQuery.data ? (
          <KontaktAdresseTab client={fullQuery.data} />
        ) : activeTab === 'kontakt' ? (
          <SectionPanel title="Kontakt & Adresse">
            <Text>{detail.street}</Text>
            <Text>{detail.zip} {detail.city}</Text>
            <Text>{detail.phone}</Text>
            <Text>{detail.email}</Text>
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
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  headerMeta: { ...typography.caption, color: colors.textMuted },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.sm },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl },
  tab: { paddingBottom: spacing.lg },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  fieldLabel: { ...typography.caption, color: colors.textMuted, flex: 1 },
  fieldValue: { ...typography.body, flex: 1, textAlign: 'right' },
  body: { ...typography.body, marginBottom: spacing.xs },
});
