// Generated native presentation from src/components/office/ClientCostCarrierReturnSummary.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { View } from 'react-native';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumCard, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { listCareCarrierReturnCases } from '@/lib/pflege/careBillingLiveService';
import { colors, spacing, typography } from '@/theme';
export function ClientCostCarrierReturnSummary({ clientId }: {
    clientId: string;
}) {
    const tenantId = useServiceTenantId();
    const { roleKey } = usePermissions();
    const query = useAsyncQuery(() => tenantId && clientId ? listCareCarrierReturnCases(tenantId, roleKey, clientId) : Promise.resolve({ ok: false as const, error: 'Kein Mandant oder Pflegefall.' }), [tenantId, roleKey, clientId], { enabled: Boolean(tenantId && clientId) });
    if (query.loading && !query.data)
        return <LoadingState message="Kostenträger-Rückläufer werden geladen…"/>;
    if (query.error && !query.data)
        return <ErrorState message={query.error} onRetry={query.refresh}/>;
    const returns = query.data ?? [];
    return <SectionPanel title="Rückläufer und erneute Abgabe" subtitle="Abweisung, Korrektur und Folgeversuch in einer Forderungshistorie">
    {returns.length === 0 ? <EmptyState title="Keine Rückläufer dokumentiert" message="Ein Rückläufer kann erst einem tatsächlich protokollierten Übermittlungsversuch zugeordnet werden."/> : returns.map((item) => <PremiumCard key={item.returnId} style={{ marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={typography.label}>{item.invoiceNumber} · Versuch {item.attemptNumber}</Text>
          <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xs }}>{item.returnFileName} · {item.receivedAt}</Text>
        </View>
        <PremiumBadge label={item.handledByCorrection ? 'Erneut abgegeben' : 'Korrektur erforderlich'} variant={item.handledByCorrection ? 'green' : 'red'}/>
      </View>
      <Text style={{ ...typography.caption, marginTop: spacing.sm }}>Fehlercodes {item.codeSystem} {item.codeSystemVersion}</Text>
      {item.errors.map((error) => <View key={error.errorId} style={{ marginTop: spacing.xs }}>
        <Text style={{ ...typography.caption, color: colors.error }}>{error.code} · {error.scope === 'position' ? `Position ${error.positionNo}` : 'Rechnung'}</Text>
        <Text style={{ ...typography.caption, color: colors.textMuted }}>{error.message}</Text>
      </View>)}
      <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm }}>Forderung {item.claimLineageId.slice(0, 8)}… · Datei-SHA-256 {item.returnFileSha256.slice(0, 12)}…</Text>
      <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs }}>{item.handledByCorrection ? 'Der Folgeversuch ersetzt genau den abgewiesenen Versuch; er ist weiterhin nicht als angenommen oder bezahlt bewertet.' : 'Die Abweisung gilt nicht als Annahme oder Zahlung. Vor erneuter Übermittlung ist eine neue geprüfte Fassung erforderlich.'}</Text>
    </PremiumCard>)}
    <Text style={{ ...typography.caption, color: colors.textSecondary }}>Eine erneute Abgabe setzt die bestehende Forderungshistorie fort. Sie erzeugt keine zweite Forderung; Empfängerannahme, fachliche Verarbeitung und Zahlung bleiben eigenständige Nachweise.</Text>
  </SectionPanel>;
}
