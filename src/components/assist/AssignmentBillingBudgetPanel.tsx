import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { getClientAssistBillingProfile } from '@/lib/assist/clientAssistBillingProfileService';
import {
  calculateAssistBudgetAllocationFromProfile,
  computeAssignmentAmountCents,
  resolveHourlyRateCents,
} from '@/lib/assist/calculateAssistBudgetAllocation';
import { formatBudgetPeriodLabelCapitalized } from '@/lib/assist/budgetPeriodLabels';
import { computeAvailableCents } from '@/lib/assist/clientBudgetTransactionService';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import {
  ALLOCATION_LINE_STATUS_LABELS,
  type AssistBudgetAllocationResult,
  type ManualBudgetAllocationOverride,
} from '@/types/assist/assignmentBudgetAllocation';
import {
  BUDGET_TEMPLATE_LABELS,
  CARE_PREVENTION_MODE_LABELS,
  type ClientAssistBillingProfile,
} from '@/types/assist/clientAssistBilling';
import { colors, spacing, typography } from '@/theme';

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

function ServiceEntitlementCards({ profile }: { profile: ClientAssistBillingProfile }) {
  const text = useAuroraAdaptiveText();
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

  return (
    <View style={styles.cardGrid}>
      {catalogKeys.map((key) => {
        const account = profile.budgetAccounts.find((a) => a.catalogKey === key);
        const canUse = profile.canUseBudgetByCatalogKey[key];
        const label = BUDGET_TEMPLATE_LABELS[key as keyof typeof BUDGET_TEMPLATE_LABELS] ?? key;
        const active = !!account || profile.serviceEntitlements.some((s) => s.isActive);

        return (
          <PremiumCard key={key} style={styles.serviceCard}>
            <Text style={[styles.cardTitle, { color: text.primary }]}>{label}</Text>
            <PremiumBadge
              label={active ? (canUse ? 'verfügbar' : 'gesperrt') : 'inaktiv'}
              variant={canUse ? 'green' : active ? 'orange' : 'gray'}
            />
            {account ? (
              <Text style={[styles.meta, { color: text.secondary }]}>
                {formatBudgetPeriodLabelCapitalized(account.period, key)} · Verfügbar:{' '}
                {formatCurrency(computeAvailableCents(account), true)}
                {account.isIndividualOverride ? ' · individuell' : ''}
              </Text>
            ) : null}
          </PremiumCard>
        );
      })}
    </View>
  );
}

