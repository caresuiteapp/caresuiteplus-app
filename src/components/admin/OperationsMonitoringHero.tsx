import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import {
  isOperationsMonitoringLiveReady,
  OPERATIONS_MONITORING_PREPARED_MESSAGE,
} from '@/lib/operations/operationsMonitoringService';
import type { OperationsMonitoringDashboard } from '@/types/modules/operationsMonitoring';

import { designTokens, spacing } from '@/theme';

const iconSize = 52;

type OperationsMonitoringHeroProps = {
  dashboard: OperationsMonitoringDashboard;
};

export function OperationsMonitoringHero({ dashboard }: OperationsMonitoringHeroProps) {
  const { colors, typography } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        topRow: { flexDirection: 'row', gap: spacing.md },
        textCol: { flex: 1, gap: 2 },
        eyebrow: {
          ...typography.caption,
          color: colors.cyan,
          letterSpacing: designTokens.hero.eyebrowLetterSpacing,
        },
        title: { ...typography.h2 },
        meta: { ...typography.caption, color: colors.textMuted },
        iconBadge: {
          width: iconSize,
          height: iconSize,
          borderRadius: iconSize / 2,
          backgroundColor: colors.bgElevated,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: 'rgba(98,243,255,0.35)',
        },
        iconText: { fontSize: 22 },
        badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
        kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
        kpiItem: { flex: 1, minWidth: 100 },
        preparedHint: { ...typography.caption, color: colors.textMuted },
      }),
    [colors, typography],
  );

  const kpis = [
    { id: 'status', label: 'Systemstatus', value: dashboard.overallStatus, subValue: 'letzter Check' },
    { id: 'errors', label: 'Offene Fehler', value: String(dashboard.openErrors), subValue: 'Logs' },
    { id: 'incidents', label: 'Incidents', value: String(dashboard.openIncidents), subValue: 'offen' },
    {
      id: 'prepared',
      label: 'Vorbereitet',
      value: String(dashboard.preparedAreasCount),
      subValue: 'Bereiche',
    },
  ];

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>SYSTEM · BETRIEB</Text>
          <Text style={styles.title}>Betrieb & Monitoring</Text>
          <Text style={styles.meta}>{dashboard.availabilityDisclaimer}</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>📡</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label="Mandanten-Admin" variant="orange" dot />
        {!isOperationsMonitoringLiveReady() ? (
          <PremiumBadge label="preparedOnly" variant="muted" />
        ) : null}
      </View>
      <View style={styles.kpiRow}>
        {kpis.map((kpi) => (
          <View key={kpi.id} style={styles.kpiItem}>
            <PremiumKpiCard label={kpi.label} value={kpi.value} subValue={kpi.subValue} />
          </View>
        ))}
      </View>
      {!isOperationsMonitoringLiveReady() ? (
        <Text style={styles.preparedHint}>{OPERATIONS_MONITORING_PREPARED_MESSAGE}</Text>
      ) : null}
    </PremiumListHeroFrame>
  );
}
