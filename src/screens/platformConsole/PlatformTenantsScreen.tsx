import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  PlatformDataTable,
  PlatformFilterChip,
  PlatformFilterChipRow,
  PlatformShellLayout,
  PlatformStatusBadge,
  PLATFORM_COLORS,
} from '@/components/platformConsole';
import { ErrorState, LoadingState } from '@/components/ui';
import { listPlatformTenants, resolvePlatformTenantDetailId } from '@/lib/platformConsole';
import type { PlatformTenantListItem } from '@/types/platformConsole';
import { spacing } from '@/theme';

export function PlatformTenantsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<PlatformTenantListItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [billingFilter, setBillingFilter] = useState('');
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
    setLoading(true);
    setError(null);
    const result = await listPlatformTenants({
      search: search.trim() || undefined,
      status: statusFilter || undefined,
      billingStatus: billingFilter || undefined,
    });
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setItems(result.data.items);
    setLoading(false);
  }, [billingFilter, search, statusFilter]);

  useEffect(() => {
    void load();
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
      { key: 'status', label: 'Status', render: (row: PlatformTenantListItem) => <PlatformStatusBadge status={row.status} /> },
      { key: 'planKey', label: 'Tarif', render: (row: PlatformTenantListItem) => row.planKey ?? '—' },
      {
        key: 'billingStatus',
        label: 'Billing',
        render: (row: PlatformTenantListItem) => <PlatformStatusBadge status={row.billingStatus} />,
      },
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
    [openTenantDetail],
  );

  return (
    <PlatformShellLayout title="Mandanten" subtitle="Suche, Filter und Verwaltung aller Mandanten">
      <View style={styles.toolbar}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
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
          <Text style={styles.filterLabel}>Mandantenstatus</Text>
          <PlatformFilterChipRow>
            {[
              ['', 'Alle'], ['active', 'Aktiv'], ['suspended', 'Gesperrt'], ['locked', 'Blockiert'], ['terminated', 'Beendet'],
            ].map(([key, label]) => <PlatformFilterChip key={key || 'all'} label={label} active={statusFilter === key} onPress={() => setStatusFilter(key)} />)}
          </PlatformFilterChipRow>
        </View>
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Abrechnung</Text>
          <PlatformFilterChipRow>
            {[
              ['', 'Alle'], ['active', 'Aktiv'], ['trial', 'Testphase'], ['past_due', 'Überfällig'], ['failed', 'Fehlgeschlagen'],
            ].map(([key, label]) => <PlatformFilterChip key={key || 'all'} label={label} active={billingFilter === key} onPress={() => setBillingFilter(key)} />)}
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
    </PlatformShellLayout>
  );
}

const styles = StyleSheet.create({
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
