import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import type { KpiMetricValue } from '@/types/reporting/metrics';
import { colors, spacing, typography } from '@/theme';

type ReportingKpiCardProps = {
  metric: KpiMetricValue;
};

const AVAILABILITY_VARIANT = {
  active: 'green' as const,
  prepared: 'muted' as const,
  incomplete: 'orange' as const,
};

export function ReportingKpiCard({ metric }: ReportingKpiCardProps) {
  const router = useRouter();
  const canNavigate = metric.availability === 'active' && metric.drilldownRoute;

  const content = (
    <PremiumCard style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>{metric.label}</Text>
        <PremiumBadge label={metric.availability} variant={AVAILABILITY_VARIANT[metric.availability]} />
      </View>
      <Text style={styles.value}>{metric.displayValue}</Text>
      <Text style={styles.meta}>
        {metric.periodLabel} · Quelle: {metric.dataSource}
      </Text>
      {metric.trend ? (
        <Text style={styles.trend}>
          Trend: {metric.trend.direction === 'up' ? '↑' : metric.trend.direction === 'down' ? '↓' : '→'}{' '}
          {metric.trend.label}
        </Text>
      ) : null}
      {metric.incompleteReason ? (
        <Text style={styles.warning}>{metric.incompleteReason}</Text>
      ) : null}
      {metric.dataQualityRoute ? (
        <Pressable onPress={() => router.push(metric.dataQualityRoute as never)}>
          <Text style={styles.link}>Datenqualität prüfen</Text>
        </Pressable>
      ) : null}
    </PremiumCard>
  );

  if (!canNavigate) return content;

  return (
    <Pressable onPress={() => router.push(metric.drilldownRoute as never)} accessibilityRole="button">
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  label: { ...typography.bodyStrong, flex: 1, marginRight: spacing.sm },
  value: { ...typography.h2, color: colors.cyan },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  trend: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  warning: { ...typography.caption, color: colors.warning, marginTop: spacing.xs },
  link: { ...typography.caption, color: colors.cyan, marginTop: spacing.xs },
});

export function buildReportingKpiGridItems(metrics: KpiMetricValue[]) {
  return metrics.map((metric) => ({
    id: metric.kpiId,
    label: metric.label,
    value: metric.displayValue,
    subValue: `${metric.periodLabel} · ${metric.dataSource}`,
    icon: metric.availability === 'active' ? '📊' : '⏳',
    accentColor: metric.availability === 'active' ? colors.cyan : colors.textMuted,
  }));
}
