import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { StyleSheet, Text, View } from 'react-native';
import { AdaptiveKpiGrid } from '@/components/adaptive';
import { PremiumBadge, PremiumListHeroFrame } from '@/components/ui';
import { dashboardKpisToGridItems } from '@/lib/adaptive/kpiGridItems';
import { buildQmDashboardKpis } from '@/lib/qm/qmDashboardStats';
import {
  isQmDashboardLiveReady,
  QM_DASHBOARD_PREPARED_MESSAGE,
} from '@/lib/qm/qmModuleConfig';
import { ROLE_LABELS } from '@/data/constants';

import type { QmDashboardSnapshot } from '@/lib/qm/qm.types';
import type { RoleKey } from '@/types';
import { designTokens, spacing } from '@/theme';

type QmDashboardHeroProps = {
  data: QmDashboardSnapshot;
  roleKey: RoleKey;
};

export function QmDashboardHero({ data, roleKey }: QmDashboardHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const heroText = usePremiumHeroTextStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: { flexDirection: 'row', gap: spacing.md },
  textCol: { flex: 1, gap: 2 },
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
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  preparedHint: { ...typography.caption, color: 'rgba(255,255,255,0.75)' },
}),
    [colors, typography, gradients],
  );


  const kpis = buildQmDashboardKpis(data);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>QM-Dashboard</Text>
          <Text style={styles.meta}>
            Handbuch, Dokumente, Compliance und MD-Prüfung — mandantenbezogen.
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>✅</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isQmDashboardLiveReady() ? (
          <PremiumBadge label="Live QM-Dokumente" variant="green" />
        ) : (
          <PremiumBadge label="Demo / preparedOnly" variant="muted" />
        )}
      </View>
      <AdaptiveKpiGrid items={dashboardKpisToGridItems(kpis)} />
      {!isQmDashboardLiveReady() ? (
        <Text style={styles.preparedHint}>{QM_DASHBOARD_PREPARED_MESSAGE}</Text>
      ) : null}
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

