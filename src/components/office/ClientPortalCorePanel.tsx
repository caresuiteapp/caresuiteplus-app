import { StyleSheet, Text, View } from 'react-native';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { ClientPortalAccessPanel } from '@/components/clients/ClientPortalAccessPanel';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  fetchClientPortalSettingsResolved,
  listClientPortalAccessRequests,
  listVisiblePortalFeatures,
  reviewClientPortalAccessRequest,
} from '@/lib/client/clientPortalSettingsService';
import { useAuth } from '@/lib/auth/context';
import type { ClientFullDetail } from '@/types/modules/client';
import { colors, spacing, typography } from '@/theme';

type Props = {
  clientId: string;
  fullClient?: ClientFullDetail | null;
  onRecordRefresh?: () => void;
};

const FEATURE_LABELS: Record<string, string> = {
  appointments: 'Termine',
  messages: 'Nachrichten',
  documents: 'Dokumente',
  proofs: 'Nachweise',
  budget: 'Budget',
};

export function ClientPortalCorePanel({ clientId, fullClient, onRecordRefresh }: Props) {
  const tenantId = useServiceTenantId();
  const { isReadOnly } = usePermissions();
  const { profile } = useAuth();

  const settingsQuery = useAsyncQuery(
    () => {
      if (!tenantId || !clientId) return Promise.resolve({ ok: false as const, error: 'Keine ID.' });
      return fetchClientPortalSettingsResolved(tenantId, clientId);
    },
    [tenantId, clientId],
    { enabled: !!tenantId && !!clientId },
  );

  const featuresQuery = useAsyncQuery(
    () => {
      if (!tenantId || !clientId) return Promise.resolve({ ok: false as const, error: 'Keine ID.' });
      return listVisiblePortalFeatures(tenantId, clientId);
    },
    [tenantId, clientId],
    { enabled: !!tenantId && !!clientId },
  );

  const requestsQuery = useAsyncQuery(
    () => {
      if (!tenantId || !clientId) return Promise.resolve({ ok: false as const, error: 'Keine ID.' });
      return listClientPortalAccessRequests(tenantId, clientId);
    },
    [tenantId, clientId],
    { enabled: !!tenantId && !!clientId },
  );

  if (settingsQuery.loading && !settingsQuery.data) {
    return <LoadingState message="Portal-Einstellungen werden geladen…" />;
  }
  if (settingsQuery.error && !settingsQuery.data) {
    return <ErrorState message={settingsQuery.error} onRetry={settingsQuery.refresh} />;
  }

  const settings = settingsQuery.data;
  const features = featuresQuery.data ?? [];
  const requests = requestsQuery.data ?? [];

  async function handleReview(requestId: string, decision: 'approved' | 'rejected') {
    if (!tenantId || isReadOnly) return;
    const result = await reviewClientPortalAccessRequest(tenantId, clientId, requestId, decision, {
      reviewedBy: profile?.id ?? null,
    });
    if (result.ok) {
      await requestsQuery.refresh();
      onRecordRefresh?.();
    }
  }

  return (
    <View style={styles.panel}>
      <SectionPanel title="Portal-Sichtbarkeit">
        {!settings ? (
          <EmptyState title="Keine Portal-Einstellungen" message="Mandanten-Defaults werden beim ersten Zugriff angelegt." />
        ) : (
          <PremiumCard style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.primary}>Portal {settings.portalEnabled ? 'aktiv' : 'inaktiv'}</Text>
                <PremiumBadge
                  label={settings.inheritTenantDefaults ? 'Mandanten-Defaults' : 'Individuell'}
                  variant="muted"
                />
            </View>
            <Text style={styles.secondary}>
              Sichtbare Bereiche:{' '}
              {features.length > 0
                ? features.map((f) => FEATURE_LABELS[f] ?? f).join(', ')
                : 'Keine — konservative Defaults (nicht alles sichtbar)'}
            </Text>
            <Text style={styles.secondary}>GPS / Live-Tracking: nicht im Klientenportal verfügbar</Text>
          </PremiumCard>
        )}
      </SectionPanel>

      {fullClient && tenantId ? (
        <ClientPortalAccessPanel
          client={fullClient}
          tenantId={tenantId}
          isReadOnly={isReadOnly}
          onRefresh={onRecordRefresh}
        />
      ) : (
        <SectionPanel title="Portal-Zugang">
          <EmptyState title="Stammdaten laden" message="Portal-Zugang wird angezeigt, sobald die Klient:innen-Akte vollständig geladen ist." />
        </SectionPanel>
      )}

      <SectionPanel title="Zugangsanfragen">
        {requests.length === 0 ? (
          <EmptyState title="Keine offenen Anfragen" message="Anfragen für Portal-Zugang erscheinen hier." />
        ) : (
          requests.map((req) => (
            <PremiumCard key={req.id} style={styles.card}>
              <Text style={styles.primary}>{req.requesterName}</Text>
              <Text style={styles.secondary}>
                {req.status} · {req.requestType}
                {req.requesterEmail ? ` · ${req.requesterEmail}` : ''}
              </Text>
              {req.status === 'pending' && !isReadOnly ? (
                <View style={styles.row}>
                  <PremiumButton title="Genehmigen" size="sm" onPress={() => handleReview(req.id, 'approved')} />
                  <PremiumButton title="Ablehnen" size="sm" variant="secondary" onPress={() => handleReview(req.id, 'rejected')} />
                </View>
              ) : null}
            </PremiumCard>
          ))
        )}
      </SectionPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md, paddingBottom: spacing.lg },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  primary: { ...typography.label },
  secondary: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
