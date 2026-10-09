import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  PlatformDataTable,
  PlatformFilterChip,
  PlatformFilterChipRow,
  PlatformShellLayout,
  PlatformStatusBadge,
  PlatformTenantEnvironmentBadge,
  PLATFORM_COLORS,
} from '@/components/platformConsole';
import { ErrorState, LoadingState } from '@/components/ui';
import { resolvePlatformTenantDetailId } from '@/lib/platformConsole';
import { listPlatformCompanies } from '@/lib/platformConsole/platformCompanyDirectoryService';
import { usePlatformAuth } from '@/lib/platformConsole/PlatformAuthProvider';
import { getTenantDossierSummaries } from '@/lib/platformConsole/tenantDossierService';
import { buildTenantSetup, safeDossierLogo, type TenantDossier } from '@/lib/platformConsole/tenantDossierModel';
import type { PlatformTenantListItem } from '@/types/platformConsole';
import { spacing } from '@/theme';

export function PlatformTenantsScreen() {
  const router = useRouter();
  const { platformUser } = usePlatformAuth();
  const dossierOwner = platformUser?.role === 'platform_owner';
  const [summaries, setSummaries] = useState<Record<string, TenantDossier>>({});
  const [dossierError, setDossierError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0), [hasMore, setHasMore] = useState(false), [listWidth, setListWidth] = useState(0);
  const { width, fontScale } = useWindowDimensions();
  const compact = (listWidth || width) < (dossierOwner ? 1280 : 1000) * Math.max(1, fontScale);
  const requestNumber = useRef(0);
  const [items, setItems] = useState<PlatformTenantListItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [billingFilter, setBillingFilter] = useState('');
  const [environmentFilter, setEnvironmentFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const openTenantDetail = useCallback(
    (row: PlatformTenantListItem) => {
      const detailId = resolvePlatformTenantDetailId(row);
      if (!detailId) return;
      router.push(`/platform/tenants/${detailId}` as never);
    },
    [router],
  );

  const load = useCallback(async () => {
    const request = ++requestNumber.current;
    setLoading(true);
    setError(null);
    setDossierError(null); setSummaries({});
    try {
    const result = await listPlatformCompanies({
      search: search.trim() || undefined,
      status: statusFilter || undefined,
      billingStatus: billingFilter || undefined,
      environment: environmentFilter || undefined, limit: 51, offset,
    });
    if (request !== requestNumber.current) return;
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    const visible = result.data.items.slice(0, 50);
    setHasMore(result.data.items.length > 50); setItems(visible);
    if (dossierOwner) {
      const summary = await getTenantDossierSummaries(visible.map(resolvePlatformTenantDetailId).filter((id): id is string => !!id));
      if (request !== requestNumber.current) return;
      if (summary.ok) setSummaries(Object.fromEntries(summary.data.map(item => [item.tenantId, item])));
      else setDossierError(summary.error);
    }
    } catch (cause) { if (request === requestNumber.current) setError(cause instanceof Error ? cause.message : 'Unternehmen konnten nicht geladen werden.'); }
    finally { if (request === requestNumber.current) setLoading(false); }
  }, [billingFilter, environmentFilter, search, statusFilter, offset, dossierOwner]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 300);
    return () => { clearTimeout(timer); requestNumber.current++; };
  }, [load]);

  const columns = useMemo(
    () => [
      {
        key: 'tenantName',
        label: 'Mandant',
        render: (row: PlatformTenantListItem) => {
          const summary = dossierOwner ? summaries[resolvePlatformTenantDetailId(row) ?? ''] : undefined;
          const raw = safeDossierLogo(summary?.branding?.logo_url), logo = raw?.startsWith('/') ? 'https://www.caresuiteplus.app' + raw : raw;
          return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 }}>{logo ? <Image source={{ uri: logo }} style={{ width: 38, height: 38 }} contentFit="contain" cachePolicy="memory" allowDownscaling recyclingKey={String(summary?.tenantId) + logo} accessibilityLabel={`Logo ${row.tenantName}`} /> : null}<Text style={[styles.cellPrimary, { flexShrink: 1 }]}>{row.tenantName}</Text></View>;
        },
      },
      {
        key: 'environment',
        label: 'Datenart',
        render: (row: PlatformTenantListItem) => <PlatformTenantEnvironmentBadge mode={row.environmentMode} />,
      },
      { key: 'status', label: 'Status', render: (row: PlatformTenantListItem) => <PlatformStatusBadge status={row.status} /> },
      { key: 'freeUsage', label: 'Nutzung', render: () => 'Kostenlos · 0 €' },
      { key: 'setup', label: 'Einrichtung', render: (row: PlatformTenantListItem) => {
        const summary = dossierOwner ? summaries[resolvePlatformTenantDetailId(row) ?? ''] : undefined;
        if (summary) { const setup = buildTenantSetup(summary); return `${setup.percentage}% · ${setup.complete}/${setup.applicable} Schritte`; }
        return row.lifecycleStatus === 'onboarding' ? 'Neu · Einrichtung läuft' : row.lifecycleStatus === 'live' ? 'Im Betrieb' : row.lifecycleStatus;
      } },
      ...(dossierOwner ? [
        { key: 'clients', label: 'Klient:innen', render: (row: PlatformTenantListItem) => String(summaries[resolvePlatformTenantDetailId(row) ?? '']?.counts.clients.total ?? '—') },
        { key: 'employees', label: 'Mitarbeitende', render: (row: PlatformTenantListItem) => String(summaries[resolvePlatformTenantDetailId(row) ?? '']?.counts.employees.total ?? '—') },
      ] : []),
      {
        key: 'activeModuleCount',
        label: 'Module',
        render: (row: PlatformTenantListItem) => String(row.activeModuleCount),
      },
      {
        key: 'actions',
        label: '',
        render: (row: PlatformTenantListItem) => {
          const detailId = resolvePlatformTenantDetailId(row);
          if (!detailId) {
            return (
              <Text style={styles.muted} accessibilityLabel="Mandanten-ID fehlt">
                Mandanten-ID fehlt
              </Text>
            );
          }
          return (
            <Pressable onPress={() => openTenantDetail(row)} accessibilityLabel="Mandant öffnen">
              <Text style={styles.link}>Öffnen</Text>
            </Pressable>
          );
        },
      },
    ],
    [openTenantDetail, dossierOwner, summaries],
  );

  return (
    <PlatformShellLayout title="Mandanten" subtitle="Suche, Filter und Verwaltung aller Mandanten">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
      <View style={styles.toolbar}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={value => { setSearch(value); setOffset(0); }}
          placeholder="Name, Kürzel oder E-Mail…"
          placeholderTextColor={PLATFORM_COLORS.muted}
          onSubmitEditing={() => void load()}
        />
        <Pressable style={styles.searchBtn} onPress={() => void load()}>
          <Text style={styles.searchBtnText}>Suchen</Text>
        </Pressable>
      </View>
      <View style={styles.filters}>
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Echt- oder Testmandant</Text>
          <PlatformFilterChipRow>
            {[
              ['', 'Alle'], ['production', 'Echt / Produktion'], ['pilot', 'Fiktive Piloten'],
              ['demo', 'Demo'], ['internal_test', 'Interne Tests'], ['sandbox', 'Sandbox'], ['unclassified', 'Ungeklärt'],
            ].map(([key, label]) => <PlatformFilterChip key={key || 'all'} label={label} active={environmentFilter === key} onPress={() => { setEnvironmentFilter(key); setOffset(0); }} />)}
          </PlatformFilterChipRow>
        </View>
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Mandantenstatus</Text>
          <PlatformFilterChipRow>
            {[
              ['', 'Alle'], ['active', 'Aktiv'], ['suspended', 'Gesperrt'], ['locked', 'Blockiert'], ['terminated', 'Beendet'],
            ].map(([key, label]) => <PlatformFilterChip key={key || 'all'} label={label} active={statusFilter === key} onPress={() => { setStatusFilter(key); setOffset(0); }} />)}
          </PlatformFilterChipRow>
        </View>
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Abrechnung</Text>
          <PlatformFilterChipRow>
            {[
              ['', 'Alle'], ['active', 'Aktiv'], ['trial', 'Testphase'], ['past_due', 'Überfällig'], ['failed', 'Fehlgeschlagen'],
            ].map(([key, label]) => <PlatformFilterChip key={key || 'all'} label={label} active={billingFilter === key} onPress={() => { setBillingFilter(key); setOffset(0); }} />)}
          </PlatformFilterChipRow>
        </View>
      </View>
      {dossierOwner && dossierError ? <View style={styles.toolbar}><Text accessibilityRole="alert" style={styles.muted}>{dossierError}</Text><Pressable accessibilityRole="button" style={styles.searchBtn} onPress={() => void load()}><Text style={styles.searchBtnText}>Erneut laden</Text></Pressable></View> : null}
      <View onLayout={event => setListWidth(event.nativeEvent.layout.width)}>
      {loading ? (
        <LoadingState message="Mandanten werden geladen…" />
      ) : error ? (
        <ErrorState title="Liste nicht verfügbar" message={error} onRetry={() => void load()} />
      ) : (
        compact ? items.length ? <View style={{ gap: 12 }}>{items.map((row, index) => <View key={resolvePlatformTenantDetailId(row) ?? String(index)} style={styles.companyCard}>{columns.map(column => {
          const value = column.render(row);
          return <View key={column.key} style={{ gap: 5, minWidth: 0 }}>{column.label ? <Text style={styles.filterLabel}>{column.label}</Text> : null}{typeof value === 'string' || typeof value === 'number' ? <Text style={styles.cellPrimary}>{value}</Text> : value}</View>;
        })}</View>)}</View> : <Text style={styles.muted}>Keine passenden Mandanten. Bitte Suche und Filter prüfen.</Text> : <PlatformDataTable
            columns={columns.map((col) => ({
              ...col,
              minWidth: col.key === 'actions' ? 88 : col.key === 'tenantName' ? 180 : 110,
            }))}
            data={items}
            keyExtractor={(row, index) => resolvePlatformTenantDetailId(row) ?? `tenant-${index}`}
            emptyTitle="Keine Mandanten"
            emptyMessage="Passen Sie die Suche an oder prüfen Sie die Berechtigungen."
          />
      )}
      </View>
      <View style={[styles.toolbar, { marginTop: 14, flexWrap: 'wrap' }]}><Text style={styles.muted}>Seite {Math.floor(offset / 50) + 1} · {items.length} Unternehmen</Text><Pressable accessibilityRole="button" disabled={loading || offset === 0} style={styles.searchBtn} onPress={() => setOffset(value => Math.max(0, value - 50))}><Text style={styles.searchBtnText}>Zurück</Text></Pressable><Pressable accessibilityRole="button" disabled={loading || !hasMore} style={styles.searchBtn} onPress={() => setOffset(value => value + 50)}><Text style={styles.searchBtnText}>Weitere Unternehmen</Text></Pressable></View>
      </ScrollView>
    </PlatformShellLayout>
  );
}

const styles = StyleSheet.create({
  companyCard: { backgroundColor: PLATFORM_COLORS.panel, borderColor: PLATFORM_COLORS.border, borderWidth: 1, borderRadius: 14, padding: 16, gap: 12 },
  toolbar: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  filters: { gap: spacing.sm, marginBottom: spacing.md },
  filterGroup: { gap: 5 },
  filterLabel: { color: PLATFORM_COLORS.muted, fontSize: 11, fontWeight: '700' },
  search: {
    flex: 1,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    color: PLATFORM_COLORS.text,
    backgroundColor: PLATFORM_COLORS.panel,
  },
  searchBtn: {
    minHeight: 44,
    paddingVertical: 10,
    backgroundColor: PLATFORM_COLORS.panel,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  searchBtnText: { color: PLATFORM_COLORS.accent, fontWeight: '600' },
  cellPrimary: { color: PLATFORM_COLORS.text, fontWeight: '600' },
  link: { color: PLATFORM_COLORS.accent, fontWeight: '600' },
  muted: { color: PLATFORM_COLORS.muted, fontSize: 12 },
});
