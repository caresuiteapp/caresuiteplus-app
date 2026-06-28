import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, SectionPanel } from '@/components/ui';
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
};

export function WfmTimeAccountPanel({ tenantId, userId, roleKey, employeeId }: WfmTimeAccountPanelProps) {
  const text = useAuroraAdaptiveText();
  const accent = moduleColor('office');
  const now = new Date();

  const todayQuery = useAsyncQuery(
    useCallback(
      () => getWfmTodayAmpel(tenantId, userId, roleKey, { employeeId }),
      [tenantId, userId, roleKey, employeeId],
    ),
    [tenantId, userId, roleKey, employeeId],
  );

  const monthQuery = useAsyncQuery(
    useCallback(
      () =>
        getWfmTimeAccountForMonth(tenantId, userId, roleKey, now.getFullYear(), now.getMonth() + 1, {
          employeeId,
        }),
      [tenantId, userId, roleKey, employeeId, now.getFullYear(), now.getMonth()],
    ),
    [tenantId, userId, roleKey, employeeId],
  );

  const today = todayQuery.data;
  const account = monthQuery.data;

  return (
    <SectionPanel title="Zeitkonto" subtitle={`Monat ${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`}>
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
      ) : (
        <Text style={{ color: text.secondary, ...typography.caption }}>Zeitkonto wird berechnet…</Text>
      )}
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: careSpacing.sm },
  stats: { marginTop: careSpacing.sm, gap: 4 },
  statLine: { ...typography.body },
});
