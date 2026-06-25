import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { ROLE_LABELS } from '@/data/constants';
import { isReleaseLiveReady } from '@/lib/release/releaseModuleConfig';

import type { RoleKey } from '@/types';
import type { ReleaseHubSnapshot } from '@/types/release';
import { designTokens, spacing } from '@/theme';

type ReleaseHubHeroProps = {
  data: ReleaseHubSnapshot;
  roleKey: RoleKey;
};

export function ReleaseHubHero({ data, roleKey }: ReleaseHubHeroProps) {
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


  const { manifest } = data;

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>Release & Deployment</Text>
          <Text style={styles.meta}>
            v{manifest.appVersion} ({manifest.buildNumber}) · {manifest.channel} ·{' '}
            {data.envProfiles.length} Umgebungen
          </Text>
          <Text style={styles.subtitle}>
            Version-Manifeste, Checklisten und Umgebungsprofile für Store- und Pilot-Releases.
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🚀</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {!isReleaseLiveReady() ? (
          <PremiumBadge label="Live-Deployment in Vorbereitung" variant="orange" dot />
        ) : null}
      </View>
      <View style={styles.kpiRow}>
        {data.kpis.map((kpi) => (
          <PremiumKpiCard
            key={kpi.id}
            label={kpi.label}
            value={String(kpi.value)}
            subValue={kpi.subValue}
            style={styles.kpiItem}
          />
        ))}
      </View>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

