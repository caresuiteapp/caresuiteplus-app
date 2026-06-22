import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import {
  isTenantOnboardingLiveReady,
  TENANT_ONBOARDING_PREPARED_MESSAGE,
} from '@/lib/admin/tenantOnboardingService';
import type { OnboardingProgressSummary } from '@/types/admin/tenantOnboarding';

import { designTokens, spacing } from '@/theme';

const iconSize = 52;

type TenantOnboardingDashboardHeroProps = {
  progress: OnboardingProgressSummary;
};

export function TenantOnboardingDashboardHero({ progress }: TenantOnboardingDashboardHeroProps) {
  const { colors, typography } = useLegacyTheme();
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
          backgroundColor: colors.bgElevated,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: 'rgba(98,243,255,0.35)',
        },
        iconText: { fontSize: 22 },
        badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
        kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
        kpiItem: { flex: 1, minWidth: 100 },
        preparedHint: { ...typography.caption, color: colors.textMuted },
      }),
    [colors, typography],
  );

  const kpis = [
    {
      id: 'status',
      label: 'Status',
      value: progress.session.overallStatus,
      subValue: 'Onboarding',
    },
    {
      id: 'progress',
      label: 'Fortschritt',
      value: `${progress.progressPercent}%`,
      subValue: `${progress.completedStepCount}/${progress.totalStepCount} Schritte`,
    },
    {
      id: 'step',
      label: 'Aktueller Schritt',
      value: progress.session.currentStepKey.replace(/_/g, ' '),
      subValue: 'Wizard',
    },
  ];

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>OFFICE · VERWALTUNG</Text>
          <Text style={styles.title}>Einrichtung / Onboarding</Text>
          <Text style={styles.meta}>Mandanten-Wizard mit Startfreigabe und Firmenprofil</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🚀</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label="Admin-only" variant="orange" dot />
        {!isTenantOnboardingLiveReady() ? <PremiumBadge label="preparedOnly" variant="muted" /> : null}
      </View>
      <View style={styles.kpiRow}>
        {kpis.map((kpi) => (
          <View key={kpi.id} style={styles.kpiItem}>
            <PremiumKpiCard label={kpi.label} value={kpi.value} subValue={kpi.subValue} />
          </View>
        ))}
      </View>
      {!isTenantOnboardingLiveReady() ? (
        <Text style={styles.preparedHint}>{TENANT_ONBOARDING_PREPARED_MESSAGE}</Text>
      ) : null}
    </PremiumListHeroFrame>
  );
}
