import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { AdaptiveKpiGrid } from '@/components/adaptive';
import { PremiumBadge, PremiumListHeroFrame } from '@/components/ui';
import { dashboardKpisToGridItems } from '@/lib/adaptive/kpiGridItems';
import { buildAssistDashboardKpis } from '@/lib/assist/assistDashboardStats';
import {
  isAssistExtensionLiveReady,
  isAssistTripsLiveReady,
} from '@/lib/assist/assistModuleConfig';
import { isGpsTrackingLiveReady } from '@/lib/assist/gpsTrackingConfig';
import { ROLE_LABELS } from '@/data/constants';

import type { RoleKey } from '@/types';
import type { AssistDashboardStats } from '@/types/modules/assist';
import { designTokens, spacing } from '@/theme';

type AssistDashboardHeroProps = {
  stats: AssistDashboardStats;
  roleKey: RoleKey;
  onKpiPress?: (navigationTarget: string) => void;
};

export function AssistDashboardHero({ stats, roleKey, onKpiPress }: AssistDashboardHeroProps) {
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
    color: colors.amber,
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
  },
  title: {
    ...typography.h2,
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
    borderColor: 'rgba(251,191,36,0.35)',
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


  const kpis = buildAssistDashboardKpis(stats, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>ASSIST</Text>
          <Text style={styles.title}>Einsatzplanung</Text>
          <Text style={styles.meta}>
            Einsätze, Durchführung und Fahrten — mandantenbezogen und rollenbasiert.
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🚗</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isAssistTripsLiveReady() ? <PremiumBadge label="Live Fahrtenbuch" variant="green" /> : null}
        {!isGpsTrackingLiveReady() ? (
          <PremiumBadge label="GPS extern" variant="orange" dot />
        ) : null}
        {!isAssistExtensionLiveReady() ? (
          <PremiumBadge label="Demo-funktional" variant="orange" dot />
        ) : null}
      </View>
      <AdaptiveKpiGrid items={dashboardKpisToGridItems(kpis, onKpiPress)} />
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

