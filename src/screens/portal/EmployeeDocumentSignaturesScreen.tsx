import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { CsDocumentRequestCard } from '@/components/office/documentSignatures/CsDocumentRequestCard';
import { EmptyState, ErrorState, LoadingState, SegmentedTabs } from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchPortalCsDocumentRequests } from '@/lib/documents/csTemplates';
import { spacing } from '@/theme';

type FilterKey = 'open' | 'done';

const FILTER_OPTIONS = [
  { key: 'open', label: 'Offen' },
  { key: 'done', label: 'Erledigt' },
];

export function EmployeeDocumentSignaturesScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { profile, portalSession } = useAuth();
  const { can } = usePermissions();
  const [filter, setFilter] = useState<FilterKey>('open');

  const employeeId = portalSession?.employeeId ?? profile?.employeeId ?? null;

  const query = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId || !employeeId) return { ok: true as const, data: [] };
      return fetchPortalCsDocumentRequests({
        tenantId,
        roleKey: 'employee_portal',
        employeeId,
        includeCompleted: filter === 'done',
      });
    }, [tenantId, employeeId, filter]),
    [tenantId, employeeId, filter],
  );

  const items =
    filter === 'open'
      ? (query.data ?? []).filter((r) => r.status !== 'completed' && r.status !== 'archived')
      : (query.data ?? []).filter((r) => r.status === 'completed' || r.status === 'archived');

  if (!can('portal.employee.documents.view' as never)) {
    return (
      <C14vSubpageShell title="Dokumente & Unterschriften" showBack accentColor={moduleColor('assist')}>
        <EmptyState title="Kein Zugriff" message="Dokumente sind für Ihr Profil nicht freigegeben." />
      </C14vSubpageShell>
    );
  }

  return (
    <C14vSubpageShell
      title="Dokumente & Unterschriften"
      subtitle="Offene Dokumente zum Unterschreiben"
      showBack
      accentColor={moduleColor('assist')}
      actions={[{ key: 'refresh', label: 'Aktualisieren', onPress: () => query.refresh(), variant: 'ghost' as const }]}
    >
      <View style={styles.filterCard}>
        <SegmentedTabs
          tabs={FILTER_OPTIONS}
          activeKey={filter}
          onSelect={(key) => setFilter(key as FilterKey)}
          layout="wrap"
        />
      </View>
      {query.loading && !query.data ? <LoadingState message="Wird geladen…" /> : null}
      {query.error ? <ErrorState message={query.error} onRetry={query.refresh} /> : null}
      {items.length === 0 && !query.loading ? (
        <EmptyState
          title={filter === 'open' ? 'Alles erledigt' : 'Noch keine erledigten Dokumente'}
          message={
            filter === 'open'
              ? 'Es liegen keine offenen Dokumente vor.'
              : 'Abgeschlossene Dokumente erscheinen hier im Archiv.'
          }
        />
      ) : (
        <View style={styles.list}>
          {items.map((item) => (
            <CsDocumentRequestCard
              key={item.id}
              item={item}
              compact
              openLabel="Öffnen und unterschreiben"
              onOpen={() => router.push(`/portal/employee/documents/signatures/${item.id}` as never)}
            />
          ))}
        </View>
      )}
    </C14vSubpageShell>
  );
}

const styles = StyleSheet.create({
  filterCard: {
    alignSelf: 'stretch',
    padding: spacing.xs,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
  },
  list: { gap: spacing.sm, marginTop: spacing.md },
});
