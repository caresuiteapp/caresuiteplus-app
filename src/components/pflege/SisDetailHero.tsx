import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { buildSisDetailKpis } from '@/lib/pflege/sisDetailStats';
import { isSisLiveReady, SIS_DETAIL_PREPARED_MESSAGE } from '@/lib/pflege/pflegeModuleConfig';
import { ROLE_LABELS } from '@/data/demo';
import { isDemoMode } from '@/lib/supabase/config';
import type { RoleKey } from '@/types';
import type { SisAssessment } from '@/types/modules/pflege';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { designTokens, spacing } from '@/theme';

type SisDetailHeroProps = {
  assessment: SisAssessment;
  roleKey: RoleKey;
  isReadOnly: boolean;
};

function statusVariant(status: string) {
  switch (status) {
    case 'aktiv':
      return 'green' as const;
    case 'fehlerhaft':
    case 'gesperrt':
      return 'red' as const;
    case 'in_bearbeitung':
    case 'entwurf':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

export function SisDetailHero({ assessment, roleKey, isReadOnly }: SisDetailHeroProps) {
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
    backgroundColor: colors.violet,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(124,92,255,0.35)',
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


  const kpis = buildSisDetailKpis(assessment, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>PFLEGE · SIS</Text>
          <Text style={styles.title}>{assessment.clientName}</Text>
          <Text style={styles.meta}>
            Score {assessment.overallScore} Pkt.
            {isReadOnly ? ' · Lesemodus' : ''}
          </Text>
          <Text style={styles.subtitle}>
            Strukturierte Informationssammlung — Live-Basis aus assessment_runs.
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>📊</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[assessment.status]}
          variant={statusVariant(assessment.status)}
          dot
        />
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
        {isSisLiveReady() ? (
          <PremiumBadge label="Live assessment_runs" variant="green" dot />
        ) : (
          <PremiumBadge label="Teilweise live" variant="orange" dot />
        )}
        <PremiumBadge label="Demo-funktional" variant="orange" />
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

export { SIS_DETAIL_PREPARED_MESSAGE };

const iconSize = designTokens.hero.iconBadgeSize;

