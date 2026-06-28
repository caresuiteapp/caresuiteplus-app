import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  SectionPanel,
} from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { listEmployeeVisitTimes } from '@/lib/wfm';
import { typography } from '@/theme';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')} Min.`;
}

export function EmployeePortalTimesScreen() {
  const { profile, user } = useAuth();
  const tenantId = useServiceTenantId();
  const userId = user?.id ?? profile?.id ?? '';
  const employeeId = profile?.employeeId ?? null;
  const roleKey = profile?.roleKey ?? null;
  const { can, check, roleLabel } = usePermissions();
  const text = useAuroraAdaptiveText();

  const canView = can('time.tracking.own.view');

  const query = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId || !canView || !userId) {
        return { ok: true as const, data: { visitTimes: [], drivingLogs: [] } };
      }
      return listEmployeeVisitTimes(tenantId, userId, roleKey, { employeeId, days: 14 });
    }, [tenantId, userId, roleKey, canView, employeeId]),
    [tenantId, userId, roleKey, canView, employeeId],
    { enabled: !!tenantId && !!userId && canView },
  );

  if (!canView) {
    return (
      <ScreenShell title="Fahrten & Zeiten" subtitle="Einsatzzeiten der letzten 14 Tage">
        <LockedActionBanner
          message={check('time.tracking.own.view').reason ?? 'Keine Berechtigung.'}
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

  const visitTimes = query.data?.visitTimes ?? [];
  const drivingLogs = query.data?.drivingLogs ?? [];

  return (
    <ScreenShell title="Fahrten & Zeiten" subtitle="Einsatzzeiten der letzten 14 Tage" scroll>
      <SectionPanel title="Einsatz-Zeitstempel" subtitle="Aus der Einsatz-Durchführung synchronisiert">
        {visitTimes.length === 0 ? (
          <EmptyState
            title="Keine Einsatzzeiten"
            message="Zeitstempel erscheinen hier, sobald Sie Einsätze in der Durchführung starten."
          />
        ) : (
          visitTimes.map((row) => (
            <View key={row.id} style={styles.row}>
              <View style={styles.rowHeader}>
                <Text style={[styles.rowTitle, { color: text.primary }]}>{row.assignmentLabel}</Text>
                <PremiumBadge label={row.eventLabel} variant="cyan" />
              </View>
              <Text style={[styles.rowMeta, { color: text.secondary }]}>
                {formatDateTime(row.occurredAt)}
                {row.durationSeconds != null ? ` · Dauer ${formatDuration(row.durationSeconds)}` : ''}
              </Text>
            </View>
          ))
        )}
      </SectionPanel>

      <SectionPanel title="Fahrtenbuch" subtitle="An- und Abfahrten zu Einsätzen">
        {drivingLogs.length === 0 ? (
          <Text style={{ color: text.secondary }}>Keine Fahrten im gewählten Zeitraum.</Text>
        ) : (
          drivingLogs.map((log) => (
            <View key={log.id} style={styles.row}>
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
            </View>
          ))
        )}
      </SectionPanel>

      <PremiumButton title="Aktualisieren" variant="ghost" onPress={() => void query.refresh()} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: careSpacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.08)' },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: careSpacing.sm },
  rowTitle: { ...typography.body, fontWeight: '600', flex: 1 },
  rowMeta: { ...typography.caption, marginTop: 2 },
});
