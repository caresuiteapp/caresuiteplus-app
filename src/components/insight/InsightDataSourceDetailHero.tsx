import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { buildInsightDataSourceDetailKpis } from '@/lib/insight/insightDataSourceStats';
import { INSIGHT_PREPARED_MESSAGE, isInsightLiveReady } from '@/lib/insight';
import { ROLE_LABELS } from '@/data/constants';

import type { RoleKey } from '@/types';
import type { InsightDataSourceDetail } from '@/types/modules/insight';
import { designTokens, spacing } from '@/theme';

type InsightDataSourceDetailHeroProps = {
  source: InsightDataSourceDetail;
  roleKey: RoleKey;
};

export function InsightDataSourceDetailHero({ source, roleKey }: InsightDataSourceDetailHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const heroText = usePremiumHeroTextStyles();
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
  title: heroText.title,
  meta: heroText.meta,
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
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
  preparedHint: { ...typography.caption, color: 'rgba(255,255,255,0.75)' },
}),
    [colors, typography, gradients],
  );


  const kpis = buildInsightDataSourceDetailKpis(source, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>{source.label}</Text>
          <Text style={styles.meta}>{source.moduleKey} · {source.nextActionHint}</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🔌</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={source.connectionStatus} variant="orange" dot />
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {!isInsightLiveReady() ? <PremiumBadge label="Demo / preparedOnly" variant="muted" /> : null}
      </View>
      <View style={styles.kpiRow}>
        {kpis.map((kpi) => (
          <PremiumKpiCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            subValue={kpi.subValue}
            icon={kpi.icon}
            accentColor={kpi.accentColor}
            style={styles.kpiItem}
          />
        ))}
      </View>
      {!isInsightLiveReady() ? <Text style={styles.preparedHint}>{INSIGHT_PREPARED_MESSAGE}</Text> : null}
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

