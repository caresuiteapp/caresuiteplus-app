import { PortalEmptyState } from '@/components/portal/PortalEmptyState';
import { PortalSectionGate } from '@/components/portal/PortalSectionGate';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { LoadingState } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { fetchClientPortalSettingsResolved } from '@/lib/client/clientPortalSettingsService';
import { getClientPortalBudgetProjection } from '@/lib/portal/clientPortalProjectionService';
import { GlassCard } from '@/design/components/GlassCard';
import { StyleSheet, Text, View } from 'react-native';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';

function formatEuro(cents: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export default function ClientPortalBudgetRoute() {
  const tenantId = useServiceTenantId();
  const { clientId, isReady } = usePortalActor();
  const text = useAuroraAdaptiveText();

  const settingsQuery = useAsyncQuery(
    () => {
      if (!tenantId || !clientId) return Promise.resolve({ ok: false as const, error: 'Keine ID.' });
      return fetchClientPortalSettingsResolved(tenantId, clientId);
    },
    [tenantId, clientId],
    { enabled: !!tenantId && !!clientId && isReady },
  );

  const budgetQuery = useAsyncQuery(
    () => {
      if (!tenantId || !clientId) return Promise.resolve({ ok: false as const, error: 'Keine ID.' });
      return getClientPortalBudgetProjection(tenantId, clientId);
    },
    [tenantId, clientId],
    { enabled: !!tenantId && !!clientId && isReady },
  );

  if (!isReady || settingsQuery.loading) {
    return (
      <PortalTabScreen title="Budget">
        <LoadingState message="Budget wird geladen…" />
      </PortalTabScreen>
    );
  }

  return (
    <PortalTabScreen title="Budget">
      <PortalSectionGate settings={settingsQuery.data} feature="budget">
        {!budgetQuery.data || budgetQuery.data.items.length === 0 ? (
          <PortalEmptyState
            icon="💶"
            title="Kein Budget freigegeben"
            message="Budgetinformationen erscheinen hier, sobald Ihr Pflegebüro sie freigibt."
          />
        ) : (
          budgetQuery.data.items.map((item, index) => (
            <GlassCard key={`${item.budgetTypeKey ?? index}`} style={styles.card}>
              <Text style={[styles.title, { color: text.primary }]}>
                {item.budgetTypeName ?? item.budgetTypeKey ?? 'Budget'}
              </Text>
              <View style={styles.row}>
                <Text style={{ color: text.muted }}>Verfügbar</Text>
                <Text style={{ color: text.primary }}>{formatEuro(item.remainingCents)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={{ color: text.muted }}>Verbraucht</Text>
                <Text style={{ color: text.primary }}>{formatEuro(item.usedCents)}</Text>
              </View>
            </GlassCard>
          ))
        )}
      </PortalSectionGate>
    </PortalTabScreen>
  );
}

const styles = StyleSheet.create({
  card: { padding: careSpacing.md, marginBottom: careSpacing.sm },
  title: { fontWeight: '700', marginBottom: careSpacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: careSpacing.xs },
});
