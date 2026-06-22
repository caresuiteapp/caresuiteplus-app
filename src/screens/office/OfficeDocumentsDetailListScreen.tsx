import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  LoadingState,
  PremiumCard,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchOfficeDocumentsDashboard } from '@/lib/office/officeDocumentsService';
import { colors, spacing, typography } from '@/theme';

export function OfficeDocumentsDetailListScreen() {
  const { id: categoryFilter } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel } = usePermissions();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(categoryFilter ?? 'all');

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchOfficeDocumentsDashboard(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const categories = useMemo(() => {
    const keys = Object.keys(query.data?.byCategory ?? {});
    return [{ key: 'all', label: 'Alle' }, ...keys.map((key) => ({ key, label: key }))];
  }, [query.data?.byCategory]);

  const items = useMemo(() => {
    const rows = query.data?.items ?? [];
    const q = search.trim().toLowerCase();
    return rows.filter((item) => {
      const matchesCategory = category === 'all' ? true : item.category === category;
      const matchesSearch =
        !q || `${item.title} ${item.category} ${item.status}`.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [query.data?.items, category, search]);

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="Dokumente nach Typ" subtitle="Wird geladen…">
        <LoadingState message="Dokumentgruppen werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Dokumente nach Typ" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Dokumente nach Typ" subtitle={`Office · ${roleLabel ?? 'Demo'}`}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <SectionPanel title="Gruppierte Listenansicht" subtitle={`${query.data?.total ?? 0} Dokumente gesamt`}>
          <PremiumInput label="Suche" value={search} onChangeText={setSearch} placeholder="Titel, Kategorie…" />
          <FilterChipGroup options={categories} value={category} onChange={setCategory} />
          {items.length === 0 ? (
            <EmptyState title="Keine Dokumente" message="Passen Sie Suche oder Kategorie an." />
          ) : (
            items.map((item) => (
              <PremiumCard
                key={item.id}
                style={styles.card}
                onPress={() => router.push(`/business/office/documents/${item.id}` as never)}
              >
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.meta}>
                  {item.category} · {item.status}
                </Text>
              </PremiumCard>
            ))
          )}
        </SectionPanel>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  card: { marginBottom: spacing.sm },
  title: { ...typography.label },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
