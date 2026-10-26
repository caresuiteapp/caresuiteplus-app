// Generated native presentation from src/components/assist/AssignmentBillingBudgetPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {__nativeWorkspaceStyleSheets as __nativeWorkspaceImportedStyles0} from "./AssignmentFormControls.native.tsx";
import {NativeDiv,NativeAside,NativeStrong,NativeP,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { EmptyState, ErrorState, InfoBanner, LoadingState, PremiumBadge, PremiumButton, PremiumCard, PremiumInput, SectionPanel, } from "./AssignmentFormControls.native.tsx";
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { AssignmentFormStyles, ChipSelect } from "./AssignmentFormControls.native.tsx";
import { useAuth } from '@/lib/auth/context';
import { getClientAssistBillingProfile } from '@/lib/assist/clientAssistBillingProfileService';
import { calculateAssistBudgetAllocationFromProfile, resolveHourlyRateCents, } from '@/lib/assist/calculateAssistBudgetAllocation';
import { formatBudgetPeriodLabelCapitalized } from '@/lib/assist/budgetPeriodLabels';
import { computeAvailableCents } from '@/lib/assist/clientBudgetTransactionService';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { ALLOCATION_LINE_STATUS_LABELS, type AssistBudgetAllocationResult, type ManualBudgetAllocationOverride, } from '@/types/assist/assignmentBudgetAllocation';
import { BUDGET_TEMPLATE_LABELS, CARE_PREVENTION_MODE_LABELS, type ClientAssistBillingProfile, } from '@/types/assist/clientAssistBilling';
import { spacing, typography } from '@/theme';
const FORM_CTX = { viewContext: 'form' as const };
export type AssignmentBillingBudgetPanelProps = {
    clientId: string;
    clientName?: string;
    assignmentDate: string;
    plannedStartTime: string;
    plannedEndTime: string;
    serviceKey?: string;
    plannedMinutes: number;
    allocation: AssistBudgetAllocationResult | null;
    manualOverride: ManualBudgetAllocationOverride | null;
    onAllocationChange: (allocation: AssistBudgetAllocationResult | null) => void;
    onManualOverrideChange: (override: ManualBudgetAllocationOverride | null) => void;
};
function ServiceEntitlementCards({ profile }: {
    profile: ClientAssistBillingProfile;
}) {
    const text = { primary: '#173b5b', secondary: '#617b90', border: '#dce7f1' };
    const catalogKeys = [
        'paragraph_45b',
        'umwandlung_pg2',
        'umwandlung_pg3',
        'umwandlung_pg4',
        'umwandlung_pg5',
        'verhinderungspflege',
        'kurzzeitpflege',
        'gemeinsames_jahresbudget',
        'selbstzahler',
        'kulanz',
        'ungeklaert',
    ];
    return (<View style={styles.cardGrid}>
      {catalogKeys.map((key) => {
            const account = profile.budgetAccounts.find((a) => a.catalogKey === key);
            const canUse = profile.canUseBudgetByCatalogKey[key];
            const label = BUDGET_TEMPLATE_LABELS[key as keyof typeof BUDGET_TEMPLATE_LABELS] ?? key;
            const active = !!account && account.status === 'active';
            return (<PremiumCard key={key} style={styles.serviceCard}>
            <Text style={[styles.cardTitle, { color: text.primary }]}>{label}</Text>
            <PremiumBadge label={active ? (canUse ? 'verfügbar' : 'gesperrt') : 'inaktiv'} variant={canUse ? 'green' : active ? 'orange' : 'muted'}/>
            {account ? (<Text style={[styles.meta, { color: text.secondary }]}>
                {formatBudgetPeriodLabelCapitalized(account.period, key)} · Verfügbar:{' '}
                {formatCurrency(computeAvailableCents(account), true)}
                {account.isIndividualOverride ? ' · individuell' : ''}
              </Text>) : null}
          </PremiumCard>);
        })}
    </View>);
}
function BudgetOverviewTable({ profile }: {
    profile: ClientAssistBillingProfile;
}) {
    const text = { primary: '#173b5b', secondary: '#617b90', border: '#dce7f1' };
    if (profile.budgetAccounts.length === 0) {
        return (<EmptyState title="Keine Budgetkonten" message="Für diese Person sind noch keine Budgetkonten hinterlegt."/>);
    }
    return (<ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
      <View style={styles.table}>
        <View style={[styles.tableHeader, { borderBottomColor: text.border }]}>
          <Text style={[styles.headCell, styles.colBudget, { color: text.primary }]}>Budgettopf</Text>
          <Text style={[styles.headCell, styles.colSmall, { color: text.primary }]}>Zeitraum</Text>
          <Text style={[styles.headCell, styles.colNum, { color: text.primary }]}>Gesamt</Text>
          <Text style={[styles.headCell, styles.colNum, { color: text.primary }]}>Verbraucht</Text>
          <Text style={[styles.headCell, styles.colNum, { color: text.primary }]}>Reserviert</Text>
          <Text style={[styles.headCell, styles.colNum, { color: text.primary }]}>Verfügbar</Text>
          <Text style={[styles.headCell, styles.colSmall, { color: text.primary }]}>Status</Text>
        </View>
        {profile.budgetAccounts.map((a) => (<View key={a.id} style={[styles.tableRow, { borderBottomColor: text.border }]}>
            <Text style={[styles.cell, styles.colBudget, { color: text.primary }]}>
              {a.label ?? BUDGET_TEMPLATE_LABELS[a.catalogKey as keyof typeof BUDGET_TEMPLATE_LABELS] ?? a.catalogKey}
            </Text>
            <Text style={[styles.cell, styles.colSmall, { color: text.secondary }]}>
              {formatBudgetPeriodLabelCapitalized(a.period, a.catalogKey)}
            </Text>
            <Text style={[styles.cell, styles.colNum, { color: text.primary }]}>
              {formatCurrency(a.allocatedCents, true)}
            </Text>
            <Text style={[styles.cell, styles.colNum, { color: text.primary }]}>
              {formatCurrency(a.usedCents, true)}
            </Text>
            <Text style={[styles.cell, styles.colNum, { color: text.primary }]}>
              {formatCurrency(a.reservedCents, true)}
            </Text>
            <Text style={[styles.cell, styles.colNum, { color: text.primary }]}>
              {formatCurrency(computeAvailableCents(a), true)}
            </Text>
            <Text style={[styles.cell, styles.colSmall, { color: text.secondary }]}>
              {profile.canUseBudgetByCatalogKey[a.catalogKey] ? 'OK' : 'gesperrt'}
            </Text>
          </View>))}
      </View>
    </ScrollView>);
}
function AllocationProposalTable({ allocation }: {
    allocation: AssistBudgetAllocationResult;
}) {
    const text = { primary: '#173b5b', secondary: '#617b90', border: '#dce7f1' };
    return (<ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
      <View style={styles.table}>
        <View style={[styles.tableHeader, { borderBottomColor: text.border }]}>
          <Text style={[styles.headCell, styles.colOrder, { color: text.primary }]}>#</Text>
          <Text style={[styles.headCell, styles.colBudget, { color: text.primary }]}>Budgettopf</Text>
          <Text style={[styles.headCell, styles.colNum, { color: text.primary }]}>Betrag</Text>
          <Text style={[styles.headCell, styles.colSmall, { color: text.primary }]}>Status</Text>
          <Text style={[styles.headCell, styles.colReason, { color: text.primary }]}>Begründung</Text>
        </View>
        {allocation.allocationProposal.map((line) => (<View key={`${line.priorityOrder}-${line.catalogKey}`} style={[styles.tableRow, { borderBottomColor: text.border }]}>
            <Text style={[styles.cell, styles.colOrder, { color: text.secondary }]}>{line.priorityOrder}</Text>
            <Text style={[styles.cell, styles.colBudget, { color: text.primary }]}>{line.label}</Text>
            <Text style={[styles.cell, styles.colNum, { color: text.primary }]}>
              {formatCurrency(line.amountCents, true)}
            </Text>
            <Text style={[styles.cell, styles.colSmall, { color: text.secondary }]}>
              {ALLOCATION_LINE_STATUS_LABELS[line.status]}
            </Text>
            <Text style={[styles.cell, styles.colReason, { color: text.secondary }]}>{line.reason}</Text>
          </View>))}
      </View>
    </ScrollView>);
}
export function AssignmentBillingBudgetPanel({ clientId, clientName, assignmentDate, plannedStartTime, plannedEndTime, serviceKey, plannedMinutes, allocation, manualOverride, onAllocationChange, onManualOverrideChange, }: AssignmentBillingBudgetPanelProps) {
    const text = { primary: '#173b5b', secondary: '#617b90', border: '#dce7f1' };
    const tenantId = useServiceTenantId();
    const { can, isReadOnly } = usePermissions();
    const { profile: actor } = useAuth();
    const canOverride = can('assist.assignment.budget.override') && !isReadOnly;
    const canView = can('assist.assignment.budget.view') || can('assist.assignments.manage');
    const [overrideCatalogKey, setOverrideCatalogKey] = useState(manualOverride?.catalogKey ?? '');
    const [overrideReason, setOverrideReason] = useState(manualOverride?.reason ?? '');
    const profileQuery = useAsyncQuery<ClientAssistBillingProfile>(() => {
        if (!tenantId || !clientId) {
            return Promise.resolve({ ok: false as const, error: 'Kein Mandant oder Klient:in.' });
        }
        return getClientAssistBillingProfile({
            tenantId,
            clientId,
            date: assignmentDate,
            autoGenerateAccounts: true,
        }) as Promise<{
            ok: true;
            data: ClientAssistBillingProfile;
        } | {
            ok: false;
            error: string;
        }>;
    }, [tenantId, clientId, assignmentDate, actor?.id, actor?.roleKey, canView], { enabled: !!tenantId && !!clientId && canView, queryKey: JSON.stringify([tenantId, clientId, assignmentDate, actor?.id, actor?.roleKey, canView]) });
    const recalculate = useCallback((profile: ClientAssistBillingProfile, override?: ManualBudgetAllocationOverride | null) => {
        const hourlyRateCents = resolveHourlyRateCents(profile, serviceKey);
        const minutes = Math.max(0, plannedMinutes);
        const result = calculateAssistBudgetAllocationFromProfile(profile, {
            assignmentDate,
            plannedStart: plannedStartTime,
            plannedEnd: plannedEndTime,
            plannedMinutes: minutes,
            hourlyRateCents,
            serviceType: serviceKey,
            manualOverride: override ?? null,
            actorRoleKey: actor?.roleKey ?? null,
        });
        onAllocationChange(result);
    }, [
        assignmentDate,
        actor?.roleKey,
        onAllocationChange,
        plannedEndTime,
        plannedMinutes,
        plannedStartTime,
        serviceKey,
    ]);
    useEffect(() => {
        if (profileQuery.data) {
            recalculate(profileQuery.data, manualOverride);
        }
    }, [
        profileQuery.data,
        assignmentDate,
        plannedStartTime,
        plannedEndTime,
        plannedMinutes,
        serviceKey,
        manualOverride,
        recalculate,
    ]);
    useEffect(() => { setOverrideCatalogKey(manualOverride?.catalogKey ?? ''); setOverrideReason(manualOverride?.reason ?? ''); }, [tenantId, clientId, manualOverride]);
    const careFund = profileQuery.data?.careEntitlement?.careFundName;
    const totalLabel = useMemo(() => {
        if (!allocation)
            return '—';
        return formatCurrency(allocation.totalAmountCents, true);
    }, [allocation]);
    if (!clientId) {
        return <InfoBanner message="Bitte zuerst eine:n Klient:in auswählen." variant="warning"/>;
    }
    if (!canView) {
        return <InfoBanner message="Keine Berechtigung für Einsatz-Budget." variant="warning"/>;
    }
    if (profileQuery.loading && !profileQuery.data) {
        return <LoadingState message="Abrechnungsprofil wird geladen…"/>;
    }
    if (profileQuery.error && !profileQuery.data) {
        return <ErrorState message={profileQuery.error} onRetry={profileQuery.refresh}/>;
    }
    const profile = profileQuery.data;
    if (!profile)
        return null;
    return <NativeWorkspaceStyleScope css={[...__nativeWorkspaceImportedStyles0["AssignmentFormStyles"]]}>{(<NativeDiv className="aw-workspace acf-root" style={{ padding: 0 }}><AssignmentFormStyles /><View style={styles.root}>
      <SectionPanel {...FORM_CTX} title="Klientenstatus">
        <PremiumCard style={styles.statusCard}>
          <Text style={[styles.cardTitle, { color: text.primary }]}>
            {clientName ?? 'Klient:in'}
          </Text>
          <Text style={[styles.meta, { color: text.secondary }]}>
            PG: {formatCareLevel(profile.careGrade ?? 'kein')}
            {careFund ? ` · Kostenträger: ${careFund}` : ' · Kostenträger: —'}
          </Text>
          <Text style={[styles.meta, { color: text.secondary }]}>
            Budget-Modus: {CARE_PREVENTION_MODE_LABELS[profile.carePreventionMode]}
          </Text>
          <Text style={[styles.meta, { color: text.secondary }]}>
            Einsatzwert (Vorschau): {totalLabel}
            {allocation?.hasSelfPayerAgreement ? ' · Selbstzahlervereinbarung vorhanden' : ''}
          </Text>
        </PremiumCard>
        {profile.carePreventionMode === 'joint_annual_budget' ? (<InfoBanner message="Gemeinsames Jahresbudget — VP/Kurzzeit-Einzelkonten sind gesperrt." variant="warning"/>) : null}
        {profile.budgetAccounts.some((a) => a.catalogKey.startsWith('umwandlung_')) ? (<InfoBanner message="Umwandlung (§ 45a) wird monatlich aus dem Klientenprofil gelesen — nicht jährlich." variant="info"/>) : null}
      </SectionPanel>

      <SectionPanel {...FORM_CTX} title="Aktivierte Leistungen">
        <ServiceEntitlementCards profile={profile}/>
      </SectionPanel>

      <SectionPanel {...FORM_CTX} title="Budgetübersicht">
        <BudgetOverviewTable profile={profile}/>
      </SectionPanel>

      <SectionPanel {...FORM_CTX} title="Automatischer Abrechnungsvorschlag">
        {allocation ? (<AllocationProposalTable allocation={allocation}/>) : (<Text style={[styles.meta, { color: text.secondary }]}>Berechnung ausstehend…</Text>)}
      </SectionPanel>

      <SectionPanel {...FORM_CTX} title="Selbstzahleranteil">
        <PremiumCard>
          <Text style={[styles.cardTitle, { color: text.primary }]}>
            {formatCurrency(allocation?.selfPayerAmountCents ?? 0, true)}
          </Text>
          <Text style={[styles.meta, { color: text.secondary }]}>
            Vereinbarung:{' '}
            {allocation?.hasSelfPayerAgreement ? 'vorhanden' : 'fehlt — Warnung bei Speichern'}
          </Text>
        </PremiumCard>
      </SectionPanel>

      {canOverride ? (<SectionPanel {...FORM_CTX} title="Manuelle Korrektur">
          <ChipSelect label="Budgettopf" options={profile.budgetAccounts.map(account => ({ value: account.catalogKey, label: account.label ?? BUDGET_TEMPLATE_LABELS[account.catalogKey as keyof typeof BUDGET_TEMPLATE_LABELS] ?? account.catalogKey }))} value={overrideCatalogKey} onChange={setOverrideCatalogKey}/>
          <PremiumInput {...FORM_CTX} label="Pflichtgrund" value={overrideReason} onChangeText={setOverrideReason} multiline/>
          <PremiumButton title="Korrektur anwenden" disabled={!overrideReason.trim() || !profile.budgetAccounts.some(account => account.catalogKey === overrideCatalogKey) || !allocation || plannedMinutes <= 0} variant="secondary" onPress={() => {
                if (!canOverride || !overrideReason.trim() || !profile.budgetAccounts.some(account => account.catalogKey === overrideCatalogKey) || !allocation || plannedMinutes <= 0)
                    return;
                const override: ManualBudgetAllocationOverride = {
                    catalogKey: overrideCatalogKey.trim(),
                    amountCents: allocation?.totalAmountCents ?? 0,
                    reason: overrideReason.trim(),
                };
                onManualOverrideChange(override);
                recalculate(profile, override);
            }}/>
          {manualOverride ? (<PremiumButton title="Korrektur zurücksetzen" variant="ghost" onPress={() => {
                    onManualOverrideChange(null);
                    setOverrideCatalogKey('');
                    setOverrideReason('');
                    recalculate(profile, null);
                }}/>) : null}
        </SectionPanel>) : null}

      {allocation?.warnings.length ? (<SectionPanel {...FORM_CTX} title="Warnungen">
          {allocation.warnings.map((w) => (<InfoBanner key={w} message={w} variant="warning"/>))}
        </SectionPanel>) : null}

      {allocation && !allocation.canSave ? (<InfoBanner message="Speichern eingeschränkt — Budget oder Berechtigungen prüfen." variant="danger"/>) : null}
    </View></NativeDiv>)}</NativeWorkspaceStyleScope>;
}
export function AssignmentClientBillingSummary({ clientId }: {
    clientId: string;
}) {
    const tenantId = useServiceTenantId();
    const { profile: actor } = useAuth();
    const { can } = usePermissions();
    const enabled = !!tenantId && !!clientId && (can('assist.assignment.budget.view') || can('assist.assignments.manage'));
    const query = useAsyncQuery<ClientAssistBillingProfile>(() => getClientAssistBillingProfile({ tenantId: tenantId!, clientId, autoGenerateAccounts: false }), [tenantId, clientId, actor?.id, actor?.roleKey, enabled], { enabled, queryKey: JSON.stringify([tenantId, clientId, actor?.id, actor?.roleKey, enabled]) });
    if (!enabled)
        return null;
    if (query.loading && !query.data)
        return <LoadingState message="Abrechnungsprofil wird geladen…"/>;
    if (query.error)
        return <ErrorState message={query.error} onRetry={query.refresh}/>;
    if (!query.data)
        return null;
    const p = query.data;
    return <NativeAside className="acf-card"><NativeStrong>Abrechnungsprofil</NativeStrong><NativeP className="acf-muted">{formatCareLevel(p.careGrade ?? 'kein')}{p.careEntitlement?.careFundName ? ` · ${p.careEntitlement.careFundName}` : ''}</NativeP>{p.budgetAccounts.slice(0, 3).map(a => <NativeP className="acf-muted" key={a.id}>{a.label ?? BUDGET_TEMPLATE_LABELS[a.catalogKey as keyof typeof BUDGET_TEMPLATE_LABELS] ?? a.catalogKey}: {formatCurrency(computeAvailableCents(a), true)} verfügbar</NativeP>)}{p.warnings.length ? <InfoBanner message={`${p.warnings.length} offene Hinweise im Abrechnungsprofil. Details finden Sie unter „Budget“.`} variant="warning"/> : null}</NativeAside>;
}
const styles = StyleSheet.create({
    root: { gap: spacing.md, maxWidth: '100%' },
    statusCard: { marginBottom: spacing.xs },
    cardTitle: { ...typography.label, fontWeight: '600' },
    meta: { ...typography.caption, marginTop: spacing.xs },
    cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    serviceCard: { minWidth: 140, flexGrow: 1, maxWidth: '100%' },
    tableScroll: { maxWidth: '100%' },
    table: { minWidth: 520 },
    tableHeader: { flexDirection: 'row', borderBottomWidth: 1, paddingBottom: spacing.xs },
    tableRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.sm },
    headCell: { ...typography.caption, fontWeight: '600' },
    cell: { ...typography.caption },
    colOrder: { width: 28 },
    colBudget: { width: 140 },
    colNum: { width: 88, textAlign: 'right' },
    colSmall: { width: 72 },
    colReason: { width: 180, flexShrink: 1 },
});
