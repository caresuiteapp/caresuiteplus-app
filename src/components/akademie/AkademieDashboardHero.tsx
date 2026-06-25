import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { StyleSheet, Text, View } from 'react-native';
import { AdaptiveKpiGrid } from '@/components/adaptive';
import { PremiumBadge, PremiumListHeroFrame } from '@/components/ui';
import { dashboardKpisToGridItems } from '@/lib/adaptive/kpiGridItems';
import { buildAkademieDashboardKpis } from '@/lib/akademie/akademieDashboardStats';
import {
  isAkademieCoursesLiveReady,
  isAkademieExtensionLiveReady,
} from '@/lib/akademie/akademieModuleConfig';
import { ROLE_LABELS } from '@/data/constants';

import type { RoleKey } from '@/types';
import type { AkademieDashboardStats } from '@/types/modules/akademie';
import { designTokens, spacing } from '@/theme';

type AkademieDashboardHeroProps = {
  stats: AkademieDashboardStats;
  roleKey: RoleKey;
};

export function AkademieDashboardHero({ stats, roleKey }: AkademieDashboardHeroProps) {
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
  eyebrow: {
    ...typography.caption,
    color: '#FFD166',
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
    borderColor: 'rgba(255,209,102,0.35)',
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


  const kpis = buildAkademieDashboardKpis(stats, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>Schulungen & Zertifikate</Text>
          <Text style={styles.meta}>
            Kurse, Teilnehmer und Zertifikate — Pflichtschulungen und Fortbildungen im Überblick.
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🎓</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isAkademieCoursesLiveReady() ? <PremiumBadge label="Live Kurse" variant="green" /> : null}
        {!isAkademieExtensionLiveReady() ? (
          <PremiumBadge label="Demo-funktional" variant="orange" dot />
        ) : null}
      </View>
      <AdaptiveKpiGrid items={dashboardKpisToGridItems(kpis)} />
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

