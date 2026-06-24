import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { ROLE_LABELS } from '@/data/constants';
import { buildReleaseListKpis } from '@/lib/release/releaseListStats';
import { isReleaseLiveReady, RELEASE_PREPARED_MESSAGE } from '@/lib/release/releaseModuleConfig';

import type { RoleKey } from '@/types';
import type { ReleaseListItem } from '@/types/release';
import { designTokens, spacing } from '@/theme';

type ReleaseListHeroProps = {
  items: ReleaseListItem[];
  roleKey: RoleKey;
};

export function ReleaseListHero({ items, roleKey }: ReleaseListHeroProps) {
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
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
  },
  title: {
    ...typography.h2,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  meta: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.75)',
  },
  subtitle: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
  },
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


  const kpis = buildReleaseListKpis(items, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>Release-Checklisten</Text>
          <Text style={styles.meta}>
            {items.length} Release-Pakete · Deployment-Checklisten je Umgebung
          </Text>
          <Text style={styles.subtitle}>
            Übersicht aller Release-Pakete mit Checklisten-Fortschritt und Umgebungszuordnung.
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>📋</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {!isReleaseLiveReady() ? (
          <PremiumBadge label="Live-Deployment in Vorbereitung" variant="orange" dot />
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

export { RELEASE_PREPARED_MESSAGE };

const iconSize = designTokens.hero.iconBadgeSize;

