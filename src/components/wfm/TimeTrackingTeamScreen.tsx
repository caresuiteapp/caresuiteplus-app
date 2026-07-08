import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumKpiCard,
  SectionPanel,
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
import { getWfmTeamTodayOverview } from '@/lib/wfm/wfmTeamTodayService';
import { subscribeToWfmLiveChanges } from '@/lib/realtime/presets';
import { WfmRuleWarningsPanel } from '@/components/wfm/WfmRuleWarningsPanel';
import { WfmTeamTodayDetailPanel } from '@/components/wfm/WfmTeamTodayDetailPanel';
import { WfmTeamTodayEmployeeCard } from '@/components/wfm/WfmTeamTodayEmployeeCard';
import { formatWfmDurationMinutes } from '@/lib/wfm/wfmDisplayHelpers';
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

  if (!canView) {
    return (
      <ScreenShell title="Zeitkonten" showBack={false}>
        <LockedActionBanner
          message={check('time.tracking.team.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  const overview = teamQuery.data;
  const kpis = overview?.kpis;
  const teamRows = overview?.rows ?? [];
  const accounts = accountsQuery.data ?? [];
  const accountKpis = summarizeOfficeTimeAccountKpis(accounts);
  const selectedAccount = accounts.find((a) => a.employeeId === selectedEmployeeId) ?? null;
  const selectedRow = teamRows.find((r) => r.employeeId === selectedEmployeeId) ?? null;

  return (
    <ScreenShell title="Zeitkonten" subtitle="Plan · Ist · Freigegeben · Export · Saldo" showBack={false} scroll>
      <View style={styles.filterRow}>
        {(['today', 'this_week', 'this_month'] as const).map((preset) => (
          <PremiumButton
            key={preset}
            title={preset === 'today' ? 'Heute' : preset === 'this_week' ? 'Diese Woche' : 'Monat'}
            variant={periodPreset === preset ? 'secondary' : 'ghost'}
            onPress={() => setPeriodPreset(preset)}
          />
        ))}
        <PremiumButton
          title="Alle Mitarbeitende"
          variant={!selectedEmployeeId ? 'secondary' : 'ghost'}
          onPress={() => setSelectedEmployeeId(null)}
        />
      </View>

      <View style={styles.kpiRow}>
        <PremiumKpiCard label="Mitarbeitende" value={String(accountKpis.employees)} accentColor={accent} />
        <PremiumKpiCard label="Plan (Std.)" value={String(accountKpis.plannedHours)} accentColor={accent} />
        <PremiumKpiCard label="Ist (Std.)" value={String(accountKpis.actualHours)} accentColor={accent} />
        <PremiumKpiCard label="Freigegeben" value={String(accountKpis.approvedHours)} accentColor={accent} />
        <PremiumKpiCard label="Exportiert" value={String(accountKpis.exportedHours)} accentColor={accent} />
        <PremiumKpiCard label="Offene Prüfungen" value={String(accountKpis.openReviews)} accentColor={accent} />
      </View>

      <Text style={[styles.summary, { color: text.secondary }]}>
        Heute erfasst: {kpis?.capturedToday ?? 0} · Aktive Mitarbeitende: {kpis?.activeCount ?? 0} · In Pause:{' '}
        {kpis?.onPauseCount ?? 0} · Im Einsatz: {kpis?.onVisitCount ?? 0}
      </Text>

      {(kpis?.openRequestsCount ?? 0) > 0 && canApprove ? (
        <InfoBanner
          message={`${kpis?.openRequestsCount} offene Urlaubs- oder Abwesenheitsanträge — bitte im Tab „Abwesenheiten“ bearbeiten.`}
        />
      ) : null}

      <SectionPanel title="Zeitkonten je Mitarbeitende">
        {accountsQuery.loading && !accountsQuery.data ? <LoadingState message="Zeitkonten werden geladen…" /> : null}
        {accountsQuery.error ? (
          <ErrorState title="Fehler" message={accountsQuery.error} onRetry={() => void accountsQuery.refresh()} />
        ) : null}
        {accounts.length === 0 ? (
          <EmptyState title="Keine Zeitkonten" message="Im gewählten Zeitraum liegen keine Daten vor." />
        ) : (
          accounts.map((account) => (
            <View
              key={account.employeeId}
              style={[styles.accountRow, { borderColor: text.border }]}
            >
              <Text style={{ color: text.primary, ...typography.bodyMedium }}>{account.employeeName}</Text>
              <Text style={{ color: text.secondary, ...typography.caption }}>
                Plan {formatWfmDurationMinutes(account.plannedMinutes)} · Ist{' '}
                {formatWfmDurationMinutes(account.actualMinutes)} · Freigegeben{' '}
                {formatWfmDurationMinutes(account.approvedMinutes)} · Export{' '}
                {formatWfmDurationMinutes(account.exportedMinutes)} · Saldo{' '}
                {formatWfmDurationMinutes(account.saldoMinutes)}
              </Text>
              {account.openReviewCount > 0 ? (
                <PremiumBadge label={`${account.openReviewCount} offen`} variant="orange" />
              ) : null}
              <View style={styles.actionRow}>
                <PremiumButton
                  title={selectedEmployeeId === account.employeeId ? 'Schließen' : 'Details'}
                  variant="ghost"
                  onPress={() =>
                    setSelectedEmployeeId((current) =>
                      current === account.employeeId ? null : account.employeeId,
                    )
                  }
                />
                {account.openReviewCount > 0 ? (
                  <PremiumButton
                    title="Offene Prüfungen"
                    variant="secondary"
                    onPress={() => router.push('/business/office/time-tracking/pruefqueue' as never)}
                  />
                ) : null}
              </View>
            </View>
          ))
        )}
      </SectionPanel>

      {selectedAccount ? (
        <SectionPanel title={`Tages-/Wochenliste — ${selectedAccount.employeeName}`}>
          {selectedAccount.entries.slice(0, 14).map((entry) => (
            <Text key={entry.id} style={{ color: text.secondary, ...typography.caption }}>
              {entry.workDate} · {entry.clientLabel ?? entry.assignmentTitle ?? '—'} ·{' '}
              {entry.reviewStatus}
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
        </SectionPanel>
      ) : null}

      <SectionPanel title="ArbZG-Teamwarnungen">
        {tenantId && reviewerId ? (
          <WfmRuleWarningsPanel tenantId={tenantId} userId={reviewerId} roleKey={roleKey} teamView compact />
        ) : null}
      </SectionPanel>

      <SectionPanel title="Team heute">
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
      </SectionPanel>

      {selectedRow && overview?.workDate ? (
        <WfmTeamTodayDetailPanel row={selectedRow} workDate={overview.workDate} />
      ) : null}

      <PremiumButton title="Aktualisieren" variant="ghost" onPress={() => void teamQuery.refresh()} />
    </ScreenShell>
  );
}

/** Legacy export — team.tsx redirects to zeitkonten. */
export function TimeTrackingTeamScreen() {
  return <WfmZeitkontenScreen />;
}

const styles = StyleSheet.create({
  summary: { ...typography.caption, marginBottom: careSpacing.md, lineHeight: 18 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.xs, marginBottom: careSpacing.md },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm, marginBottom: careSpacing.md },
  accountRow: { borderWidth: 1, borderRadius: 10, padding: careSpacing.md, gap: careSpacing.xs, marginBottom: careSpacing.sm },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.xs },
});
