import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumButton,
  SectionPanel,
} from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { getWfmTeamTodayOverview } from '@/lib/wfm/wfmTeamTodayService';
import { subscribeToWfmLiveChanges } from '@/lib/realtime/presets';
import { WfmRuleWarningsPanel } from '@/components/wfm/WfmRuleWarningsPanel';
import { WfmTeamTodayDetailPanel } from '@/components/wfm/WfmTeamTodayDetailPanel';
import { WfmTeamTodayEmployeeCard } from '@/components/wfm/WfmTeamTodayEmployeeCard';
import { typography } from '@/theme';

export function WfmZeitkontenScreen() {
  const tenantId = useServiceTenantId();
  const { user, profile } = useAuth();
  const reviewerId = user?.id ?? profile?.id ?? '';
  const { can, check, roleLabel, roleKey } = usePermissions();
  const text = useAuroraAdaptiveText();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!tenantId || !canView) return;
    return subscribeToWfmLiveChanges(tenantId, () => {
      void teamQuery.refresh();
    });
  }, [tenantId, canView, teamQuery]);

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
  const selectedRow = teamRows.find((r) => r.employeeId === selectedEmployeeId) ?? null;

  return (
    <ScreenShell title="Zeitkonten" subtitle="Team-Übersicht heute" showBack={false} scroll>
      <Text style={[styles.summary, { color: text.secondary }]}>
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

      <SectionPanel title="ArbZG-Teamwarnungen">
        {tenantId && reviewerId ? (
          <WfmRuleWarningsPanel
            tenantId={tenantId}
            userId={reviewerId}
            roleKey={roleKey}
            teamView
            compact
          />
        ) : null}
      </SectionPanel>

      <SectionPanel title="Team heute">
        {teamQuery.loading && !teamQuery.data ? (
          <LoadingState message="Team wird geladen…" />
        ) : null}
        {teamQuery.error ? (
          <ErrorState title="Fehler" message={teamQuery.error} onRetry={() => void teamQuery.refresh()} />
        ) : null}
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
                setSelectedEmployeeId((current) =>
                  current === row.employeeId ? null : row.employeeId,
                )
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
  summary: {
    ...typography.caption,
    marginBottom: careSpacing.md,
    lineHeight: 18,
  },
});
