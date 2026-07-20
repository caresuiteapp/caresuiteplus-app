import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { buildBillingDashboardKpis } from '@/lib/office/billingStats';
import { ROLE_LABELS } from '@/data/constants';

import type { RoleKey } from '@/types';
import type { BillingDashboardStats } from '@/types/modules/billing';
import { designTokens, spacing } from '@/theme';

type OfficeBillingHeroProps = {
  stats: BillingDashboardStats;
  roleKey: RoleKey;
  compact?: boolean;
};

export function OfficeBillingHero({ stats, roleKey, compact = false }: OfficeBillingHeroProps) {
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
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,149,0,0.35)',
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
  compactFrame: { marginBottom: spacing.sm },
}),
    [colors, typography, gradients],
  );


  const kpis = buildBillingDashboardKpis(stats, mode);

  if (compact) {
    return (
      <PremiumListHeroFrame style={styles.compactFrame}>
        <View style={styles.topRow}>
          <View style={styles.textCol}>
            <Text style={styles.title}>Abrechnung</Text>
            <Text style={styles.meta}>Rechnungen und Budgets</Text>
          </View>
          <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        </View>
        <View style={styles.badges}>
          {kpis.map((kpi) => (
            <PremiumBadge key={kpi.id} label={`${kpi.label}: ${kpi.value}`} variant="cyan" />
          ))}
        </View>
      </PremiumListHeroFrame>
    );
  }

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>Abrechnung</Text>
          <Text style={styles.meta}>Rechnungen, Budgets und Leistungskatalog</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>💶</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
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

const iconSize = designTokens.hero.iconBadgeSize;
