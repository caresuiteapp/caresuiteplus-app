import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, SectionPanel } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import type { RoleKey } from '@/types';
import {
  evaluateAndStoreArbzgForToday,
  listWfmRuleViolationsForDate,
  listWfmTeamRuleViolationsToday,
  type WfmRuleViolation,
} from '@/lib/wfm/wfmRuleEngine';
import { todayWorkDate } from '@/lib/wfm/wfmWorkSessionRepository';
import type { WfmTrafficLight } from '@/types/modules/wfm';
import { typography } from '@/theme';

const AMPEL_LABELS: Record<WfmTrafficLight, string> = {
  green: 'Keine ArbZG-Hinweise',
  yellow: 'ArbZG-Warnung',
  red: 'ArbZG-Verstoß',
};

const AMPEL_VARIANT: Record<WfmTrafficLight, 'green' | 'orange' | 'red'> = {
  green: 'green',
  yellow: 'orange',
  red: 'red',
};

type WfmRuleWarningsPanelProps = {
  tenantId: string;
  userId: string;
  roleKey: RoleKey | null;
  employeeId?: string | null;
  compact?: boolean;
  teamView?: boolean;
};

function ViolationRow({ violation }: { violation: WfmRuleViolation }) {
  const text = useAuroraAdaptiveText();
  return (
    <View style={styles.violationRow}>
      <PremiumBadge
        label={violation.severity === 'violation' ? 'Verstoß' : 'Warnung'}
        variant={violation.severity === 'violation' ? 'red' : 'orange'}
      />
      <Text style={[styles.violationText, { color: text.primary }]}>{violation.message}</Text>
    </View>
  );
}

export function WfmRuleWarningsPanel({
  tenantId,
  userId,
  roleKey,
  employeeId,
  compact = false,
  teamView = false,
}: WfmRuleWarningsPanelProps) {
  const text = useAuroraAdaptiveText();
  const workDate = todayWorkDate();

  const evalQuery = useAsyncQuery(
    useCallback(
      () =>
        teamView
          ? listWfmTeamRuleViolationsToday(tenantId, roleKey).then((r) =>
              r.ok
                ? {
                    ok: true as const,
                    data: {
                      violations: r.data.map((v) => ({
                        ruleKey: v.ruleKey,
                        severity: v.severity,
                        message: v.message,
                        workDate: v.workDate,
                        sessionId: v.sessionId,
                      })),
                      trafficLight: (r.data.some((v) => v.severity === 'violation')
                        ? 'red'
                        : r.data.length > 0
                          ? 'yellow'
                          : 'green') as WfmTrafficLight,
                    },
                  }
                : r,
            )
          : evaluateAndStoreArbzgForToday(tenantId, userId, roleKey, { employeeId }),
      [tenantId, userId, roleKey, employeeId, teamView],
    ),
    [tenantId, userId, roleKey, employeeId, teamView],
  );

  const storedQuery = useAsyncQuery(
    useCallback(
      () =>
        teamView
          ? listWfmTeamRuleViolationsToday(tenantId, roleKey)
          : listWfmRuleViolationsForDate(tenantId, roleKey, workDate, { employeeId }),
      [tenantId, roleKey, workDate, employeeId, teamView],
    ),
    [tenantId, roleKey, workDate, employeeId, teamView],
    { enabled: !teamView || true },
  );

  const liveViolations = evalQuery.data?.violations ?? [];
  const storedViolations = storedQuery.data ?? [];
  const violations: WfmRuleViolation[] =
    storedViolations.length > 0
      ? storedViolations
      : liveViolations.map((v, i) => ({
          id: `live-${i}`,
          tenantId,
          employeeId: employeeId ?? '',
          ruleKey: v.ruleKey,
          severity: v.severity,
          message: v.message,
          workDate: v.workDate,
          sessionId: v.sessionId,
          acknowledgedAt: null,
          createdAt: new Date().toISOString(),
        }));

  const trafficLight: WfmTrafficLight = evalQuery.data?.trafficLight ?? (violations.length > 0 ? 'yellow' : 'green');

  if (compact && violations.length === 0 && trafficLight === 'green') return null;

  return (
    <SectionPanel title="ArbZG-Prüfung" subtitle={compact ? undefined : 'Arbeitszeitgesetz — automatische Hinweise'}>
      <PremiumBadge label={AMPEL_LABELS[trafficLight]} variant={AMPEL_VARIANT[trafficLight]} />

      {violations.length === 0 ? (
        <Text style={{ color: text.secondary, ...typography.caption, marginTop: careSpacing.sm }}>
          Keine Regelverstöße für heute erkannt.
        </Text>
      ) : (
        violations.map((v) => <ViolationRow key={v.id} violation={v} />)
      )}
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  violationRow: {
    marginTop: careSpacing.sm,
    gap: careSpacing.xs,
  },
  violationText: {
    ...typography.caption,
    lineHeight: 18,
  },
});
