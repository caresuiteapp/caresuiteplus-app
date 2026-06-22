import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AdaptiveKpiGrid } from '@/components/adaptive';
import { PremiumBadge, PremiumListHeroFrame } from '@/components/ui';
import { dashboardKpisToGridItems } from '@/lib/adaptive/kpiGridItems';
import { buildReportingKpiGridItems } from '@/components/reporting/ReportingKpiCard';
import { ROLE_LABELS } from '@/data/constants';

import type { RoleKey } from '@/types';
import type { ReportingDashboardSnapshot } from '@/types/reporting/metrics';
import { designTokens, spacing, typography, colors } from '@/theme';

const DASHBOARD_TITLES: Record<ReportingDashboardSnapshot['kind'], string> = {
  ceo: 'Geschäftsführer-Dashboard',
  admin: 'Verwaltungs-Dashboard',
  billing: 'Abrechnungs-Dashboard',
  qm: 'QM-Dashboard',
  employee: 'Mitarbeiter-Dashboard',
  export_center: 'Export & Report-Center',
};

type ExecutiveDashboardHeroProps = {
  snapshot: ReportingDashboardSnapshot;
  roleKey: RoleKey;
};

export function ExecutiveDashboardHero({ snapshot, roleKey }: ExecutiveDashboardHeroProps) {
  const title = DASHBOARD_TITLES[snapshot.kind];
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
        heroTitle: { ...typography.h2 },
        meta: { ...typography.caption, color: colors.textMuted },
        badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
        generatedMeta: { ...typography.caption, color: colors.textMuted },
      }),
    [],
  );

  const kpiItems = dashboardKpisToGridItems(buildReportingKpiGridItems(snapshot.kpis.slice(0, 6)));

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>BUSINESS · REPORTING · KPI</Text>
          <Text style={styles.heroTitle}>{title}</Text>
          <Text style={styles.meta}>
            {snapshot.activeCount} aktiv · {snapshot.preparedCount} vorbereitet · {snapshot.dateRange.label}
          </Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {snapshot.preparedOnly ? (
          <PremiumBadge label="Demo / preparedOnly" variant="muted" />
        ) : (
          <PremiumBadge label="Live Supabase" variant="green" />
        )}
      </View>
      <AdaptiveKpiGrid items={kpiItems} />
      <Text style={styles.generatedMeta}>
        Stand: {new Date(snapshot.generatedAt).toLocaleString('de-DE')}
      </Text>
    </PremiumListHeroFrame>
  );
}
