import { StyleSheet, Text, View } from 'react-native';
import { ClientBudgetVisualCards } from '@/product-workflows/components/office/ClientBudgetVisualCards';
import { PortalTabScreen } from '@/product-workflows/screens/portal/PortalTabScreen';
import { useAuroraAdaptiveText } from '@/product-workflows/design/tokens/auroraGlass';
import { careSpacing } from '@/product-workflows/design/tokens/spacing';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { buildClientBudgetVisualPlaceholders } from '@/lib/assist/clientBudgetVisuals';
import { fetchPortalBudgetVisuals } from '@/lib/portal/assist/portalBudgetService';

export default function ClientPortalBudgetRoute() {
  const tenantId = useServiceTenantId();
  const { clientId, isReady } = usePortalActor();
  const text = useAuroraAdaptiveText();

  const budgetQuery = useAsyncQuery(
    () => {
      if (!tenantId || !clientId) {
        return Promise.resolve({
          ok: false as const,
          error: 'Ihre Budgetdaten konnten gerade nicht zugeordnet werden.',
        });
      }
      return fetchPortalBudgetVisuals(tenantId, clientId);
    },
    [tenantId, clientId],
    { enabled: !!tenantId && !!clientId && isReady },
  );

  const visuals = budgetQuery.data ?? buildClientBudgetVisualPlaceholders();

  return (
    <PortalTabScreen title="Budget">
      <View style={styles.intro} testID="client-portal-budget-page-visuals">
        <Text style={[styles.kicker, { color: text.muted }]}>MEINE FINANZIELLEN MÖGLICHKEITEN</Text>
        <Text style={[styles.title, { color: text.primary }]}>Ihr Budget auf einen Blick</Text>
        <Text style={[styles.subtitle, { color: text.secondary }]}>
          Geld, mögliche Stunden und die Auswirkung auf Ihr Pflegegeld – automatisch aus Ihren aktuellen Angaben berechnet.
        </Text>
        {budgetQuery.loading || !isReady ? (
          <Text style={[styles.liveStatus, { color: text.muted }]}>Persönliche Livewerte werden geladen …</Text>
        ) : budgetQuery.error ? (
          <Text style={[styles.liveStatus, { color: text.muted }]}>
            Die persönlichen Buchungen werden gerade aktualisiert. Die Budgetkarten bleiben für Sie sichtbar.
          </Text>
        ) : (
          <Text style={[styles.liveStatus, { color: text.muted }]}>Persönliche Livewerte · automatisch aktuell</Text>
        )}
      </View>

      <ClientBudgetVisualCards models={visuals} />
    </PortalTabScreen>
  );
}

const styles = StyleSheet.create({
  intro: {
    paddingHorizontal: careSpacing.sm,
    paddingTop: careSpacing.sm,
    paddingBottom: careSpacing.md,
    gap: careSpacing.xs,
  },
  kicker: { fontSize: 11, lineHeight: 16, fontWeight: '800', letterSpacing: 1.1 },
  title: { fontSize: 25, lineHeight: 31, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { maxWidth: 760, fontSize: 14, lineHeight: 21 },
  liveStatus: { marginTop: careSpacing.xs, fontSize: 12, lineHeight: 18, fontWeight: '700' },
});
