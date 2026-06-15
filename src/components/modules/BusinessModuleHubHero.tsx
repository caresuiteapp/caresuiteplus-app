import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { ROLE_LABELS } from '@/data/demo';
import { buildModuleHubKpis } from '@/lib/modules/moduleHubStats';
import { formatFreePlatformPrice } from '@/lib/billing/freePlatformService';
import { isDemoMode } from '@/lib/supabase/config';
import type { BillingPreview } from '@/lib/modules/moduleEntitlementService';
import type { EffectiveModuleAccess, RoleKey } from '@/types';
import { designTokens, spacing } from '@/theme';

type BusinessModuleHubHeroProps = {
  modules: EffectiveModuleAccess[];
  billing: BillingPreview;
  roleKey: RoleKey;
};

export function BusinessModuleHubHero({ modules, billing, roleKey }: BusinessModuleHubHeroProps) {
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
    borderColor: 'rgba(255,149,0,0.35)',
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


  const kpis = buildModuleHubKpis(modules, billing, mode);
  const activeCount = modules.filter((module) => module.isEffective).length;

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>BUSINESS · FREE PLATFORM</Text>
          <Text style={styles.title}>Module — kostenlos aktivieren</Text>
          <Text style={styles.meta}>
            {activeCount} aktiv · {modules.length} Produkte · {formatFreePlatformPrice()}
          </Text>
          <Text style={styles.subtitle}>
            CareSuite+ Office ist immer enthalten. Fachmodule kostenlos aktivieren — kein Checkout.
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🧩</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        <PremiumBadge label="0 € — kein Abo" variant="green" />
        {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
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
