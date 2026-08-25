import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumDataTable,
  useWorkflowFeedback,
  type DataTableColumn,
} from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { useRouter } from 'expo-router';
import {
  getWfmOfficeEmployeeTimeAccounts,
  summarizeOfficeTimeAccountKpis,
} from '@/lib/wfm/wfmOfficeZeitkontenService';
import type { WfmOfficeEmployeeTimeAccount } from '@/types/modules/wfmOfficeTimekeeping';
import { getWfmTeamTodayOverview } from '@/lib/wfm/wfmTeamTodayService';
import { subscribeToWfmLiveChanges } from '@/lib/realtime/presets';
import { WfmRuleWarningsPanel } from '@/components/wfm/WfmRuleWarningsPanel';
import { WfmTeamTodayDetailPanel } from '@/components/wfm/WfmTeamTodayDetailPanel';
import { WfmTeamTodayEmployeeCard } from '@/components/wfm/WfmTeamTodayEmployeeCard';
import { formatWfmDurationMinutes } from '@/lib/wfm/wfmDisplayHelpers';
import {
  WfmOfficeCompactKpiStrip,
  WfmOfficeFilterBar,
  WfmOfficePeriodChips,
  WfmOfficeSectionHeading,
} from '@/components/wfm/WfmOfficeTimekeepingLayout';
import { typography } from '@/theme';
import { WfmEmployeeTimeAccountWorkspace } from '@/components/wfm/WfmEmployeeTimeAccountWorkspace';

function formatDays(days: number | null): string {
  if (days == null) return '—';
  return `${days.toLocaleString('de-DE', { maximumFractionDigits: 1 })} T.`;
}

function formatDecimal(value: number): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

