import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { ROLE_LABELS } from '@/data/demo';
import { buildRoadmapListKpis } from '@/lib/roadmap/roadmapListStats';
import { isRoadmapLiveReady, ROADMAP_PREPARED_MESSAGE } from '@/lib/roadmap/roadmapModuleConfig';
import { isDemoMode } from '@/lib/supabase/config';
import type { RoleKey } from '@/types';
import type { RoadmapListItem } from '@/types/roadmap';
import { designTokens, spacing } from '@/theme';

type RoadmapListHeroProps = {
  items: RoadmapListItem[];
  roleKey: RoleKey;
};

export function RoadmapListHero({ items, roleKey }: RoadmapListHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.cyan,
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
  },
  title: {
    ...typography.h2,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(124,92,255,0.35)',
  },
  iconText: {
    fontSize: 22,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kpiItem: {
    flex: 1,
    minWidth: 100,
  },
}),
    [colors, typography, gradients],
  );


  const kpis = buildRoadmapListKpis(items, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>BUSINESS · ROADMAP</Text>
          <Text style={styles.title}>Meilenstein-Übersicht</Text>
          <Text style={styles.meta}>
            {items.length} Meilensteine · Discovery bis Skalierung
          </Text>
          <Text style={styles.subtitle}>
            Strategische Meilensteine mit Phase, Quartal und Status für Markteintritt und Skalierung.
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>📍</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
        {!isRoadmapLiveReady() ? (
          <PremiumBadge label="Live-Sync in Vorbereitung" variant="orange" dot />
        ) : null}
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
    </PremiumListHeroFrame>
  );
}

export { ROADMAP_PREPARED_MESSAGE };

const iconSize = designTokens.hero.iconBadgeSize;

