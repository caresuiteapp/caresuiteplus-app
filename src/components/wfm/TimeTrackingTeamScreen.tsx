import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
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
import {
  getWfmLiveEmployeeOverview,
  reviewWfmAbsenceRequest,
} from '@/lib/wfm';
import { WfmRuleWarningsPanel } from '@/components/wfm/WfmRuleWarningsPanel';
import { WFM_APPROVAL_TYPE_LABELS } from '@/types/modules/wfm';
import { typography } from '@/theme';

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function TimeTrackingTeamScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { user, profile } = useAuth();
  const reviewerId = user?.id ?? profile?.id ?? '';
  const { can, check, roleLabel, roleKey } = usePermissions();
  const text = useAuroraAdaptiveText();
  const accent = moduleColor('office');
  const [actionError, setActionError] = useState<string | null>(null);

  const canView = can('time.tracking.team.view');
  const canApprove = can('office.employees.absences.approve');

  const teamQuery = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId || !canView) {
        return { ok: true as const, data: { rows: [], onlineCount: 0, totalCount: 0 } };
      }
      return getWfmLiveEmployeeOverview(tenantId, roleKey);
    }, [tenantId, canView, roleKey]),
    [tenantId, canView, roleKey],
  );

  const approvalsQuery = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId || !canApprove) return { ok: true as const, data: [] };
      const { listPendingWfmApprovals } = await import('@/lib/wfm');
      return listPendingWfmApprovals(tenantId, roleKey);
    }, [tenantId, canApprove, roleKey]),
    [tenantId, canApprove, roleKey],
  );

  const handleApproval = async (approvalId: string, decision: 'approved' | 'rejected') => {
    if (!tenantId) return;
    setActionError(null);
    const result = await reviewWfmAbsenceRequest(
      tenantId,
      reviewerId,
      roleKey,
      approvalId,
      decision,
      decision === 'rejected' ? { rejectionReason: 'Schnellentscheidung ohne Detailansicht' } : undefined,
    );
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    await approvalsQuery.refresh();
  };

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

  const teamRows = teamQuery.data?.rows ?? [];
  const online = teamQuery.data?.onlineCount ?? 0;

  return (
    <ScreenShell title="Team-Arbeitszeit" subtitle="Übersicht aller Mitarbeitenden heute" scroll>
      <View style={styles.kpiRow}>
        <PremiumKpiCard label="Erfasst" value={String(teamQuery.data?.totalCount ?? 0)} accentColor={accent} />
        <PremiumKpiCard label="Aktiv" value={String(online)} accentColor={accent} />
        <PremiumKpiCard label="Offene Anträge" value={String(approvalsQuery.data?.length ?? 0)} accentColor={accent} />
      </View>

      <View style={styles.nav}>
        <PremiumButton title="Live-Mitarbeiter" variant="secondary" onPress={() => router.push('/business/office/time-tracking/live' as never)} />
        <PremiumButton title="Export" variant="ghost" onPress={() => router.push('/business/office/time-tracking/export' as never)} />
        <PremiumButton title="Mitarbeitenden Anträge" variant="secondary" onPress={() => router.push('/business/office/time-tracking/requests' as never)} />
        <PremiumButton title="Eigene Erfassung" variant="ghost" onPress={() => router.push('/business/office/time-tracking' as never)} />
      </View>

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
        {teamQuery.loading ? <LoadingState message="Team wird geladen…" /> : null}
        {teamRows.length === 0 ? (
          <EmptyState title="Keine Erfassungen" message="Heute wurden noch keine Arbeitszeiten erfasst." />
        ) : (
          teamRows.map((row) => (
            <View key={row.employeeId} style={styles.row}>
              <Text style={[styles.rowTitle, { color: text.primary }]}>
                {row.employeeName}
              </Text>
              <PremiumBadge
                label={row.statusLabel}
                variant={row.session?.isOnline ? 'green' : 'muted'}
              />
              <Text style={{ color: text.secondary, ...typography.caption }}>
                {formatTime(row.lastEventAt)}
                {row.session?.netMinutes || row.session?.grossMinutes
                  ? ` · ${row.session.netMinutes || row.session.grossMinutes} Min.`
                  : ''}
              </Text>
            </View>
          ))
        )}
      </SectionPanel>

      {canApprove ? (
        <SectionPanel title="Genehmigungen">
          {(approvalsQuery.data ?? []).length === 0 ? (
            <Text style={{ color: text.secondary }}>Keine offenen Anträge.</Text>
          ) : (
            (approvalsQuery.data ?? []).map((approval) => (
              <View key={approval.id} style={styles.row}>
                <Text style={[styles.rowTitle, { color: text.primary }]}>
                  {WFM_APPROVAL_TYPE_LABELS[approval.approvalType]}
                </Text>
                <View style={styles.approvalActions}>
                  <PremiumButton title="Genehmigen" onPress={() => void handleApproval(approval.id, 'approved')} />
                  <PremiumButton title="Ablehnen" variant="secondary" onPress={() => void handleApproval(approval.id, 'rejected')} />
                </View>
              </View>
            ))
          )}
        </SectionPanel>
      ) : null}

      {actionError ? <ErrorState title="Fehler" message={actionError} onRetry={() => setActionError(null)} /> : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm, marginBottom: careSpacing.md },
  nav: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm, marginBottom: careSpacing.md },
  row: { paddingVertical: careSpacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.08)' },
  rowTitle: { ...typography.body, fontWeight: '600' },
  approvalActions: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm, marginTop: careSpacing.xs },
});
