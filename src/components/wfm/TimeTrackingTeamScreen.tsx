import { useCallback, useEffect, useMemo, useState } from 'react';
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
    { enabled: !!tenantId && canView },
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
    { enabled: !!tenantId && canView },
  );

  useEffect(() => {
    if (!tenantId || !canView) return;
    return subscribeToWfmLiveChanges(tenantId, () => {
      void teamQuery.refresh();
      void accountsQuery.refresh();
    });
  }, [tenantId, canView, teamQuery, accountsQuery]);

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
      key: 'plan',
      label: 'Plan',
      width: 72,
      render: (account) => (
        <Text style={{ color: text.secondary, ...typography.caption }}>
          {formatWfmDurationMinutes(account.plannedMinutes)}
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
      key: 'approved',
      label: 'Genehmigt',
      width: 88,
      render: (account) => (
        <Text style={{ color: text.secondary, ...typography.caption }}>
          {formatWfmDurationMinutes(account.approvedMinutes)}
        </Text>
      ),
    },
    {
      key: 'exported',
      label: 'Exportiert',
      width: 88,
      render: (account) => (
        <Text style={{ color: text.secondary, ...typography.caption }}>
          {formatWfmDurationMinutes(account.exportedMinutes)}
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
          <Text style={{ color: text.primary, ...typography.bodyMedium }}>
            Tagesliste — {selectedAccount.employeeName}
          </Text>
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

      <PremiumButton title="Aktualisieren" variant="ghost" onPress={() => void teamQuery.refresh()} />
    </View>
  );
}

/** Legacy export — team.tsx redirects to zeitkonten. */
export function TimeTrackingTeamScreen() {
  return <WfmZeitkontenScreen />;
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: careSpacing.sm, paddingBottom: careSpacing.lg },
  teamSummary: { ...typography.caption, fontSize: 11, lineHeight: 16 },
  workArea: { gap: careSpacing.xs },
  detailBlock: {
    borderWidth: 1,
    borderRadius: 8,
    padding: careSpacing.sm,
    gap: careSpacing.xs,
  },
  collapsible: { gap: careSpacing.xs, marginTop: careSpacing.sm },
});
