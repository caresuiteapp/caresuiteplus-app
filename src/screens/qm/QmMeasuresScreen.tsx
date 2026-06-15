import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useMemo, useState } from 'react';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightPageShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumInput } from '@/components/ui';
import { QmMeasureCard } from '@/components/qm';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchQmMeasures } from '@/lib/qm/qmMeasureService';
import { colors, spacing } from '@/theme';

export function QmMeasuresScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, roleLabel } = usePermissions();
  const [search, setSearch] = useState('');

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchQmMeasures(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = query.data ?? [];
    if (!q) return rows;
    return rows.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.status.toLowerCase().includes(q) ||
        m.assignedTo.toLowerCase().includes(q),
    );
  }, [query.data, search]);

  if (!can('qm.view')) {
    return (
      <CareLightPageShell title="Maßnahmen" showBack>
        <LockedActionBanner message={check('qm.view').reason ?? ''} roleLabel={roleLabel} />
      </CareLightPageShell>
    );
  }

  if (query.loading && !query.data) {
    return (
      <CareLightPageShell title="Maßnahmen" showBack>
        <LoadingState message="Maßnahmen werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <CareLightPageShell title="Maßnahmen" showBack>
        <ErrorState title="Maßnahmen" message={query.error} onRetry={query.refresh} />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell title="Maßnahmenmanagement" subtitle={`${items.length} Maßnahmen`} showBack>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={query.loading} onRefresh={query.refresh} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.scroll}
      >
        <PremiumInput label="Maßnahme suchen" value={search} onChangeText={setSearch} placeholder="Titel, Status, Verantwortliche…" />
        {items.length === 0 ? (
          <EmptyState title="Keine Maßnahmen" message={search ? 'Kein Treffer.' : 'Keine offenen Maßnahmen.'} />
        ) : (
          items.map((m) => <QmMeasureCard key={m.id} measure={m} />)
        )}
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({ scroll: { gap: spacing.md, paddingBottom: spacing.xxl } });