export function WfmZeitkontenScreen() {
  const tenantId = useServiceTenantId();
  const router = useRouter();
  const { user, profile } = useAuth();
  const reviewerId = user?.id ?? profile?.id ?? '';
  const { can, check, roleLabel, roleKey } = usePermissions();
  const text = useAuroraAdaptiveText();
  const accent = moduleColor('office');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [periodPreset, setPeriodPreset] = useState<'today' | 'this_week' | 'this_month'>('this_month');
  const feedback = useWorkflowFeedback();
  const loadingFeedbackId = useRef<string | null>(null);

  const canView = can('time.tracking.team.view');
  const canApprove = can('office.employees.absences.approve');
  const canCorrect = can('time.tracking.admin.correct');
  const canManage = can('office.employee_time.manage');

  const teamQuery = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId || !canView) {
        return {
          ok: true as const,
          data: {
            workDate: '',
            kpis: {
              capturedToday: 0,
              activeCount: 0,
              onPauseCount: 0,
              onVisitCount: 0,
              inOfficeCount: 0,
              homeofficeCount: 0,
              pendingReviewCount: 0,
              pendingCorrectionCount: 0,
              openRequestsCount: 0,
            },
            rows: [],
          },
        };
      }
      return getWfmTeamTodayOverview(tenantId, roleKey);
    }, [tenantId, canView, roleKey]),
    [tenantId, canView, roleKey],
    {
      enabled: !!tenantId && canView,
      live: {
        tenantId,
        subscribe: subscribeToWfmLiveChanges,
        pollMs: 10_000,
        refreshOnFocus: true,
      },
    },
  );

  const accountsQuery = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId || !canView) return { ok: true as const, data: [] };
      return getWfmOfficeEmployeeTimeAccounts(tenantId, roleKey, {
        preset: periodPreset,
        employeeId: selectedEmployeeId,
      });
    }, [tenantId, canView, roleKey, periodPreset, selectedEmployeeId]),
    [tenantId, canView, roleKey, periodPreset, selectedEmployeeId],
    {
      enabled: !!tenantId && canView,
      live: {
        tenantId,
        subscribe: subscribeToWfmLiveChanges,
        pollMs: 10_000,
        refreshOnFocus: true,
      },
    },
  );

  const timeDataLoading =
    accountsQuery.loading ||
    accountsQuery.refreshing ||
    teamQuery.loading ||
    teamQuery.refreshing;

  useEffect(() => {
    if (timeDataLoading && !loadingFeedbackId.current) {
      loadingFeedbackId.current = feedback.showLoading('Arbeitszeit und Zeitkonten werden aktualisiert…');
      return;
    }
    if (!timeDataLoading && loadingFeedbackId.current) {
      feedback.dismiss(loadingFeedbackId.current);
      loadingFeedbackId.current = null;
    }
  }, [feedback, timeDataLoading]);

  useEffect(() => () => {
    if (loadingFeedbackId.current) feedback.dismiss(loadingFeedbackId.current);
  }, [feedback]);

  const accountColumns = useMemo((): DataTableColumn<WfmOfficeEmployeeTimeAccount>[] => [
    {
      key: 'employee',
      label: 'Mitarbeitende',
      flex: 1.2,
      minWidth: 120,
      render: (account) => (
        <Text style={{ ...typography.caption, color: text.primary }}>{account.employeeName}</Text>
      ),
    },
    {
      key: 'target',
      label: 'Soll',
      width: 72,
      render: (account) => (
        <Text style={{ ...typography.caption, color: text.secondary }}>
          {formatWfmDurationMinutes(account.targetMinutes || account.plannedMinutes)}
        </Text>
      ),
    },
    {
      key: 'ist',
      label: 'Ist',
      width: 72,
      render: (account) => (
        <Text style={{ ...typography.caption, color: text.secondary }}>
          {formatWfmDurationMinutes(account.actualMinutes)}
        </Text>
      ),
    },
    {
      key: 'travel',
      label: 'Fahrzeit',
      width: 88,
      render: (account) => (
        <Text style={{ ...typography.caption, color: text.secondary }}>
          {formatWfmDurationMinutes(account.travelMinutes)}
        </Text>
      ),
    },
    {
      key: 'absence',
      label: 'Abwesend',
      width: 88,
      render: (account) => (
        <Text style={{ ...typography.caption, color: text.secondary }}>
          {formatWfmDurationMinutes(account.absenceMinutes)}
        </Text>
      ),
    },
    {
      key: 'vacation',
      label: 'Resturlaub',
      width: 88,
      render: (account) => (
        <Text style={{ ...typography.caption, color: text.secondary }}>
          {formatDays(account.remainingVacationDays)}
        </Text>
      ),
    },
    {
      key: 'open',
      label: 'Offen',
      width: 64,
      render: (account) => (
        account.openReviewCount > 0 ? (
          <PremiumBadge label={String(account.openReviewCount)} variant="orange" />
        ) : (
          <Text style={{ ...typography.caption, color: text.muted }}>0</Text>
        )
      ),
    },
    {
      key: 'saldo',
      label: 'Saldo',
      width: 72,
      render: (account) => (
        <Text style={{ ...typography.caption, color: text.primary, fontWeight: '600' }}>
          {formatWfmDurationMinutes(account.saldoMinutes)}
        </Text>
      ),
    },
    {
      key: 'action',
      label: 'Aktion',
      width: 96,
      align: 'right',
      render: (account) => (
        <PremiumButton
          title={account.openReviewCount > 0 ? 'Prüfen' : 'Details'}
          variant={account.openReviewCount > 0 ? 'secondary' : 'ghost'}
          onPress={() => {
            if (account.openReviewCount > 0) {
              router.push('/business/office/time-tracking/pruefqueue' as never);
            } else {
              setSelectedEmployeeId((current) =>
                current === account.employeeId ? null : account.employeeId,
              );
            }
          }}
        />
      ),
    },
  ], [router, text]);

  if (!canView) {
    return (
      <LockedActionBanner
        message={check('time.tracking.team.view').reason ?? 'Keine Berechtigung.'}
        roleLabel={roleLabel}
      />
    );
  }

  const overview = teamQuery.data;
  const kpis = overview?.kpis;
  const teamRows = overview?.rows ?? [];
  const accounts = accountsQuery.data ?? [];
  const accountKpis = summarizeOfficeTimeAccountKpis(accounts);
  const selectedAccount = accounts.find((a) => a.employeeId === selectedEmployeeId) ?? null;
  const selectedRow = teamRows.find((r) => r.employeeId === selectedEmployeeId) ?? null;

  const kpiItems = [
    { key: 'employees', label: 'MA', value: String(accountKpis.employees), accent },
    { key: 'plan', label: 'Geplant (Std.)', value: formatDecimal(accountKpis.plannedHours) },
    { key: 'ist', label: 'Ist (Std.)', value: formatDecimal(accountKpis.actualHours) },
    { key: 'approved', label: 'Genehmigt (Std.)', value: formatDecimal(accountKpis.approvedHours) },
    { key: 'exported', label: 'Exportiert (Std.)', value: formatDecimal(accountKpis.exportedHours) },
    { key: 'open', label: 'Offene Prüfungen', value: String(accountKpis.openReviews) },
  ];

  return (
    <View style={styles.root} testID="wfm-zeitkonten-screen">
      <WfmOfficeSectionHeading
        title="Arbeitszeit- und Gehaltsvorbereitung"
        subtitle="Soll/Ist, Einsatzzeiten, Zeitkonto, Urlaub, Korrekturen und Freigaben vollständig prüfen"
      />

      <View style={styles.payrollPreparation}>
        <View style={styles.payrollPreparationCopy}>
          <Text style={styles.payrollPreparationKicker}>MONATLICHE PRÜFKETTE</Text>
          <Text style={styles.payrollPreparationTitle}>Vom Einsatz bis zur Gehaltsstatistik</Text>
          <Text style={styles.payrollPreparationText}>
            Erst Einsatzzeiten und Abwesenheiten kontrollieren, offene Abweichungen bearbeiten,
            anschließend Zeitkonten prüfen und den freigegebenen Monat in der Gehaltsstatistik abschließen.
          </Text>
        </View>
        <View style={styles.payrollPreparationActions}>
          <PremiumButton title="Einsatzzeiten & Korrekturen" variant="secondary" onPress={() => router.push('/business/office/time-tracking/historie' as never)} />
          <PremiumButton title="Urlaub & Abwesenheiten" variant="secondary" onPress={() => router.push('/business/office/time-tracking/abwesenheiten' as never)} />
          <PremiumButton title="Offene Prüfungen" variant="secondary" onPress={() => router.push('/business/office/time-tracking/pruefqueue' as never)} />
          <PremiumButton title="Gehaltsstatistik öffnen" onPress={() => router.push('/business/office/payroll' as never)} />
        </View>
      </View>

      <WfmOfficeFilterBar
        periodSlot={
          <WfmOfficePeriodChips
            options={[
              { key: 'today', label: 'Heute' },
              { key: 'this_week', label: 'Diese Woche' },
              { key: 'this_month', label: 'Monat' },
            ]}
            value={periodPreset}
            onChange={setPeriodPreset}
          />
        }
        secondarySlot={
          <PremiumButton
            title="Alle Mitarbeitende"
            variant={!selectedEmployeeId ? 'secondary' : 'ghost'}
            onPress={() => setSelectedEmployeeId(null)}
          />
        }
      />

      <WfmOfficeCompactKpiStrip items={kpiItems} maxVisible={6} />

      <Text style={[styles.teamSummary, { color: text.secondary }]}>
        Heute erfasst: {kpis?.capturedToday ?? 0} · Aktive MA: {kpis?.activeCount ?? 0} · In Pause:{' '}
        {kpis?.onPauseCount ?? 0} · Im Einsatz: {kpis?.onVisitCount ?? 0} · Im Büro:{' '}
        {kpis?.inOfficeCount ?? 0} · Homeoffice: {kpis?.homeofficeCount ?? 0} · Offen zur Prüfung:{' '}
        {kpis?.pendingReviewCount ?? 0} · Offene Anträge: {kpis?.openRequestsCount ?? 0}
      </Text>

      {(kpis?.openRequestsCount ?? 0) > 0 && canApprove ? (
        <InfoBanner
          message={`${kpis?.openRequestsCount} offene Urlaubs- oder Abwesenheitsanträge — bitte im Tab „Abwesenheiten“ bearbeiten.`}
        />
      ) : null}

      <View style={styles.workArea}>
        <WfmOfficeSectionHeading title="Zeitkonten je Mitarbeitende" />
        {accountsQuery.loading && !accountsQuery.data ? (
          <LoadingState message="Zeitkonten werden geladen…" presentation="inline" />
        ) : null}
        {accountsQuery.error ? (
          <ErrorState title="Fehler" message={accountsQuery.error} onRetry={() => void accountsQuery.refresh()} />
        ) : null}
        {accounts.length === 0 && !accountsQuery.loading ? (
          <EmptyState title="Keine Zeitkonten" message="Im gewählten Zeitraum liegen keine Daten vor." />
        ) : (
          <PremiumDataTable
            columns={accountColumns}
            data={accounts}
            keyExtractor={(account) => account.employeeId}
            selectedId={selectedEmployeeId}
            onRowPress={(account) =>
              setSelectedEmployeeId((current) =>
                current === account.employeeId ? null : account.employeeId,
              )
            }
            emptyMessage="Keine Zeitkonten im Zeitraum."
          />
        )}
      </View>

      {selectedAccount && tenantId && reviewerId ? (
        <WfmEmployeeTimeAccountWorkspace
          account={selectedAccount}
          tenantId={tenantId}
          reviewerId={reviewerId}
          roleKey={roleKey}
          canCorrect={canCorrect}
          canManage={canManage}
          periodLabel={periodPreset === 'today' ? 'Heute' : periodPreset === 'this_week' ? 'Diese Woche' : 'Aktueller Monat'}
          onClose={() => setSelectedEmployeeId(null)}
        />
      ) : null}

      <View style={styles.collapsible}>
        <WfmOfficeSectionHeading title="ArbZG-Teamwarnungen" />
        {tenantId && reviewerId ? (
          <WfmRuleWarningsPanel tenantId={tenantId} userId={reviewerId} roleKey={roleKey} teamView compact />
        ) : null}
      </View>

      <View style={styles.collapsible}>
        <WfmOfficeSectionHeading title="Team heute" />
        {teamQuery.loading && !teamQuery.data ? <LoadingState message="Team wird geladen…" /> : null}
        {teamQuery.error ? (
          <ErrorState
            title="Arbeitszeitdaten konnten nicht geladen werden"
            message={teamQuery.error}
            onRetry={() => void teamQuery.refresh()}
          />
        ) : null}
        {teamRows.length === 0 && !teamQuery.loading && !teamQuery.error ? (
          <EmptyState
            title="Keine Erfassungen"
            message="Heute wurden noch keine Arbeitszeiten erfasst und keine Abwesenheiten gemeldet."
          />
        ) : (
          teamRows.map((row) => (
            <WfmTeamTodayEmployeeCard
              key={row.employeeId}
              row={row}
              selected={selectedEmployeeId === row.employeeId}
              onPress={() =>
                setSelectedEmployeeId((current) => (current === row.employeeId ? null : row.employeeId))
              }
            />
          ))
        )}
      </View>

      {selectedRow && overview?.workDate ? (
        <WfmTeamTodayDetailPanel row={selectedRow} workDate={overview.workDate} />
      ) : null}

      <PremiumButton
        title="Alles aktualisieren"
        variant="ghost"
        loading={teamQuery.refreshing || accountsQuery.refreshing}
        onPress={() => {
          void Promise.all([teamQuery.refresh(), accountsQuery.refresh()]);
        }}
      />
    </View>
  );
}

