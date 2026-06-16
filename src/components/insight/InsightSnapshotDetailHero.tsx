import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { AdaptiveKpiGrid } from '@/components/adaptive';
import { PremiumBadge, PremiumListHeroFrame } from '@/components/ui';
import { dashboardKpisToGridItems } from '@/lib/adaptive/kpiGridItems';
import {
  buildInsightSnapshotDetailKpis,
  INSIGHT_PREPARED_MESSAGE,
  isInsightLiveReady,
} from '@/lib/insight';
import { ROLE_LABELS } from '@/data/demo';
import { isDemoMode } from '@/lib/supabase/config';
import type { RoleKey } from '@/types';
import type { InsightSnapshotDetail } from '@/types/modules/insight';
import { designTokens, spacing } from '@/theme';

type InsightSnapshotDetailHeroProps = {
  snapshot: InsightSnapshotDetail;
  roleKey: RoleKey;
};

export function InsightSnapshotDetailHero({ snapshot, roleKey }: InsightSnapshotDetailHeroProps) {
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


  const kpis = buildInsightSnapshotDetailKpis(snapshot.kpiCount, snapshot.periodLabel, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>INSIGHTCENTER · {snapshot.moduleLabel.toUpperCase()}</Text>
          <Text style={styles.title}>{snapshot.title}</Text>
          <Text style={styles.meta}>{snapshot.description}</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>📈</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
        <PremiumBadge statusKind="preparedOnly" />
        {!isInsightLiveReady() ? (
          <PremiumBadge label="Kein Live-Warehouse" variant="orange" dot />
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

