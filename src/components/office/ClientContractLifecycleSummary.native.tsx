// Generated native presentation from src/components/office/ClientContractLifecycleSummary.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { View } from 'react-native';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumCard, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { projectClientContractLifecycle, validateClientContractServiceBinding } from '@/lib/clients/clientContractLifecycleDomain';
import { listClientContractLifecycleLedger } from '@/lib/clients/clientContractLifecycleService';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
import { spacing, typography } from '@/theme';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';
export function ClientContractLifecycleSummary({ clientId }: {
    clientId: string;
}) {
    const tenantId = useServiceTenantId();
    const query = useAsyncQuery(() => tenantId && clientId
        ? listClientContractLifecycleLedger(tenantId, clientId)
        : Promise.resolve({ ok: false as const, error: 'Kein Mandant oder Pflegefall.' }), [tenantId, clientId], { enabled: Boolean(tenantId && clientId) });
    if (query.loading && !query.data)
        return <LoadingState message="Vertragshistorie wird geladen…"/>;
    if (query.error && !query.data)
        return <ErrorState message={query.error} onRetry={query.refresh}/>;
    const events = query.data?.events ?? [];
    const logicalIds = [...new Set(events.map((event) => event.logicalContractId))];
    return <SectionPanel title="Vertragsänderungen und Schließungen" subtitle="Unveränderliche Fassungen mit Wirksamkeit, Grund, Vorgänger und Folgen">
    {logicalIds.length === 0 ? (<EmptyState title="Keine Lebenszyklushistorie dokumentiert" message="Bestehende Vertragsfelder werden nicht automatisch als geprüfte Änderungshistorie ausgelegt."/>) : logicalIds.map((logicalContractId) => {
            const contractEvents = events.filter((event) => event.logicalContractId === logicalContractId);
            try {
                const projection = projectClientContractLifecycle(contractEvents);
                const bindings = (query.data?.serviceBindings ?? []).filter((binding) => binding.logicalContractId === logicalContractId);
                bindings.forEach((binding) => validateClientContractServiceBinding(binding, contractEvents));
                const current = projection.currentEvent;
                return <PremiumCard key={logicalContractId} style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
            <Text style={{ ...typography.label, color: careSuiteAuroraTheme.text.primary, flex: 1 }}>{current.contractNumber}</Text>
            <PremiumBadge label={projection.state === 'closed' ? 'Geschlossen' : 'Aktive Fassung'} variant={projection.state === 'closed' ? 'orange' : 'green'}/>
          </View>
          <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted, marginTop: spacing.xs }}>
            Version {current.version} · wirksam ab {formatDate(current.effectiveOn)} · {projection.events.length} unveränderliche Fassungen
          </Text>
          <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted, marginTop: spacing.xs }}>
            {current.kind === 'initial' ? 'Erstfassung' : `${current.kind === 'closure' ? 'Schließung' : 'Änderung'}: ${current.changeReason} · Folgen: ${current.consequences}`}
          </Text>
          <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted, marginTop: spacing.xs }}>
            {bindings.length} historische Leistungsreferenzen bleiben an ihre datumsgültige Vertragsfassung gebunden.
          </Text>
        </PremiumCard>;
            }
            catch {
                return <Text key={logicalContractId} style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted, marginBottom: spacing.sm }}>
          Vertragshistorie ist wegen unvollständiger oder mehrdeutiger Originaldaten nicht auswertbar.
        </Text>;
            }
        })}
    <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted }}>
      Eine Vertragsfassung oder Leistungsreferenz bestätigt weder Leistungserbringung noch Abrechnungs- oder Rechtsfreigabe.
    </Text>
  </SectionPanel>;
}