function BudgetOverviewTable({ profile }: { profile: ClientAssistBillingProfile }) {
  const text = useAuroraAdaptiveText();
  if (profile.budgetAccounts.length === 0) {
    return (
      <EmptyState
        title="Keine Budgetkonten"
        message="Budgetkonten stammen aus der Klient:innenakte — keine hart codierten Beträge."
      />
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
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
        {profile.budgetAccounts.map((a) => (
          <View key={a.id} style={[styles.tableRow, { borderBottomColor: text.border }]}>
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
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function AllocationProposalTable({ allocation }: { allocation: AssistBudgetAllocationResult }) {
  const text = useAuroraAdaptiveText();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
      <View style={styles.table}>
        <View style={[styles.tableHeader, { borderBottomColor: text.border }]}>
          <Text style={[styles.headCell, styles.colOrder, { color: text.primary }]}>#</Text>
          <Text style={[styles.headCell, styles.colBudget, { color: text.primary }]}>Budgettopf</Text>
          <Text style={[styles.headCell, styles.colNum, { color: text.primary }]}>Betrag</Text>
          <Text style={[styles.headCell, styles.colSmall, { color: text.primary }]}>Status</Text>
          <Text style={[styles.headCell, styles.colReason, { color: text.primary }]}>Begründung</Text>
        </View>
        {allocation.allocationProposal.map((line) => (
          <View key={`${line.priorityOrder}-${line.catalogKey}`} style={[styles.tableRow, { borderBottomColor: text.border }]}>
            <Text style={[styles.cell, styles.colOrder, { color: text.secondary }]}>{line.priorityOrder}</Text>
            <Text style={[styles.cell, styles.colBudget, { color: text.primary }]}>{line.label}</Text>
            <Text style={[styles.cell, styles.colNum, { color: text.primary }]}>
              {formatCurrency(line.amountCents, true)}
            </Text>
            <Text style={[styles.cell, styles.colSmall, { color: text.secondary }]}>
              {ALLOCATION_LINE_STATUS_LABELS[line.status]}
            </Text>
            <Text style={[styles.cell, styles.colReason, { color: text.secondary }]}>{line.reason}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export function AssignmentBillingBudgetPanel({
  clientId,
  clientName,
  assignmentDate,
  plannedStartTime,
  plannedEndTime,
  serviceKey,
  plannedMinutes,
  allocation,
  manualOverride,
  onAllocationChange,
  onManualOverrideChange,
}: AssignmentBillingBudgetPanelProps) {
  const text = useAuroraAdaptiveText();
  const tenantId = useServiceTenantId();
  const { can } = usePermissions();
  const canOverride = can('assist.assignment.budget.override');
  const canView = can('assist.assignment.budget.view') || can('assist.assignments.manage');

  const [overrideCatalogKey, setOverrideCatalogKey] = useState(manualOverride?.catalogKey ?? '');
  const [overrideReason, setOverrideReason] = useState(manualOverride?.reason ?? '');

  const profileQuery = useAsyncQuery<ClientAssistBillingProfile>(
    () => {
      if (!tenantId || !clientId) {
        return Promise.resolve({ ok: false as const, error: 'Kein Mandant oder Klient:in.' });
      }
      return getClientAssistBillingProfile({
        tenantId,
        clientId,
        date: assignmentDate,
        autoGenerateAccounts: true,
      }) as Promise<{ ok: true; data: ClientAssistBillingProfile } | { ok: false; error: string }>;
    },
    [tenantId, clientId, assignmentDate],
    { enabled: !!tenantId && !!clientId && canView },
  );

  const recalculate = useCallback(
    (profile: ClientAssistBillingProfile, override?: ManualBudgetAllocationOverride | null) => {
      const hourlyRateCents = resolveHourlyRateCents(profile, serviceKey);
      const minutes = plannedMinutes > 0 ? plannedMinutes : 60;
      const result = calculateAssistBudgetAllocationFromProfile(profile, {
        assignmentDate,
        plannedStart: plannedStartTime,
        plannedEnd: plannedEndTime,
        plannedMinutes: minutes,
        hourlyRateCents,
        serviceType: serviceKey,
        manualOverride: override ?? null,
        actorRoleKey: null,
      });
      onAllocationChange(result);
    },
    [
      assignmentDate,
      onAllocationChange,
      plannedEndTime,
      plannedMinutes,
      plannedStartTime,
      serviceKey,
    ],
  );

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

  const careFund = profileQuery.data?.careEntitlement?.careFundName;

  const totalLabel = useMemo(() => {
    if (!allocation) return '—';
    return formatCurrency(allocation.totalAmountCents, true);
  }, [allocation]);

  if (!clientId) {
    return <InfoBanner message="Bitte zuerst eine:n Klient:in auswählen." variant="warning" />;
  }

  if (!canView) {
    return <InfoBanner message="Keine Berechtigung für Einsatz-Budget." variant="warning" />;
  }

  if (profileQuery.loading && !profileQuery.data) {
    return <LoadingState message="Abrechnungsprofil wird geladen…" />;
  }

  if (profileQuery.error && !profileQuery.data) {
    return <ErrorState message={profileQuery.error} onRetry={profileQuery.refresh} />;
  }

  const profile = profileQuery.data;
  if (!profile) return null;

  return (
    <View style={styles.root}>
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
        {profile.carePreventionMode === 'joint_annual_budget' ? (
          <InfoBanner
            message="Gemeinsames Jahresbudget — VP/Kurzzeit-Einzelkonten sind gesperrt."
            variant="warning"
          />
        ) : null}
        {profile.budgetAccounts.some((a) => a.catalogKey.startsWith('umwandlung_')) ? (
          <InfoBanner
            message="Umwandlung (§ 45a) wird monatlich aus dem Klientenprofil gelesen — nicht jährlich."
            variant="info"
          />
        ) : null}
      </SectionPanel>

      <SectionPanel {...FORM_CTX} title="Aktivierte Leistungen">
        <ServiceEntitlementCards profile={profile} />
      </SectionPanel>

      <SectionPanel {...FORM_CTX} title="Budgetübersicht">
        <BudgetOverviewTable profile={profile} />
      </SectionPanel>

      <SectionPanel {...FORM_CTX} title="Automatischer Abrechnungsvorschlag">
        {allocation ? (
          <AllocationProposalTable allocation={allocation} />
        ) : (
          <Text style={[styles.meta, { color: text.secondary }]}>Berechnung ausstehend…</Text>
        )}
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

      {canOverride ? (
        <SectionPanel {...FORM_CTX} title="Manuelle Korrektur">
          <PremiumInput
            {...FORM_CTX}
            label="Budgettopf (catalog_key)"
            value={overrideCatalogKey}
            onChangeText={setOverrideCatalogKey}
            placeholder="z. B. paragraph_45b"
          />
          <PremiumInput
            {...FORM_CTX}
            label="Pflichtgrund"
            value={overrideReason}
            onChangeText={setOverrideReason}
            multiline
          />
          <PremiumButton
            title="Korrektur anwenden"
            variant="secondary"
            onPress={() => {
              const override: ManualBudgetAllocationOverride = {
                catalogKey: overrideCatalogKey.trim(),
                amountCents: allocation?.totalAmountCents ?? 0,
                reason: overrideReason.trim(),
              };
              onManualOverrideChange(override);
              recalculate(profile, override);
            }}
          />
          {manualOverride ? (
            <PremiumButton
              title="Korrektur zurücksetzen"
              variant="glass"
              onPress={() => {
                onManualOverrideChange(null);
                setOverrideCatalogKey('');
                setOverrideReason('');
                recalculate(profile, null);
              }}
            />
          ) : null}
        </SectionPanel>
      ) : null}

      {allocation?.warnings.length ? (
        <SectionPanel {...FORM_CTX} title="Warnungen">
          {allocation.warnings.map((w) => (
            <InfoBanner key={w} message={w} variant="warning" />
          ))}
        </SectionPanel>
      ) : null}

      {allocation && !allocation.canSave ? (
        <InfoBanner
          message="Speichern eingeschränkt — Budget oder Berechtigungen prüfen."
          variant="danger"
        />
      ) : null}
    </View>
  );
}

export function useAssignmentBudgetPreview(input: {
  clientId: string;
  assignmentDate: string;
  plannedMinutes: number;
  serviceKey?: string;
}) {
  return computeAssignmentAmountCents(
    input.plannedMinutes,
    3275,
  );
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
