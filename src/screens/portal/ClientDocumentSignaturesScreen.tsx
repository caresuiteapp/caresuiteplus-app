import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CsDocumentRequestCard } from '@/components/office/documentSignatures/CsDocumentRequestCard';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { ClientPortalGuide } from '@/components/portal/ClientPortalGuide';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { usePortalActor } from '@/hooks/usePortalActor';
import { fetchPortalCsDocumentRequests } from '@/lib/documents/csTemplates';
import { toPortalUserFacingError } from '@/lib/portal/portalUserFacingError';
import { subscribeToClientPortalDocumentRequestChanges, type RealtimeHandler } from '@/lib/realtime';
import { liquidColors, liquidRadius } from '@/liquid-command/foundation/tokens';
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
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const subscribe = useCallback(
    (currentTenantId: string, handler: RealtimeHandler) => {
      if (!clientId) return () => undefined;
      return subscribeToClientPortalDocumentRequestChanges(currentTenantId, clientId, handler);
    },
    [clientId],
  );

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
    {
      enabled: isLinkedReady && !!tenantId && !!clientId,
      live: { tenantId, subscribe, pollMs: 30_000, refreshOnFocus: true },
    },
  );

  const items =
    filter === 'open'
      ? (query.data ?? []).filter((r) => r.status !== 'completed' && r.status !== 'archived')
      : (query.data ?? []).filter((r) => r.status === 'completed' || r.status === 'archived');

  if (!can('portal.client.documents.view' as never)) {
    return (
      <PortalTabScreen title="Unterschriften" scroll={false}>
        <EmptyState title="Kein Zugriff" message="Dokumente sind derzeit nicht verfügbar." />
      </PortalTabScreen>
    );
  }

  return (
    <PortalTabScreen
      title="Unterschriften"
      subtitle="Bitte lesen und unterschreiben Sie offene Dokumente"
      scroll={false}
    >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator>
        <ClientPortalGuide
          compact
          title={items.length > 0 && filter === 'open' ? `${items.length} ${items.length === 1 ? 'Dokument wartet' : 'Dokumente warten'} auf Sie` : 'Unterschriften sicher erledigen'}
          message="Öffnen Sie ein Dokument, lesen Sie es vollständig und unterschreiben Sie direkt mit dem Finger, Stift oder der Maus. Neue Dokumente erscheinen automatisch."
        />
        <View style={styles.toolbar}>
          <View style={styles.switcher} accessibilityRole="tablist">
            {FILTER_OPTIONS.map((option) => (
              <Pressable
                key={option.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: filter === option.key }}
                onPress={() => setFilter(option.key as FilterKey)}
                style={({ pressed }) => [styles.switch, filter === option.key && styles.switchActive, pressed && styles.pressed]}
              >
                <Text style={[type.bodyStrong, styles.switchText, filter === option.key && styles.switchTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable accessibilityRole="button" onPress={() => void query.refresh()} style={({ pressed }) => [styles.refresh, pressed && styles.pressed]}>
            <Text style={[type.bodyStrong, styles.refreshText]}>↻ Aktualisieren</Text>
          </Pressable>
        </View>
        {query.loading && !query.data ? <LoadingState message="Ihre Dokumente werden geladen…" /> : null}
        {query.error ? (
          <ErrorState
            message={toPortalUserFacingError(query.error, 'Ihre Dokumente konnten gerade nicht geladen werden. Bitte versuchen Sie es erneut.')}
            onRetry={query.refresh}
          />
        ) : null}
        {items.length === 0 && !query.loading && !query.error ? (
          <ClientPortalGuide
            compact
            title={filter === 'open' ? 'Im Moment ist nichts offen' : 'Noch nichts erledigt'}
            message={filter === 'open' ? 'Sobald Ihr Betreuungsteam ein Dokument sendet, erscheint es automatisch hier.' : 'Ihre fertig unterschriebenen Dokumente werden hier gesammelt.'}
          />
        ) : (
          <View style={styles.list}>
            {items.map((item) => (
              <CsDocumentRequestCard
                key={item.id}
                item={item}
                compact
                portalLabels
                openLabel={filter === 'open' ? 'Lesen und unterschreiben' : 'Dokument ansehen'}
                onOpen={() => router.push(`/portal/client/documents/signatures/${item.id}` as never)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </PortalTabScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  switcher: { flex: 1, minWidth: 240, padding: 4, borderWidth: 1, borderColor: liquidColors.white12, borderRadius: liquidRadius.card, backgroundColor: 'rgba(4,24,51,0.76)', flexDirection: 'row', gap: 4 },
  switch: { flex: 1, minHeight: 46, borderRadius: liquidRadius.control, alignItems: 'center', justifyContent: 'center' },
  switchActive: { borderWidth: 1, borderColor: liquidColors.blue400, backgroundColor: liquidColors.blue500Alpha16 },
  switchText: { color: liquidColors.white64 },
  switchTextActive: { color: liquidColors.white },
  refresh: { minHeight: 46, paddingHorizontal: 15, borderWidth: 1, borderColor: liquidColors.blue300Alpha32, borderRadius: liquidRadius.control, alignItems: 'center', justifyContent: 'center' },
  refreshText: { color: liquidColors.blue200 },
  list: { gap: spacing.sm },
  pressed: { opacity: 0.74 },
});
