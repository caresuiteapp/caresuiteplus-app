import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { StyleSheet, Text, View } from 'react-native';
import { AdaptiveKpiGrid } from '@/components/adaptive';
import { PremiumBadge, PremiumListHeroFrame } from '@/components/ui';
import { dashboardKpisToGridItems } from '@/lib/adaptive/kpiGridItems';
import { buildBeratungDashboardKpis } from '@/lib/beratung/beratungDashboardStats';
import {
  isBeratungCasesLiveReady,
  isBeratungExtensionLiveReady,
} from '@/lib/beratung/beratungModuleConfig';
import { ROLE_LABELS } from '@/data/constants';

import type { RoleKey } from '@/types';
import type { BeratungDashboardStats } from '@/types/modules/beratung';
import { designTokens, spacing } from '@/theme';

type BeratungDashboardHeroProps = {
  stats: BeratungDashboardStats;
  roleKey: RoleKey;
};

export function BeratungDashboardHero({ stats, roleKey }: BeratungDashboardHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const heroText = usePremiumHeroTextStyles();
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
  eyebrow: heroText.eyebrow,
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
    borderColor: 'rgba(98,243,255,0.35)',
  },
  iconText: {
    fontSize: 22,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
}),
    [colors, typography, gradients],
  );


  const kpis = buildBeratungDashboardKpis(stats, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>Sozial- und Pflegeberatung</Text>
          <Text style={styles.meta}>
            Beratungsfälle, Protokolle und Wiedervorlagen — mandantenbezogen mit guardServiceTenant.
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>💬</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isBeratungCasesLiveReady() ? <PremiumBadge label="Live Beratungsfälle" variant="green" /> : null}
        {!isBeratungExtensionLiveReady() ? (
          <PremiumBadge label="Demo-funktional" variant="orange" dot />
        ) : null}
      </View>
      <AdaptiveKpiGrid items={dashboardKpisToGridItems(kpis)} />
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

