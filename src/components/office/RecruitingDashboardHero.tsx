import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import {
  isRecruitingLiveReady,
  RECRUITING_PREPARED_MESSAGE,
} from '@/lib/recruiting/recruitingModuleConfig';
import type { RecruitingDashboardSummary } from '@/types/modules/recruiting';

import { designTokens, spacing } from '@/theme';

const iconSize = 52;

type RecruitingDashboardHeroProps = {
  summary: RecruitingDashboardSummary;
};

export function RecruitingDashboardHero({ summary }: RecruitingDashboardHeroProps) {
  const { colors, typography } = useLegacyTheme();
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
        kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
        kpiItem: { flex: 1, minWidth: 100 },
        preparedHint: { ...typography.caption, color: 'rgba(255,255,255,0.75)' },
      }),
    [colors, typography],
  );

  const kpis = [
    { id: 'open', label: 'Offen', value: String(summary.openApplicants), subValue: 'Bewerbungen' },
    { id: 'interview', label: 'Gespräche', value: String(summary.inInterview), subValue: 'Pipeline' },
    { id: 'offers', label: 'Angebote', value: String(summary.offersPending), subValue: 'Ausstehend' },
    { id: 'onboarding', label: 'Onboarding', value: String(summary.onboardingInProgress), subValue: 'Laufend' },
  ];

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>Bewerbungen & Onboarding</Text>
          <Text style={styles.meta}>
            {summary.totalApplicants} Bewerbungen · {summary.deletionDueCount} Löschfristen
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>👥</Text>
        </View>
      </View>

      <View style={styles.badges}>
        <PremiumBadge
          label={isRecruitingLiveReady() ? 'Live' : 'In Vorbereitung'}
          variant={isRecruitingLiveReady() ? 'green' : 'muted'}
        />
      </View>

      <View style={styles.kpiRow}>
        {kpis.map((kpi) => (
          <View key={kpi.id} style={styles.kpiItem}>
            <PremiumKpiCard label={kpi.label} value={kpi.value} subValue={kpi.subValue} />
          </View>
        ))}
      </View>

      {!isRecruitingLiveReady() ? (
        <Text style={styles.preparedHint}>{RECRUITING_PREPARED_MESSAGE}</Text>
      ) : null}
    </PremiumListHeroFrame>
  );
}
