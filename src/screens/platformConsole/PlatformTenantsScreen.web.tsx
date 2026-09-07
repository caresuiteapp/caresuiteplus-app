import { PlatformShellLayout as DesktopPlatformShell } from '@/components/platformConsole/PlatformShellLayout.web';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  PlatformDataTable,
  PlatformFilterChip,
  PlatformFilterChipRow,

  PlatformStatusBadge,
  PlatformTenantEnvironmentBadge,
  PLATFORM_COLORS,
} from '@/components/platformConsole';
import { ErrorState, LoadingState } from '@/components/ui';
import { resolvePlatformTenantDetailId } from '@/lib/platformConsole';
import { listPlatformCompanies } from '@/lib/platformConsole/platformCompanyDirectoryService';
import type { PlatformTenantListItem } from '@/types/platformConsole';
import { spacing } from '@/theme';

export function PlatformTenantsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<PlatformTenantListItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [billingFilter, setBillingFilter] = useState('');
  const [environmentFilter, setEnvironmentFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const requestNumber = useRef(0);
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
    try {
      const result = await listPlatformCompanies({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        billingStatus: billingFilter || undefined,
        limit: 51, offset, environment: environmentFilter || undefined,
      });
      if (request !== requestNumber.current) return;
      if (!result.ok) throw new Error(result.error);
      setHasMore(result.data.items.length > 50);
      setItems(result.data.items.slice(0, 50));
    } catch (cause) {
      if (request !== requestNumber.current) return;
      setError(cause instanceof Error ? cause.message : 'Unternehmen konnten nicht geladen werden.');
    } finally {
      if (request === requestNumber.current) setLoading(false);
    }
  }, [billingFilter, environmentFilter, search, statusFilter, offset]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 300);
    return () => { clearTimeout(timer); requestNumber.current++; };
  }, [load]);

  const columns = useMemo(
    () => [
      {
        key: 'tenantName',
        label: 'Mandant',
        render: (row: PlatformTenantListItem) => (
          <Text style={styles.cellPrimary}>{row.tenantName}</Text>
        ),
      },
      {
        key: 'environment',
        label: 'Datenart',
        render: (row: PlatformTenantListItem) => <PlatformTenantEnvironmentBadge mode={row.environmentMode} />,
      },
      { key: 'status', label: 'Status', render: (row: PlatformTenantListItem) => <PlatformStatusBadge status={row.status} /> },
      { key: 'planKey', label: 'Tarif', render: (row: PlatformTenantListItem) => row.planKey === 'free_platform' ? 'Kostenlos · 0 €' : row.planKey ?? '—' },
      { key: 'createdAt', label: 'Registriert', render: (row: PlatformTenantListItem) => row.createdAt ? new Date(row.createdAt).toLocaleDateString('de-DE') : '—' },
      { key: 'lifecycleStatus', label: 'Einrichtung', render: (row: PlatformTenantListItem) => row.lifecycleStatus === 'onboarding' ? 'Neu · Einrichtung läuft' : row.lifecycleStatus === 'live' ? 'Im Betrieb' : row.lifecycleStatus },
      {
        key: 'billingStatus',
        label: 'Billing',
        render: (row: PlatformTenantListItem) => <PlatformStatusBadge status={row.billingStatus} />,
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
    [openTenantDetail],
  );

  return (
    <DesktopPlatformShell title="Unternehmen" subtitle="Neue Registrierungen, Ansprechpartner und Unternehmensverwaltung">
      <View style={styles.toolbar}>
        <TextInput
          style={styles.search}
          value={search}
          accessibilityLabel="Unternehmen suchen" onChangeText={value => { setSearch(value); setOffset(0); }}
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
              ['', 'Alle'], ['manual_free', 'Kostenlos'], ['active', 'Aktiv'], ['trial', 'Testphase'], ['past_due', 'Überfällig'], ['failed', 'Fehlgeschlagen'],
            ].map(([key, label]) => <PlatformFilterChip key={key || 'all'} label={label} active={billingFilter === key} onPress={() => { setBillingFilter(key); setOffset(0); }} />)}
          </PlatformFilterChipRow>
        </View>
      </View>
      {loading ? (
        <LoadingState message="Mandanten werden geladen…" />
      ) : error ? (
        <ErrorState title="Liste nicht verfügbar" message={error} onRetry={() => void load()} />
      ) : (
        <PlatformDataTable
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
      <View style={styles.toolbar}>
        <Pressable accessibilityRole="button" disabled={loading || offset===0} style={[styles.searchBtn, (loading || offset===0) && { opacity: 0.4 }]} onPress={() => setOffset(value => Math.max(0,value-50))}><Text style={styles.searchBtnText}>Zurück</Text></Pressable>
        <Text style={styles.muted}>Seite {Math.floor(offset/50)+1}</Text>
        <Pressable accessibilityRole="button" disabled={loading || !hasMore} style={[styles.searchBtn, (loading || !hasMore) && { opacity: 0.4 }]} onPress={() => setOffset(value => value+50)}><Text style={styles.searchBtnText}>Weitere Unternehmen</Text></Pressable>
      </View>
    </DesktopPlatformShell>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  filters: { gap: spacing.sm, marginBottom: spacing.md },
  filterGroup: { gap: 5 },
  filterLabel: { color: PLATFORM_COLORS.muted, fontSize: 11, fontWeight: '700' },
  search: {
    flexGrow: 1, flexBasis: 260, minWidth: 0,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    color: PLATFORM_COLORS.text,
    backgroundColor: PLATFORM_COLORS.panel,
  },
  searchBtn: {
    backgroundColor: PLATFORM_COLORS.panel,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    justifyContent: 'center', minHeight: 44,
  },
  searchBtnText: { color: PLATFORM_COLORS.accent, fontWeight: '600' },
  cellPrimary: { color: PLATFORM_COLORS.text, fontWeight: '600' },
  link: { color: PLATFORM_COLORS.accent, fontWeight: '600' },
  muted: { color: PLATFORM_COLORS.muted, fontSize: 12 },
});
