import { useCallback, useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumDataTable,
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
  listOpenReviewEntriesForEmployee,
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
import { getPayrollPdfUrl } from '@/lib/payroll';

function formatDays(days: number | null): string {
  if (days == null) return '—';
  return `${days.toLocaleString('de-DE', { maximumFractionDigits: 1 })} T.`;
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

  const canView = can('time.tracking.team.view');
  const canApprove = can('office.employees.absences.approve');

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

  const accountColumns = useMemo((): DataTableColumn<WfmOfficeEmployeeTimeAccount>[] => [
    {
      key: 'employee',
      label: 'Mitarbeitende',
      flex: 1.2,
      minWidth: 120,
      render: (account) => (
        <Text style={{ color: text.primary, ...typography.caption }}>{account.employeeName}</Text>
      ),
    },
    {
      key: 'target',
      label: 'Soll',
      width: 72,
      render: (account) => (
        <Text style={{ color: text.secondary, ...typography.caption }}>
          {formatWfmDurationMinutes(account.targetMinutes || account.plannedMinutes)}
        </Text>
      ),
    },
    {
      key: 'ist',
      label: 'Ist',
      width: 72,
      render: (account) => (
        <Text style={{ color: text.secondary, ...typography.caption }}>
          {formatWfmDurationMinutes(account.actualMinutes)}
        </Text>
      ),
    },
    {
      key: 'travel',
      label: 'Fahrzeit',
      width: 88,
      render: (account) => (
        <Text style={{ color: text.secondary, ...typography.caption }}>
          {formatWfmDurationMinutes(account.travelMinutes)}
        </Text>
      ),
    },
    {
      key: 'absence',
      label: 'Abwesend',
      width: 88,
      render: (account) => (
        <Text style={{ color: text.secondary, ...typography.caption }}>
          {formatWfmDurationMinutes(account.absenceMinutes)}
        </Text>
      ),
    },
    {
      key: 'vacation',
      label: 'Resturlaub',
      width: 88,
      render: (account) => (
        <Text style={{ color: text.secondary, ...typography.caption }}>
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
          <Text style={{ color: text.muted, ...typography.caption }}>0</Text>
        )
      ),
    },
    {
      key: 'saldo',
      label: 'Saldo',
      width: 72,
      render: (account) => (
        <Text style={{ color: text.primary, ...typography.caption, fontWeight: '600' }}>
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
    { key: 'plan', label: 'Plan (Std.)', value: String(accountKpis.plannedHours) },
    { key: 'ist', label: 'Ist (Std.)', value: String(accountKpis.actualHours) },
    { key: 'approved', label: 'Genehmigt', value: String(accountKpis.approvedHours) },
    { key: 'exported', label: 'Exportiert', value: String(accountKpis.exportedHours) },
    { key: 'open', label: 'Offene Prüfungen', value: String(accountKpis.openReviews) },
  ];

  const openPayrollPdf = async (path: string | null) => {
    if (!path) return;
    const result = await getPayrollPdfUrl(path);
    if (result.ok) await Linking.openURL(result.data);
  };

  return (
    <View style={styles.root} testID="wfm-zeitkonten-screen">
      <WfmOfficeSectionHeading
        title="Zeitkonten"
        subtitle="Plan · Ist · Genehmigt · Export · Saldo je Mitarbeitende"
      />

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
          <LoadingState message="Zeitkonten werden geladen…" />
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

      {selectedAccount ? (
        <View style={[styles.detailBlock, { borderColor: text.border }]}>
          <Text style={{ color: text.primary, ...typography.body, fontWeight: '700' }}>
            Zeitkonto — {selectedAccount.employeeName}
          </Text>
          <View style={styles.accountMetrics}>
            <Text style={[styles.accountMetric, { color: text.secondary }]}>
              Soll <Text style={{ color: text.primary }}>{formatWfmDurationMinutes(selectedAccount.targetMinutes || selectedAccount.plannedMinutes)}</Text>
            </Text>
            <Text style={[styles.accountMetric, { color: text.secondary }]}>
              Ist <Text style={{ color: text.primary }}>{formatWfmDurationMinutes(selectedAccount.actualMinutes)}</Text>
            </Text>
            <Text style={[styles.accountMetric, { color: text.secondary }]}>
              Überstunden <Text style={{ color: text.primary }}>{formatWfmDurationMinutes(selectedAccount.overtimeMinutes)}</Text>
            </Text>
            <Text style={[styles.accountMetric, { color: text.secondary }]}>
              Minderstunden <Text style={{ color: text.primary }}>{formatWfmDurationMinutes(selectedAccount.undertimeMinutes)}</Text>
            </Text>
            <Text style={[styles.accountMetric, { color: text.secondary }]}>
              Urlaub <Text style={{ color: text.primary }}>{formatDays(selectedAccount.vacationDaysUsed)} / {formatDays(selectedAccount.annualVacationDays)}</Text>
            </Text>
            <Text style={[styles.accountMetric, { color: text.secondary }]}>
              Resturlaub <Text style={{ color: text.primary }}>{formatDays(selectedAccount.remainingVacationDays)}</Text>
            </Text>
            <Text style={[styles.accountMetric, { color: text.secondary }]}>
              Krankheit <Text style={{ color: text.primary }}>{formatDays(selectedAccount.sickDays)}</Text>
            </Text>
            <Text style={[styles.accountMetric, { color: text.secondary }]}>
              Fahrzeit <Text style={{ color: text.primary }}>{formatWfmDurationMinutes(selectedAccount.travelMinutes)}</Text>
            </Text>
          </View>
          <Text style={{ color: text.primary, ...typography.body, fontWeight: '700' }}>Zeitbuchungen</Text>
          {selectedAccount.entries.slice(0, 14).map((entry) => (
            <Text key={entry.id} style={{ color: text.secondary, ...typography.caption }}>
              {entry.workDate} · {entry.clientLabel ?? entry.assignmentTitle ?? '—'} · {entry.reviewStatus}
              {entry.flags.includes('missing_booking') ? ' · Fehlende Buchung' : ''}
            </Text>
          ))}
          {listOpenReviewEntriesForEmployee(selectedAccount).length > 0 ? (
            <PremiumButton
              title="Zur Prüfung öffnen"
              variant="secondary"
              onPress={() => router.push('/business/office/time-tracking/pruefqueue' as never)}
            />
          ) : null}
          <Text style={{ color: text.primary, ...typography.body, fontWeight: '700' }}>
            Gehaltsstatistiken & PDF-Archiv
          </Text>
          {selectedAccount.payrollStatements.length === 0 ? (
            <Text style={{ color: text.muted, ...typography.caption }}>
              Noch keine Gehaltsstatistik für diesen Mitarbeitenden gespeichert.
            </Text>
          ) : (
            selectedAccount.payrollStatements.map((statement) => (
              <View key={statement.id} style={styles.statementRow}>
                <Text style={{ color: text.secondary, ...typography.caption }}>
                  {String(statement.periodMonth).padStart(2, '0')}/{statement.periodYear} · Version {statement.version} · {statement.status}
                </Text>
                <PremiumButton
                  title={statement.pdfPath ? 'PDF öffnen' : 'PDF fehlt'}
                  size="sm"
                  variant="ghost"
                  disabled={!statement.pdfPath}
                  onPress={() => void openPayrollPdf(statement.pdfPath)}
                />
              </View>
            ))
          )}
        </View>
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
        {teamRows.length === 0 ? (
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
