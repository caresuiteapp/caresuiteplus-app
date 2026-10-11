import { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ErrorState, LoadingState, PremiumBadge, PremiumButton, PremiumKpiCard, SectionPanel } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import type { RoleKey } from '@/types';
import { getWfmTimeAccountForMonth, getWfmTodayAmpel } from '@/lib/wfm';
import type { WfmTrafficLight } from '@/types/modules/wfm';
import { typography } from '@/theme';

const AMPEL_LABELS: Record<WfmTrafficLight, string> = {
  green: 'Im Soll',
  yellow: 'Abweichung',
  red: 'Kritisch',
};

const AMPEL_VARIANT: Record<WfmTrafficLight, 'green' | 'orange' | 'red'> = {
  green: 'green',
  yellow: 'orange',
  red: 'red',
};

type WfmTimeAccountPanelProps = {
  tenantId: string;
  userId: string;
  roleKey: RoleKey | null;
  employeeId?: string | null;
  refreshKey?: number;
};

export function WfmTimeAccountPanel({ tenantId, userId, roleKey, employeeId, refreshKey = 0 }: WfmTimeAccountPanelProps) {
  const text = useAuroraAdaptiveText();
  const accent = moduleColor('office');
  const now = useMemo(() => new Date(), [refreshKey]);
  const scope = `${tenantId}:${userId}:${employeeId ?? ''}:${roleKey ?? ''}`;

  const todayQuery = useAsyncQuery(
    useCallback(
      () => getWfmTodayAmpel(tenantId, userId, roleKey, { employeeId }),
      [tenantId, userId, roleKey, employeeId],
    ),
    [tenantId, userId, roleKey, employeeId, refreshKey],
    { queryKey: `time-account-today:${scope}:${now.toDateString()}` },
  );

  const monthQuery = useAsyncQuery(
    useCallback(
      () =>
        getWfmTimeAccountForMonth(tenantId, userId, roleKey, now.getFullYear(), now.getMonth() + 1, {
          employeeId,
        }),
      [tenantId, userId, roleKey, now, employeeId],
    ),
    [tenantId, userId, roleKey, employeeId, refreshKey],
    { queryKey: `time-account-month:${scope}:${now.getFullYear()}:${now.getMonth() + 1}` },
  );

  const today = todayQuery.data;
  const account = monthQuery.data;

  return (
    <SectionPanel title="Zeitkonto" subtitle={`Monat ${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`}>
      {todayQuery.error || todayQuery.refreshError ? <ErrorState title="Tageskonto nicht aktuell" message={todayQuery.error ?? todayQuery.refreshError!} onRetry={() => void todayQuery.refresh()} /> : null}
      {monthQuery.error || monthQuery.refreshError ? <ErrorState title="Monatskonto nicht aktuell" message={monthQuery.error ?? monthQuery.refreshError!} onRetry={() => void monthQuery.refresh()} /> : null}
      <View style={styles.kpiRow}>
        <PremiumKpiCard
          label="Heute (Min.)"
          value={today ? `${today.actualMinutes} / ${today.targetMinutes}` : '—'}
          accentColor={accent}
        />
        {today?.trafficLight ? (
          <PremiumBadge label={AMPEL_LABELS[today.trafficLight]} variant={AMPEL_VARIANT[today.trafficLight]} />
        ) : null}
      </View>

      {account ? (
        <View style={styles.stats}>
          <Text style={[styles.statLine, { color: text.primary }]}>
            Ist: {Math.round(account.actualMinutes / 60)} Std. · Soll: {Math.round(account.targetMinutes / 60)} Std.
          </Text>
          <Text style={[styles.statLine, { color: text.secondary }]}>
            Überstunden: {Math.round(account.overtimeMinutes / 60)} Std. · Minus: {Math.round(account.undertimeMinutes / 60)} Std.
          </Text>
          {account.trafficLight ? (
            <PremiumBadge
              label={`Monats-Ampel: ${AMPEL_LABELS[account.trafficLight]}`}
              variant={AMPEL_VARIANT[account.trafficLight]}
            />
          ) : null}
        </View>
      ) : monthQuery.loading ? <LoadingState message="Zeitkonto wird berechnet…" /> : null}
      <PremiumButton title="Zeitkonto aktualisieren" variant="ghost" onPress={() => void Promise.all([todayQuery.refresh(), monthQuery.refresh()])} />
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: careSpacing.sm },
  stats: { marginTop: careSpacing.sm, gap: 4 },
  statLine: { ...typography.body },
});
