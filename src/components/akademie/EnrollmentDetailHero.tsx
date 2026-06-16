import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { buildEnrollmentDetailKpis } from '@/lib/akademie/enrollmentDetailStats';
import { isAkademieExtensionLiveReady } from '@/lib/akademie/akademieModuleConfig';
import { ROLE_LABELS } from '@/data/demo';
import { isDemoMode } from '@/lib/supabase/config';
import type { RoleKey } from '@/types';
import type { EnrollmentDetail } from '@/types/modules/akademie';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { designTokens, spacing } from '@/theme';

type EnrollmentDetailHeroProps = {
  enrollment: EnrollmentDetail;
  roleKey: RoleKey;
};

export function EnrollmentDetailHero({ enrollment, roleKey }: EnrollmentDetailHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: { flexDirection: 'row', gap: spacing.md },
  textCol: { flex: 1, gap: 2 },
  eyebrow: {
    ...typography.caption,
    color: '#FFD166',
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
    borderColor: 'rgba(255,209,102,0.35)',
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
}),
    [colors, typography, gradients],
  );


  const kpis = buildEnrollmentDetailKpis(enrollment, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>AKADEMIE · TEILNAHME</Text>
          <Text style={styles.title}>{enrollment.participantName}</Text>
          <Text style={styles.meta}>{enrollment.courseTitle} · {enrollment.nextActionHint}</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>👥</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={WORKFLOW_STATUS_LABELS[enrollment.status]} variant="cyan" dot />
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isAkademieExtensionLiveReady() ? (
          <PremiumBadge statusKind="live" dot />
        ) : (
          <PremiumBadge statusKind="preparedOnly" />
        )}
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