/** Legacy export — team.tsx redirects to zeitkonten. */
export function TimeTrackingTeamScreen() {
  return <WfmZeitkontenScreen />;
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', gap: careSpacing.md, paddingBottom: careSpacing.lg },
  payrollPreparation: {
    width: '100%',
    padding: careSpacing.md,
    borderWidth: 1,
    borderColor: '#99C6F4',
    borderRadius: 16,
    backgroundColor: '#EAF4FF',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: careSpacing.md,
  },
  payrollPreparationCopy: { flex: 1, minWidth: 280, gap: 3 },
  payrollPreparationKicker: { color: '#1567B8', fontSize: 10, lineHeight: 13, fontWeight: '900', letterSpacing: 0.9 },
  payrollPreparationTitle: { color: '#0B2342', fontSize: 19, lineHeight: 24, fontWeight: '900' },
  payrollPreparationText: { color: '#31597F', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  payrollPreparationActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: careSpacing.xs },
  teamSummary: { ...typography.caption, fontSize: 11, lineHeight: 16 },
  workArea: { width: '100%', gap: careSpacing.sm },
  detailBlock: {
    borderWidth: 1,
    borderRadius: 14,
    padding: careSpacing.md,
    gap: careSpacing.sm,
  },
  accountMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
  accountMetric: {
    ...typography.caption,
    minWidth: 150,
    paddingVertical: careSpacing.xs,
    paddingHorizontal: careSpacing.sm,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.64)',
  },
  statementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: careSpacing.sm,
    paddingVertical: careSpacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(20,120,255,0.12)',
  },
  collapsible: { gap: careSpacing.xs, marginTop: careSpacing.sm },
});
