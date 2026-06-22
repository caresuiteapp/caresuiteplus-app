import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { AdaptiveKpiGrid } from '@/components/adaptive';
import { PremiumBadge, PremiumListHeroFrame } from '@/components/ui';
import { dashboardKpisToGridItems } from '@/lib/adaptive/kpiGridItems';
import { buildStationaerDashboardKpis } from '@/lib/stationaer/stationaerDashboardStats';
import {
  isStationaerExtensionLiveReady,
  isStationaerResidentsLiveReady,
} from '@/lib/stationaer/stationaerModuleConfig';
import { ROLE_LABELS } from '@/data/constants';

import type { RoleKey } from '@/types';
import type { StationaerDashboardStats } from '@/types/modules/stationaer';
import { designTokens, spacing } from '@/theme';

type StationaerDashboardHeroProps = {
  stats: StationaerDashboardStats;
  roleKey: RoleKey;
  tenantName?: string;
};

export function StationaerDashboardHero({ stats, roleKey, tenantName }: StationaerDashboardHeroProps) {
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
    color: colors.violet,
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
  },
  title: {
    ...typography.h2,
  },
  tenant: {
    ...typography.bodyStrong,
    color: colors.violet,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(167,139,250,0.35)',
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


  const kpis = buildStationaerDashboardKpis(stats, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>STATIONÄR</Text>
          <Text style={styles.title}>Pflegeheim</Text>
          {tenantName ? <Text style={styles.tenant}>{tenantName}</Text> : null}
          <Text style={styles.meta}>
            Bewohner:innen, Wohnbereiche und Schichtübergabe — mandantenbezogen gefiltert.
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🏥</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isStationaerResidentsLiveReady() ? (
          <PremiumBadge label="Live Bewohner:innen" variant="green" />
        ) : null}
        {!isStationaerExtensionLiveReady() ? (
          <PremiumBadge label="Demo-funktional" variant="orange" dot />
        ) : null}
      </View>
      <AdaptiveKpiGrid items={dashboardKpisToGridItems(kpis)} />
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

