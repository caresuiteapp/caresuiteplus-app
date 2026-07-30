import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { CsDocumentRequestCard } from '@/components/office/documentSignatures/CsDocumentRequestCard';
import { AuroraSegmentedControl } from '@/components/aurora';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { usePortalActor } from '@/hooks/usePortalActor';
import { fetchPortalCsDocumentRequests } from '@/lib/documents/csTemplates';
import { toPortalUserFacingError } from '@/lib/portal/portalUserFacingError';
import { spacing } from '@/theme';

type FilterKey = 'open' | 'done';

const FILTER_OPTIONS = [
  { key: 'open', label: 'Offen' },
  { key: 'done', label: 'Erledigt' },
];

export function ClientDocumentSignaturesScreen() {
  const router = useRouter();
  const { tenantId, clientId, roleKey, isLinkedReady } = usePortalActor();
  const { can } = usePermissions();
  const [filter, setFilter] = useState<FilterKey>('open');

  const query = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId || !clientId) return { ok: true as const, data: [] };
      return fetchPortalCsDocumentRequests({
        tenantId,
        roleKey: roleKey ?? 'client_portal',
        clientId,
        includeCompleted: filter === 'done',
      });
    }, [tenantId, clientId, roleKey, filter]),
    [tenantId, clientId, roleKey, filter],
    { enabled: isLinkedReady && !!tenantId && !!clientId },
  );

  const items =
    filter === 'open'
      ? (query.data ?? []).filter((r) => r.status !== 'completed' && r.status !== 'archived')
      : (query.data ?? []).filter((r) => r.status === 'completed' || r.status === 'archived');

  if (!can('portal.client.documents.view' as never)) {
    return (
      <C14vSubpageShell title="Meine Dokumente" showBack accentColor={moduleColor('assist')}>
        <EmptyState title="Kein Zugriff" message="Dokumente sind derzeit nicht verfügbar." />
      </C14vSubpageShell>
    );
  }

  return (
    <C14vSubpageShell
      title="Unterschriften"
      subtitle="Bitte lesen und unterschreiben Sie offene Dokumente"
      showBack
      accentColor={moduleColor('assist')}
      actions={[{ key: 'refresh', label: 'Aktualisieren', onPress: () => query.refresh(), variant: 'ghost' as const }]}
    >
      <AuroraSegmentedControl options={FILTER_OPTIONS} value={filter} onChange={(k) => setFilter(k as FilterKey)} />
      {query.loading && !query.data ? (
        <LoadingState message="Offene Dokumente werden geladen…" />
      ) : null}
      {query.error ? (
        <ErrorState
          message={toPortalUserFacingError(
            query.error,
            'Ihre offenen Dokumente konnten gerade nicht geladen werden. Bitte versuchen Sie es erneut.',
          )}
          onRetry={query.refresh}
        />
      ) : null}
      {items.length === 0 && !query.loading && !query.error ? (
        <EmptyState
          title={filter === 'open' ? 'Keine offenen Dokumente' : 'Noch nichts erledigt'}
          message={
            filter === 'open'
              ? 'Sobald Ihnen ein Dokument zugesendet wird, erscheint es hier.'
              : 'Unterschriebene Dokumente finden Sie hier.'
          }
        />
      ) : (
        <View style={styles.list}>
          {items.map((item) => (
            <CsDocumentRequestCard
              key={item.id}
              item={item}
              compact
              portalLabels
              openLabel="Öffnen und unterschreiben"
              onOpen={() => router.push(`/portal/client/documents/signatures/${item.id}` as never)}
            />
          ))}
        </View>
      )}
    </C14vSubpageShell>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, marginTop: spacing.md },
});
