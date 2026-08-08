import { StyleSheet, Text, View } from 'react-native';
import { ClientBudgetVisualCards } from '@/product-workflows/components/office/ClientBudgetVisualCards';
import { PortalTabScreen } from '@/product-workflows/screens/portal/PortalTabScreen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/product-workflows/design/tokens/auroraGlass';
import { careSpacing } from '@/product-workflows/design/tokens/spacing';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { fetchPortalBudgetVisuals } from '@/lib/portal/assist/portalBudgetService';

export default function ClientPortalBudgetRoute() {
  const tenantId = useServiceTenantId();
  const { clientId, isLinkedReady, isResolvingClientLink } = usePortalActor();
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
    { enabled: !!tenantId && !!clientId && isLinkedReady },
  );

  const missingClientLink = !isResolvingClientLink && !clientId;
  const visuals = budgetQuery.data ?? [];

  return (
    <PortalTabScreen title="Budget">
      <View style={styles.intro} testID="client-portal-budget-page-visuals">
        <Text style={[styles.kicker, { color: text.muted }]}>MEINE FINANZIELLEN MÖGLICHKEITEN</Text>
        <Text style={[styles.title, { color: text.primary }]}>Ihr Budget auf einen Blick</Text>
        <Text style={[styles.subtitle, { color: text.secondary }]}>
          Geld, mögliche Stunden und die Auswirkung auf Ihr Pflegegeld – automatisch aus Ihren aktuellen Angaben berechnet.
        </Text>
        {budgetQuery.loading || isResolvingClientLink ? (
          <Text style={[styles.liveStatus, { color: text.muted }]}>Persönliche Livewerte werden geladen …</Text>
        ) : budgetQuery.error || missingClientLink ? (
          <Text style={[styles.liveStatus, { color: text.muted }]}>
            Persönliche Budgetwerte sind derzeit nicht verfügbar.
          </Text>
        ) : (
          <Text style={[styles.liveStatus, { color: text.muted }]}>Persönliche Livewerte · automatisch aktuell</Text>
        )}
      </View>

      {isResolvingClientLink || budgetQuery.loading ? (
        <LoadingState message="Ihre persönlichen Budgetwerte werden geladen…" />
      ) : missingClientLink ? (
        <ErrorState
          title="Budget nicht verfügbar"
          message="Ihr Klient:innenprofil konnte nicht sicher verknüpft werden. Bitte melden Sie sich erneut an oder wenden Sie sich an Ihr Pflegebüro."
          onRetry={budgetQuery.refresh}
        />
      ) : budgetQuery.error ? (
        <ErrorState
          title="Budget konnte nicht geladen werden"
          message="Ihre persönlichen Budgetwerte konnten gerade nicht geladen werden. Es werden keine Ersatzbeträge angezeigt."
          onRetry={budgetQuery.refresh}
        />
      ) : visuals.length === 0 ? (
        <EmptyState
          title="Noch keine Budgetdaten"
          message="Für Ihr Profil sind derzeit keine freigegebenen Budgetwerte hinterlegt. Es werden keine geschätzten Beträge angezeigt."
          actionLabel="Erneut laden"
          onAction={budgetQuery.refresh}
        />
      ) : (
        <ClientBudgetVisualCards models={visuals} />
      )}
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
