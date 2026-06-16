import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { ROLE_LABELS } from '@/data/demo';
import { buildOcrJobDetailKpis } from '@/lib/platform/platformDetailStats';
import { isPlatformLiveReady } from '@/lib/platform/platformModuleConfig';
import { isDemoMode } from '@/lib/supabase/config';
import type { RoleKey } from '@/types';
import type { OcrJobListItem } from '@/types/modules/platform';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { designTokens, spacing } from '@/theme';

type OcrJobDetailHeroProps = {
  job: OcrJobListItem;
  roleKey: RoleKey;
};

function statusVariant(status: string) {
  switch (status) {
    case 'abgeschlossen':
      return 'green' as const;
    case 'fehlerhaft':
      return 'red' as const;
    case 'in_bearbeitung':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

export function OcrJobDetailHero({ job, roleKey }: OcrJobDetailHeroProps) {
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
}),
    [colors, typography, gradients],
  );


  const kpis = buildOcrJobDetailKpis(job, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>PLATTFORM · OCR-JOB</Text>
          <Text style={styles.title}>{job.sourceDocumentTitle}</Text>
          <Text style={styles.meta}>{job.providerKey}</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>📄</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={WORKFLOW_STATUS_LABELS[job.status]} variant={statusVariant(job.status)} dot />
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isPlatformLiveReady() ? (
          <PremiumBadge label="Live Provider" variant="green" />
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

