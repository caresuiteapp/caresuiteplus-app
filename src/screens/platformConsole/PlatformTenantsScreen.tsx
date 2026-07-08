import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PlatformShellLayout, PLATFORM_COLORS } from '@/components/platformConsole';
import { ErrorState, LoadingState, PremiumDataTable } from '@/components/ui';
import { listPlatformTenants, resolvePlatformTenantDetailId } from '@/lib/platformConsole';
import type { PlatformTenantListItem } from '@/types/platformConsole';
import { spacing } from '@/theme';

export function PlatformTenantsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<PlatformTenantListItem[]>([]);
  const [search, setSearch] = useState('');
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
    const result = await listPlatformTenants({ search: search.trim() || undefined });
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setItems(result.data.items);
    setLoading(false);
  }, [search]);

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
      { key: 'status', label: 'Status', render: (row: PlatformTenantListItem) => row.status },
      { key: 'planKey', label: 'Tarif', render: (row: PlatformTenantListItem) => row.planKey ?? '—' },
      {
        key: 'billingStatus',
        label: 'Billing',
        render: (row: PlatformTenantListItem) => row.billingStatus,
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
          placeholder="Name, Slug, E-Mail, Tenant-ID…"
          placeholderTextColor={PLATFORM_COLORS.muted}
          onSubmitEditing={() => void load()}
        />
        <Pressable style={styles.searchBtn} onPress={() => void load()}>
          <Text style={styles.searchBtnText}>Suchen</Text>
        </Pressable>
      </View>
      {loading ? (
        <LoadingState message="Mandanten werden geladen…" />
      ) : error ? (
        <ErrorState title="Liste nicht verfügbar" message={error} onRetry={() => void load()} />
      ) : (
        <ScrollView horizontal>
          <PremiumDataTable
            columns={columns}
            data={items}
            keyExtractor={(row) => resolvePlatformTenantDetailId(row) ?? row.id}
          />
        </ScrollView>
      )}
    </PlatformShellLayout>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
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
