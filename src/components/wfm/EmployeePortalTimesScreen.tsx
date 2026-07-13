import { useCallback } from 'react';
import { StyleSheet, Text } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  SectionPanel,
  PremiumCard,
} from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAuth } from '@/lib/auth/context';
import { listEmployeeVisitTimes, PORTAL_EMPLOYEE_TIMES_LOOKBACK_DAYS } from '@/lib/wfm';
import { typography } from '@/theme';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function EmployeePortalTimesScreen() {
  const { profile, user } = useAuth();
  const { employeeId: portalEmployeeId } = usePortalActor();
  const tenantId = useServiceTenantId();
  const userId = user?.id ?? profile?.id ?? '';
  const employeeId = portalEmployeeId ?? profile?.employeeId ?? null;
  const roleKey = profile?.roleKey ?? null;
  const { can, check, roleLabel } = usePermissions();
  const text = useAuroraAdaptiveText();

  const canView = can('time.tracking.own.view');

  const query = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId || !canView || !userId) {
        return {
          ok: true as const,
          data: { visitTimes: [], visitSummaries: [], drivingLogs: [] },
        };
      }
      return listEmployeeVisitTimes(tenantId, userId, roleKey, {
        employeeId,
        days: PORTAL_EMPLOYEE_TIMES_LOOKBACK_DAYS,
      });
    }, [tenantId, userId, roleKey, canView, employeeId]),
    [tenantId, userId, roleKey, canView, employeeId],
    { enabled: !!tenantId && !!userId && canView },
  );

  if (!canView) {
    return (
      <ScreenShell title="Fahrten & Zeiten" subtitle={`Einsatzzeiten der letzten ${PORTAL_EMPLOYEE_TIMES_LOOKBACK_DAYS} Tage`}>
        <LockedActionBanner
          message={
            check('time.tracking.own.view').reason ??
            'Sie haben keine Berechtigung, diese Arbeitszeiten zu öffnen.'
          }
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="Fahrten & Zeiten" subtitle="Wird geladen…">
        <LoadingState message="Einsatzzeiten werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Fahrten & Zeiten" subtitle="Einsatzzeiten">
        <ErrorState title="Fehler" message={query.error} onRetry={() => void query.refresh()} />
      </ScreenShell>
    );
  }

  const visitSummaries = query.data?.visitSummaries ?? [];
  const drivingLogs = query.data?.drivingLogs ?? [];

  return (
    <ScreenShell
      title="Fahrten & Zeiten"
      subtitle={`Einsatzzeiten der letzten ${PORTAL_EMPLOYEE_TIMES_LOOKBACK_DAYS} Tage`}
      scroll
    >
      <SectionPanel
        title="Meine Arbeitszeiten"
        subtitle={`Einsätze der letzten ${PORTAL_EMPLOYEE_TIMES_LOOKBACK_DAYS} Tage`}
      >
        {visitSummaries.length === 0 ? (
          <EmptyState
            title="Keine Einsatzzeiten"
            message="Für den ausgewählten Zeitraum sind noch keine Zeiten erfasst."
          />
        ) : (
          visitSummaries.map((row) => (
            <PremiumCard key={row.visitId} style={styles.row}>
              <Text style={[styles.rowTitle, { color: text.primary }]}>
                {row.clientName ? `${row.title} · ${row.clientName}` : row.title}
              </Text>
              <Text style={[styles.rowMeta, { color: text.secondary }]}>{row.dateLabel}</Text>
              {row.plannedRange ? (
                <Text style={[styles.rowMeta, { color: text.muted }]}>
                  Geplant: {row.plannedRange}
                </Text>
              ) : null}
              <Text style={[styles.timeline, { color: text.secondary }]}>{row.timelineText}</Text>
            </PremiumCard>
          ))
        )}
      </SectionPanel>

      <SectionPanel title="Meine Fahrten" subtitle="An- und Abfahrten zu Einsätzen">
        {drivingLogs.length === 0 ? (
          <Text style={{ color: text.secondary }}>Keine Fahrten im gewählten Zeitraum.</Text>
        ) : (
          drivingLogs.map((log) => (
            <PremiumCard key={log.id} style={styles.row}>
              <Text style={[styles.rowTitle, { color: text.primary }]}>
                {log.purpose ?? 'Fahrt'}
              </Text>
              <Text style={[styles.rowMeta, { color: text.secondary }]}>
                {log.startAddress ?? '—'} → {log.endAddress ?? '—'}
              </Text>
              <Text style={[styles.rowMeta, { color: text.secondary }]}>
                {log.startedAt ? formatDateTime(log.startedAt) : '—'}
                {log.distanceKm != null ? ` · ${log.distanceKm.toFixed(1)} km` : ''}
              </Text>
            </PremiumCard>
          ))
        )}
      </SectionPanel>

      <PremiumButton title="Aktualisieren" variant="ghost" onPress={() => void query.refresh()} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  row: {
    padding: careSpacing.md, borderRadius: 18, gap: 4, marginBottom: careSpacing.sm,
  },
  rowTitle: { ...typography.body, fontWeight: '600' },
  rowMeta: { ...typography.caption },
  timeline: { ...typography.body, marginTop: careSpacing.xs, lineHeight: 20 },
});
