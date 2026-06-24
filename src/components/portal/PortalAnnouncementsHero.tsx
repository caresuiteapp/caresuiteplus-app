import { useMemo } from 'react';
import { useLegacyTheme, type LegacyColors } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';

import { buildPortalAnnouncementsKpis } from '@/lib/portal/portalAnnouncementsStats';
import type { PortalScope } from '@/types/portal';
import { designTokens, spacing } from '@/theme';

type PortalAnnouncementsHeroProps = {
  scope: 'portal_employee' | 'portal_client';
  itemCount: number;
  activeCount: number;
};

const SCOPE_CONFIG = (colors: LegacyColors) =>
  ({
    portal_employee: {
      eyebrow: 'MITARBEITERPORTAL',
      title: 'Ankündigungen',
      subtitle: 'Mitteilungen und Hinweise für Ihre Einsätze.',
      accent: colors.orange,
      icon: '📢',
    },
    portal_client: {
      eyebrow: 'KLIENT:INNENPORTAL',
      title: 'Mitteilungen',
      subtitle: 'Informationen vom Betreuungsteam — nur freigegebene Inhalte.',
      accent: colors.cyan,
      icon: '📣',
    },
  }) as const;

export function PortalAnnouncementsHero({
  scope,
  itemCount,
  activeCount,
}: PortalAnnouncementsHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: { flexDirection: 'row', gap: spacing.md },
  textCol: { flex: 1, gap: 2 },
  eyebrow: {
    ...typography.caption,
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
  },
  title: { ...typography.h2, color: '#FFFFFF', fontWeight: '800' },
  meta: { ...typography.caption, color: 'rgba(255,255,255,0.75)' },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
}),
    [colors, typography, gradients],
  );


  const config = SCOPE_CONFIG(colors)[scope];
  const kpis = buildPortalAnnouncementsKpis(itemCount, activeCount, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>{config.title}</Text>
          <Text style={styles.meta}>{config.subtitle}</Text>
        </View>
        <View style={[styles.iconBadge, { borderColor: `${config.accent}55` }]}>
          <Text style={styles.iconText}>{config.icon}</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label="Portal preparedOnly" variant="muted" />
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

