import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { AdaptiveKpiGrid } from '@/components/adaptive';
import { PremiumBadge, PremiumListHeroFrame } from '@/components/ui';
import { dashboardKpisToGridItems } from '@/lib/adaptive/kpiGridItems';
import {
  buildInsightExportDetailKpis,
  INSIGHT_PREPARED_MESSAGE,
  isInsightLiveReady,
} from '@/lib/insight';
import { ROLE_LABELS } from '@/data/constants';

import type { RoleKey } from '@/types';
import type { InsightExportDetail } from '@/types/modules/insight';
import { designTokens, spacing } from '@/theme';

type InsightExportDetailHeroProps = {
  exportItem: InsightExportDetail;
  roleKey: RoleKey;
};

export function InsightExportDetailHero({ exportItem, roleKey }: InsightExportDetailHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: { flexDirection: 'row', gap: spacing.md },
  textCol: { flex: 1, gap: 2 },
  eyebrow: {
    ...typography.caption,
    color: '#2563EB',
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
    borderColor: 'rgba(37,99,235,0.35)',
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  preparedHint: { ...typography.caption, color: colors.textMuted },
}),
    [colors, typography, gradients],
  );


  const kpis = buildInsightExportDetailKpis(exportItem, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>INSIGHTCENTER · EXPORT</Text>
          <Text style={styles.title}>{exportItem.title}</Text>
          <Text style={styles.meta}>{exportItem.description}</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>📤</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        <PremiumBadge label="preparedOnly" variant="muted" />
        {!isInsightLiveReady() ? (
          <PremiumBadge label="Kein Live-Scheduler" variant="orange" dot />
        ) : null}
      </View>
      <AdaptiveKpiGrid items={dashboardKpisToGridItems(kpis)} />
      {!isInsightLiveReady() ? (
        <Text style={styles.preparedHint}>{INSIGHT_PREPARED_MESSAGE}</Text>
      ) : null}
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

