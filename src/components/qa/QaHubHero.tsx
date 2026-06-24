import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { ROLE_LABELS } from '@/data/constants';
import { isQaLiveReady } from '@/lib/qa/qaModuleConfig';

import type { RoleKey } from '@/types';
import type { QaHubSnapshot } from '@/types/qa';
import { designTokens, spacing } from '@/theme';

type QaHubHeroProps = {
  data: QaHubSnapshot;
  roleKey: RoleKey;
};

export function QaHubHero({ data, roleKey }: QaHubHeroProps) {
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
    borderColor: 'rgba(34,197,94,0.35)',
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


  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>QA & Pilotbetrieb</Text>
          <Text style={styles.meta}>
            Coverage {data.testCoveragePercent}% · {data.openBugs} offene Bugs · Pilot{' '}
            {data.pilotProgressPercent}%
          </Text>
          <Text style={styles.subtitle}>
            Bug-Triage, Pilot-Checklisten und Test-Coverage für Live-Pilot und Store-Releases.
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🧪</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {!isQaLiveReady() ? (
          <PremiumBadge label="Live-Triage in Vorbereitung" variant="orange" dot />
        ) : null}
      </View>
      <View style={styles.kpiRow}>
        {data.kpis.map((kpi) => (
          <PremiumKpiCard
            key={kpi.id}
            label={kpi.label}
            value={String(kpi.value)}
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

