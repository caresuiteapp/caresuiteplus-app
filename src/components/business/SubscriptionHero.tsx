import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { ROLE_LABELS } from '@/data/constants';
import { formatFreePlatformPrice, getFreePlatformModules } from '@/lib/billing/freePlatformService';

import type { RoleKey } from '@/types';
import { designTokens, spacing } from '@/theme';

type SubscriptionHeroProps = {
  tenantName: string;
  planLabel: string;
  moduleCount: number;
  roleKey: RoleKey;
};

export function SubscriptionHero({
  tenantName,
  planLabel,
  moduleCount,
  roleKey,
}: SubscriptionHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: { flexDirection: 'row', gap: spacing.md },
  textCol: { flex: 1, gap: 2 },
  eyebrow: {
    ...typography.caption,
    color: colors.cyan,
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
  },
  title: { ...typography.h2 },
  meta: { ...typography.caption, color: colors.textMuted },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0,188,212,0.35)',
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
}),
    [colors, typography, gradients],
  );

  const freeModuleCount = getFreePlatformModules().length;

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>CARESUITE+ · FREE PLATFORM</Text>
          <Text style={styles.title}>{planLabel}</Text>
          <Text style={styles.meta}>
            {tenantName} · {formatFreePlatformPrice()}
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🆓</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        <PremiumBadge label="0 € — kein Checkout" variant="green" />
      </View>
      <View style={styles.kpiRow}>
        <PremiumKpiCard label="Aktiv" value={String(moduleCount)} icon="📦" accentColor={colors.cyan} style={styles.kpiItem} />
        <PremiumKpiCard
          label="Plattform"
          value="Kostenlos"
          subValue="Keine Testphase"
          icon="✨"
          accentColor={colors.orange}
          style={styles.kpiItem}
        />
        <PremiumKpiCard
          label="Module"
          value={String(freeModuleCount)}
          subValue="inklusive"
          icon="🧩"
          accentColor={colors.violet}
          style={styles.kpiItem}
        />
      </View>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;
