import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
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
import { getWfmTeamTodayOverview } from '@/lib/wfm/wfmTeamTodayService';
import { subscribeToWfmLiveChanges } from '@/lib/realtime/presets';
import { WfmRuleWarningsPanel } from '@/components/wfm/WfmRuleWarningsPanel';
import { WfmTeamTodayDetailPanel } from '@/components/wfm/WfmTeamTodayDetailPanel';
import { WfmTeamTodayEmployeeCard } from '@/components/wfm/WfmTeamTodayEmployeeCard';
import { typography } from '@/theme';

export function TimeTrackingTeamScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { user, profile } = useAuth();
  const reviewerId = user?.id ?? profile?.id ?? '';
  const { can, check, roleLabel, roleKey } = usePermissions();
  const text = useAuroraAdaptiveText();
  const accent = moduleColor('office');
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
      <ScreenShell title="Team-Arbeitszeit">
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
    <ScreenShell title="Team-Arbeitszeit" subtitle="Übersicht aller Mitarbeitenden heute" scroll>
      <View style={styles.kpiRow}>
        <PremiumKpiCard label="Heute erfasst" value={String(kpis?.capturedToday ?? 0)} accentColor={accent} />
        <PremiumKpiCard label="Aktive MA" value={String(kpis?.activeCount ?? 0)} accentColor={accent} />
        <PremiumKpiCard label="In Pause" value={String(kpis?.onPauseCount ?? 0)} accentColor={accent} />
        <PremiumKpiCard label="Im Einsatz" value={String(kpis?.onVisitCount ?? 0)} accentColor={accent} />
        <PremiumKpiCard label="Im Büro" value={String(kpis?.inOfficeCount ?? 0)} accentColor={accent} />
        <PremiumKpiCard label="Homeoffice" value={String(kpis?.homeofficeCount ?? 0)} accentColor={accent} />
        <PremiumKpiCard
          label="Offen zur Prüfung"
          value={String(kpis?.pendingReviewCount ?? 0)}
          accentColor={accent}
        />
        <PremiumKpiCard
          label="Offene Anträge"
          value={String(kpis?.openRequestsCount ?? 0)}
          accentColor={accent}
        />
      </View>

      <View style={styles.nav}>
        <PremiumButton
          title="Live-Mitarbeiter"
          variant="secondary"
          onPress={() => router.push('/business/office/time-tracking/live' as never)}
        />
        <PremiumButton
          title="Export"
          variant="ghost"
          onPress={() => router.push('/business/office/time-tracking/export' as never)}
        />
        <PremiumButton
          title="Mitarbeitenden Anträge"
          variant="secondary"
          onPress={() => router.push('/business/office/time-tracking/requests' as never)}
        />
        <PremiumButton
          title="Eigene Erfassung"
          variant="ghost"
          onPress={() => router.push('/business/office/time-tracking' as never)}
        />
      </View>

      {(kpis?.openRequestsCount ?? 0) > 0 && canApprove ? (
        <InfoBanner
          message={`${kpis?.openRequestsCount} offene Urlaubs- oder Abwesenheitsanträge — bitte unter „Mitarbeitenden Anträge“ bearbeiten.`}
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

      <SectionPanel title="Hinweise">
        <Text style={{ color: text.secondary, ...typography.caption }}>
          Export (CSV/PDF/DATEV) ist über den Export-Tab verfügbar. Manuelle Office-Zeitbuchungen
          erfolgen über „Eigene Erfassung“ (Stempeln wie im Portal).
        </Text>
      </SectionPanel>

      <PremiumButton title="Aktualisieren" variant="ghost" onPress={() => void teamQuery.refresh()} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
    marginBottom: careSpacing.md,
  },
  nav: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
    marginBottom: careSpacing.md,
  },
});
