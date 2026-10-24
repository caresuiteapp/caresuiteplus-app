// Generated native presentation from src/components/office/ClientVariableEntitlementSummary.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { View } from 'react-native';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumCard, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { evaluateClientVariableEntitlement, projectClientVariableEntitlementConsumption, projectClientVariableEntitlementHistory, type ClientVariableEntitlementKind, } from '@/lib/clients/clientVariableEntitlementDomain';
import { listClientVariableEntitlementLedger } from '@/lib/clients/clientVariableEntitlementService';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
import { spacing, typography } from '@/theme';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';
const KIND_LABELS: Record<ClientVariableEntitlementKind, string> = {
    money: 'Geldanspruch', hours: 'Stundenanspruch', days: 'Tagesanspruch', units: 'Mengenkontingent',
};
function localCalendarDate(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function formatScaled(value: number): string {
    const sign = value < 0 ? '-' : '';
    const absolute = Math.abs(value);
    const whole = Math.floor(absolute / 10000);
    const fraction = String(absolute % 10000).padStart(4, '0').replace(/0+$/, '');
    return `${sign}${whole}${fraction ? `,${fraction}` : ''}`;
}
export function ClientVariableEntitlementSummary({ clientId }: {
    clientId: string;
}) {
    const tenantId = useServiceTenantId();
    const query = useAsyncQuery(() => tenantId && clientId
        ? listClientVariableEntitlementLedger(tenantId, clientId)
        : Promise.resolve({ ok: false as const, error: 'Kein Mandant oder Pflegefall.' }), [tenantId, clientId], { enabled: Boolean(tenantId && clientId) });
    if (query.loading && !query.data)
        return <LoadingState message="Leistungsansprüche werden geladen…"/>;
    if (query.error && !query.data)
        return <ErrorState message={query.error} onRetry={query.refresh}/>;
    const versions = query.data?.versions ?? [];
    const consumption = query.data?.consumption ?? [];
    const logicalIds = [...new Set(versions.map((version) => version.logicalEntitlementId))];
    return <SectionPanel title="Veränderliche Leistungsansprüche" subtitle="Aktuelle individuelle Bescheidfassung, Zeitraum und Verbrauch">
    {logicalIds.length === 0 ? (<EmptyState title="Keine individuelle Anspruchsgrundlage dokumentiert" message="Allgemeine Regeln, ein Finanzierungsweg oder ein alter Anspruch ersetzen keinen aktuellen individuellen Bescheid."/>) : logicalIds.map((logicalId) => {
            try {
                const history = projectClientVariableEntitlementHistory(versions.filter((version) => version.logicalEntitlementId === logicalId));
                const latest = history.at(-1)!;
                const evaluation = evaluateClientVariableEntitlement(versions, {
                    tenantId: latest.tenantId, clientId: latest.clientId, financingPathId: latest.financingPathId,
                    entitlementKind: latest.entitlementKind, serviceOn: localCalendarDate(),
                });
                const displayed = evaluation.version ?? latest;
                const projection = projectClientVariableEntitlementConsumption(displayed, consumption.filter((event) => event.entitlementVersionId === displayed.id));
                return <PremiumCard key={logicalId} style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
            <Text style={{ ...typography.label, color: careSuiteAuroraTheme.text.primary, flex: 1 }}>
              {KIND_LABELS[displayed.entitlementKind]} · {displayed.unit}
            </Text>
            <PremiumBadge label={evaluation.state === 'documented_current' ? 'Aktuelle Grundlage' : 'Derzeit nicht gültig'} variant={evaluation.state === 'documented_current' ? 'green' : 'orange'}/>
          </View>
          <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted, marginTop: spacing.xs }}>
            {displayed.decisionReference} vom {formatDate(displayed.decisionIssuedOn)} · Fassung {displayed.version} von {history.length}
          </Text>
          <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted, marginTop: spacing.xs }}>
            Gültig {formatDate(displayed.validFrom)} bis {displayed.validUntil ? formatDate(displayed.validUntil) : 'unbefristet'} · {evaluation.reason}
          </Text>
          <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted, marginTop: spacing.xs }}>
            Anspruch {formatScaled(projection.allocatedQuantityScaled)} {displayed.unit} · Verbrauch {formatScaled(projection.consumedQuantityScaled)} {displayed.unit} · Rest {formatScaled(projection.remainingQuantityScaled)} {displayed.unit}
          </Text>
          <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted, marginTop: spacing.xs }}>
            {projection.history.length} unveränderliche Verbrauchsfassung(en){displayed.changeReason ? ` · Änderung: ${displayed.changeReason}` : ''}
          </Text>
        </PremiumCard>;
            }
            catch {
                return <Text key={logicalId} style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted, marginBottom: spacing.sm }}>
          Anspruch ist wegen unvollständiger, widersprüchlicher oder nicht aktuell gebundener Originaldaten nicht auswertbar.
        </Text>;
            }
        })}
    <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted }}>
      Bescheid und Verbrauch bestätigen weder Leistungserbringung noch Vertrags-, Pflege- oder Abrechnungsfreigabe.
    </Text>
  </SectionPanel>;
}
