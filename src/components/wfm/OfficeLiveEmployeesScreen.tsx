import { useCallback, useEffect } from 'react';
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
  SectionPanel,
} from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { subscribeToWfmLiveChanges } from '@/lib/realtime/presets';
import { getOfficeLiveEmployees } from '@/features/liveTracking/getOfficeLiveEmployees';
import { typography } from '@/theme';

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function OfficeLiveEmployeesScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { can, check, roleLabel, roleKey } = usePermissions();
  const text = useAuroraAdaptiveText();

  const canView = can('time.tracking.team.view');

  const query = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId || !canView) {
        return { ok: true as const, data: { rows: [], onlineCount: 0, totalCount: 0 } };
      }
      return getOfficeLiveEmployees(tenantId, roleKey);
    }, [tenantId, canView, roleKey]),
    [tenantId, canView, roleKey],
    { enabled: !!tenantId && canView },
  );

  useEffect(() => {
    if (!tenantId || !canView) return;
    return subscribeToWfmLiveChanges(tenantId, () => {
      void query.refresh();
    });
  }, [tenantId, canView, query]);

  if (!canView) {
    return (
      <ScreenShell title="Live-Mitarbeiter" subtitle="Anwesenheit in Echtzeit">
        <LockedActionBanner
          message={check('time.tracking.team.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  const overview = query.data;
  const rows = overview?.rows ?? [];

  return (
    <ScreenShell title="Live-Mitarbeiter" subtitle="Anwesenheit in Echtzeit" showBack={false} scroll>
      <Text style={[styles.summary, { color: text.secondary }]}>
        Online: {overview?.onlineCount ?? 0} · Erfasst heute: {overview?.totalCount ?? 0}
      </Text>

      <View style={styles.actions}>
        <PremiumButton
          title="Live-Karte"
          variant="secondary"
          onPress={() => router.push('/business/office/time-tracking/live-map' as never)}
        />
      </View>

      {query.loading && !query.data ? <LoadingState message="Live-Status wird geladen…" /> : null}
      {query.error ? (
        <ErrorState title="Fehler" message={query.error} onRetry={() => void query.refresh()} />
      ) : null}

      <SectionPanel title="Mitarbeitende heute">
        {rows.length === 0 ? (
          <EmptyState
            title="Keine Erfassungen"
            message="Sobald Mitarbeitende einstempeln, erscheinen sie hier."
          />
        ) : (
          rows.map((row) => (
            <View key={row.employeeId} style={styles.row}>
              <View style={styles.rowHeader}>
                <Text style={[styles.name, { color: text.primary }]}>{row.employeeName}</Text>
                <PremiumBadge
                  label={row.statusLabel}
                  variant={row.session?.isOnline ? 'green' : 'muted'}
                  dot={!!row.session?.isOnline}
                />
              </View>
              <Text style={{ color: text.secondary, ...typography.caption }}>
                Letztes Event: {formatTime(row.lastEventAt)}
                {row.session?.netMinutes ? ` · ${row.session.netMinutes} Min.` : ''}
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
  summary: { ...typography.caption, marginBottom: careSpacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm, marginBottom: careSpacing.md },
  row: { paddingVertical: careSpacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.08)' },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: careSpacing.sm },
  name: { ...typography.body, fontWeight: '600', flex: 1 },
});
