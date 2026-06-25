import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { StyleSheet, Text, View } from 'react-native';
import { AdaptiveKpiGrid } from '@/components/adaptive';
import { PremiumBadge, PremiumListHeroFrame } from '@/components/ui';
import { dashboardKpisToGridItems } from '@/lib/adaptive/kpiGridItems';
import { buildPflegeDashboardKpis } from '@/lib/pflege/pflegeDashboardStats';
import {
  isCarePlansLiveReady,
  isSisLiveReady,
  isVitalReadingsLiveReady,
} from '@/lib/pflege/pflegeModuleConfig';
import { ROLE_LABELS } from '@/data/constants';

import type { RoleKey } from '@/types';
import type { PflegeDashboardStats } from '@/types/modules/pflege';
import { designTokens, spacing } from '@/theme';

type PflegeDashboardHeroProps = {
  stats: PflegeDashboardStats;
  roleKey: RoleKey;
  roleLabel?: string | null;
  isReadOnly: boolean;
};

export function PflegeDashboardHero({
  stats,
  roleKey,
  roleLabel,
  isReadOnly,
}: PflegeDashboardHeroProps) {
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
  subtitle: heroText.subtitle,
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(74,222,128,0.35)',
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


  const kpis = buildPflegeDashboardKpis(stats, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>CareSuite+ Pflege</Text>
          <Text style={styles.meta}>
            Ambulante Pflegeplanung · {roleLabel ?? ROLE_LABELS[roleKey]}
            {isReadOnly ? ' · Lesemodus' : ''}
          </Text>
          <Text style={styles.subtitle}>
            Pflegepläne, Vitalwerte und Assessments — mandantenisoliert und rollenbasiert.
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🩺</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isCarePlansLiveReady() ? (
          <PremiumBadge label="Pläne Live" variant="green" dot />
        ) : null}
        {isVitalReadingsLiveReady() ? (
          <PremiumBadge label="Vitalwerte Live" variant="green" dot />
        ) : null}
        {isSisLiveReady() ? <PremiumBadge label="SIS Live" variant="green" dot /> : null}
      </View>
      <AdaptiveKpiGrid items={dashboardKpisToGridItems(kpis)} />
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

