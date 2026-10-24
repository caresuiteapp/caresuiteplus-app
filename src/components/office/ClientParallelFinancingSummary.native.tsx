// Generated native presentation from src/components/office/ClientParallelFinancingSummary.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { View } from 'react-native';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumCard, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { assessParallelClientFinancingPaths, CLIENT_FINANCING_KIND_LABELS, } from '@/lib/clients/clientParallelFinancingDomain';
import { listClientParallelFinancingPaths } from '@/lib/clients/clientParallelFinancingService';
import { assessClientFinancingApprovals } from '@/lib/clients/clientFinancingApprovalDomain';
import { listClientFinancingApprovals } from '@/lib/clients/clientFinancingApprovalService';
import { assessClientTariffPositions } from '@/lib/clients/clientTariffPositionDomain';
import { listClientTariffPositions } from '@/lib/clients/clientTariffPositionService';
import { projectClientBudgetConsumption } from '@/lib/clients/clientBudgetEntitlementDomain';
import { listClientBudgetEntitlementLedger } from '@/lib/clients/clientBudgetEntitlementService';
import { assessClientCostEstimate } from '@/lib/clients/clientCostEstimateDomain';
import { listClientCostEstimateLedger } from '@/lib/clients/clientCostEstimateService';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
import { spacing, typography } from '@/theme';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';
function localCalendarDate(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function formatTariffPrice(cents: number): string {
    return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}
function formatBudgetAmount(cents: number): string {
    const sign = cents < 0 ? '−' : '';
    return `${sign}${(Math.abs(cents) / 100).toFixed(2).replace('.', ',')} €`;
}
const ROUNDING_LABELS = {
    half_up_cent: 'kaufmännisch auf Cent',
    ceil_cent: 'auf Cent aufrunden',
    floor_cent: 'auf Cent abrunden',
} as const;
export function ClientParallelFinancingSummary({ clientId }: {
    clientId: string;
}) {
    const tenantId = useServiceTenantId();
    const query = useAsyncQuery(() => tenantId && clientId
        ? listClientParallelFinancingPaths(tenantId, clientId)
        : Promise.resolve({ ok: false as const, error: 'Kein Mandant oder Pflegefall.' }), [tenantId, clientId], { enabled: Boolean(tenantId && clientId) });
    const approvalsQuery = useAsyncQuery(() => tenantId && clientId
        ? listClientFinancingApprovals(tenantId, clientId)
        : Promise.resolve({ ok: false as const, error: 'Kein Mandant oder Pflegefall.' }), [tenantId, clientId], { enabled: Boolean(tenantId && clientId) });
    const tariffsQuery = useAsyncQuery(() => tenantId && clientId
        ? listClientTariffPositions(tenantId, clientId)
        : Promise.resolve({ ok: false as const, error: 'Kein Mandant oder Pflegefall.' }), [tenantId, clientId], { enabled: Boolean(tenantId && clientId) });
    const budgetsQuery = useAsyncQuery(() => tenantId && clientId
        ? listClientBudgetEntitlementLedger(tenantId, clientId)
        : Promise.resolve({ ok: false as const, error: 'Kein Mandant oder Pflegefall.' }), [tenantId, clientId], { enabled: Boolean(tenantId && clientId) });
    const estimatesQuery = useAsyncQuery(() => tenantId && clientId
        ? listClientCostEstimateLedger(tenantId, clientId)
        : Promise.resolve({ ok: false as const, error: 'Kein Mandant oder Pflegefall.' }), [tenantId, clientId], { enabled: Boolean(tenantId && clientId) });
    if ((query.loading && !query.data) || (approvalsQuery.loading && !approvalsQuery.data) || (tariffsQuery.loading && !tariffsQuery.data) || (budgetsQuery.loading && !budgetsQuery.data) || (estimatesQuery.loading && !estimatesQuery.data))
        return <LoadingState message="Finanzierungswege werden geladen…"/>;
    if (query.error && !query.data)
        return <ErrorState message={query.error} onRetry={query.refresh}/>;
    if (approvalsQuery.error && !approvalsQuery.data)
        return <ErrorState message={approvalsQuery.error} onRetry={approvalsQuery.refresh}/>;
    if (tariffsQuery.error && !tariffsQuery.data)
        return <ErrorState message={tariffsQuery.error} onRetry={tariffsQuery.refresh}/>;
    if (budgetsQuery.error && !budgetsQuery.data)
        return <ErrorState message={budgetsQuery.error} onRetry={budgetsQuery.refresh}/>;
    if (estimatesQuery.error && !estimatesQuery.data)
        return <ErrorState message={estimatesQuery.error} onRetry={estimatesQuery.refresh}/>;
    const referenceDate = localCalendarDate();
    const assessments = assessParallelClientFinancingPaths(query.data ?? [], referenceDate);
    const approvalAssessments = assessClientFinancingApprovals(approvalsQuery.data ?? [], referenceDate);
    const tariffAssessments = assessClientTariffPositions(tariffsQuery.data ?? [], referenceDate);
    return (<SectionPanel title="Getrennte Finanzierungswege" subtitle="SGB XI, SGB V und private Grundlagen bleiben je Kostenträger und Zeitraum eigenständig">
      {assessments.length === 0 ? (<EmptyState title="Keine getrennten Wege dokumentiert" message="Bestehende Auswahlwerte werden nicht automatisch zu gültigen Finanzierungswegen erklärt."/>) : assessments.map(({ path, state, issues }) => {
            const approvals = approvalAssessments.filter((entry) => entry.approval.financingPathId === path.id);
            const tariffs = tariffAssessments.filter((entry) => entry.position.financingPathId === path.id);
            const budgets = (budgetsQuery.data?.periods ?? []).filter((period) => period.financingPathId === path.id);
            const estimates = (estimatesQuery.data?.estimates ?? []).filter((estimate) => estimate.financingPathId === path.id);
            return <PremiumCard key={path.id} style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
            <Text style={{ ...typography.label, color: careSuiteAuroraTheme.text.primary, flex: 1 }}>
              {CLIENT_FINANCING_KIND_LABELS[path.financingKind]} · {path.payerName}
            </Text>
            <PremiumBadge label={state === 'current' ? 'Zum Prüftag aktuell' : 'Prüfung offen'} variant={state === 'current' ? 'green' : 'orange'}/>
          </View>
          <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted, marginTop: spacing.xs }}>
            {formatDate(path.validFrom)} bis {path.validUntil ? formatDate(path.validUntil) : 'unbefristet'} · Version {path.version}
          </Text>
          <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted, marginTop: spacing.xs }}>
            Originalgrundlage: {path.basisReference}{path.payerIk ? ` · IK ${path.payerIk}` : ''}
          </Text>
          {issues.length ? <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted, marginTop: spacing.xs }}>Offene Prüfung: {issues.join(', ')}</Text> : null}
          {approvals.length === 0 ? (<Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted, marginTop: spacing.xs }}>Keine konkrete Antrags-/Entscheidungsfassung dokumentiert.</Text>) : approvals.map(({ approval, state: approvalState, remainingDays, followUp, issues: approvalIssues }) => (<View key={approval.id} style={{ marginTop: spacing.sm }}>
              <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.primary }}>
                Antrag {approval.applicationReference} · {approval.decision === 'approved' ? 'bewilligt' : approval.decision}
              </Text>
              <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted }}>
                {approvalState === 'approved_current' ? `Bewilligung aktuell · ${remainingDays} Resttage` : `Genehmigungsprüfung offen · ${approvalIssues.join(', ')}`}
                {followUp === 'overdue' ? ' · Folgeschritt überfällig' : followUp === 'due_soon' ? ' · Folgeschritt bald fällig' : ''}
              </Text>
            </View>))}
          {tariffs.length === 0 ? (<Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted, marginTop: spacing.xs }}>Keine datumsgültige Tarif-/Leistungsposition dokumentiert.</Text>) : tariffs.map(({ position, state: tariffState, issues: tariffIssues }) => (<View key={position.id} style={{ marginTop: spacing.sm }}>
              <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.primary }}>
                {position.serviceCode} · {position.serviceLabel} · {formatTariffPrice(position.unitPriceCents)}/{position.billingUnit}
              </Text>
              <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted }}>
                {position.regionName} · {position.payerName}{position.payerIk ? ` · IK ${position.payerIk}` : ''} · {formatDate(position.validFrom)} bis {position.openEnded ? 'ausdrücklich unbefristet' : position.validUntil ? formatDate(position.validUntil) : 'Ende fehlt'}
              </Text>
              <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted }}>
                {tariffState === 'applicable' ? `Zum Prüftag anwendbar · Version ${position.version}` : `Tarifprüfung offen · ${tariffIssues.join(', ')}`} · Originalgrundlage {position.agreementReference}
              </Text>
              <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted }}>
                {position.roundingRule !== null && position.surchargeBasisPoints !== null && position.fixedSurchargeCents !== null
                        ? `Berechnung: ${ROUNDING_LABELS[position.roundingRule]} · Zuschlag ${(position.surchargeBasisPoints / 100).toFixed(2).replace('.', ',')} % + ${formatTariffPrice(position.fixedSurchargeCents)}`
                        : 'Berechnungsregel oder Zuschlag nicht vollständig dokumentiert.'}
              </Text>
            </View>))}
          {budgets.length === 0 ? (<Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted, marginTop: spacing.xs }}>Keine individuell belegte Budget-/Anspruchsgrundlage dokumentiert.</Text>) : budgets.map((period) => {
                    try {
                        const projection = projectClientBudgetConsumption(period, (budgetsQuery.data?.events ?? []).filter((event) => event.entitlementPeriodId === period.id));
                        return <View key={period.id} style={{ marginTop: spacing.sm }}>
                <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.primary }}>
                  {period.serviceTypeKey} · Anspruch {formatBudgetAmount(period.allocatedCents)}
                </Text>
                <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted }}>
                  {formatDate(period.periodStart)} bis {formatDate(period.periodEnd)} · Grundlage {period.basisReference}
                </Text>
                <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted }}>
                  Wirksamer Verbrauch {formatBudgetAmount(projection.consumedCents)} · Rest {formatBudgetAmount(projection.remainingCents)} · {projection.history.length} historische Ereignisse
                </Text>
              </View>;
                    }
                    catch {
                        return <Text key={period.id} style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted, marginTop: spacing.xs }}>Budgetverbrauch ist wegen unvollständiger oder mehrdeutiger Historie nicht auswertbar.</Text>;
                    }
                })}
          {estimates.length === 0 ? (<Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted, marginTop: spacing.xs }}>Kein versionierter Kostenvoranschlag dokumentiert.</Text>) : estimates.map((estimate) => {
                    try {
                        const assessment = assessClientCostEstimate(estimate, (estimatesQuery.data?.lines ?? []).filter((line) => line.estimateVersionId === estimate.id), (estimatesQuery.data?.decisions ?? []).filter((decision) => decision.estimateVersionId === estimate.id), referenceDate);
                        return <View key={estimate.id} style={{ marginTop: spacing.sm }}>
                <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.primary }}>
                  Kostenvoranschlag Version {estimate.version} · {assessment.lines.length} Leistungszeilen · {formatBudgetAmount(assessment.totalAmountCents)}
                </Text>
                <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted }}>
                  Leistung {formatDate(estimate.servicePeriodStart)} bis {formatDate(estimate.servicePeriodEnd)} · Eigenanteil {formatBudgetAmount(estimate.selfPayCents)}
                </Text>
                <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted }}>
                  {assessment.state === 'accepted' && assessment.decision
                                ? `Angenommen: Version ${assessment.decision.estimateVersion} · Nachweis ${assessment.decision.evidenceReference}`
                                : assessment.state === 'declined' && assessment.decision
                                    ? `Abgelehnt: Version ${assessment.decision.estimateVersion} · Nachweis ${assessment.decision.evidenceReference}`
                                    : `Angebotsstatus: ${assessment.state} · Annahme nicht dokumentiert`}
                </Text>
              </View>;
                    }
                    catch {
                        return <Text key={estimate.id} style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted, marginTop: spacing.xs }}>Kostenvoranschlag ist wegen unvollständiger oder mehrdeutiger Versionsdaten nicht auswertbar.</Text>;
                    }
                })}
        </PremiumCard>;
        })}
      <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted }}>
        Die Anzeige wählt weder Kostenträger noch aktuellen Standardpreis automatisch aus und bestätigt weder Anspruch, Genehmigung noch Abrechnungsfreigabe. Ein Kostenvoranschlag oder dessen Annahme belegt weder Vertragsabschluss noch Leistungserbringung.
      </Text>
    </SectionPanel>);
}
