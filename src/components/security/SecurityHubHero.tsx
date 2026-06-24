import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { ROLE_LABELS } from '@/data/constants';
import { isSecurityLiveReady } from '@/lib/security/securityModuleConfig';

import type { RoleKey } from '@/types';
import type { SecurityHubSnapshot } from '@/types/security';
import { designTokens, spacing } from '@/theme';

type SecurityHubHeroProps = {
  data: SecurityHubSnapshot;
  roleKey: RoleKey;
};

export function SecurityHubHero({ data, roleKey }: SecurityHubHeroProps) {
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


  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>Security & DSGVO</Text>
          <Text style={styles.meta}>
            DSGVO {data.dsgvoScorePercent}% · {data.openFindings} offene Findings ·{' '}
            {data.performanceKpis.length} Performance-KPIs
          </Text>
          <Text style={styles.subtitle}>
            Compliance-Score, Findings-Triage und Performance-Monitoring für Mandanten und Plattform.
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🛡️</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {!isSecurityLiveReady() ? (
          <PremiumBadge label="Live-Monitoring in Vorbereitung" variant="orange" dot />
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

