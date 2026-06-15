import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { buildFollowUpDetailKpis } from '@/lib/beratung/extensionDetailStats';
import { isBeratungExtensionLiveReady, BERATUNG_EXTENSION_PREPARED_MESSAGE } from '@/lib/beratung/beratungModuleConfig';
import { ROLE_LABELS } from '@/data/demo';
import { isDemoMode } from '@/lib/supabase/config';
import type { RoleKey } from '@/types';
import type { FollowUp } from '@/types/modules/beratung';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { designTokens, spacing } from '@/theme';

type FollowUpDetailHeroProps = {
  followUp: FollowUp;
  roleKey: RoleKey;
};

export function FollowUpDetailHero({ followUp, roleKey }: FollowUpDetailHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: { flexDirection: 'row', gap: spacing.md },
  textCol: { flex: 1, gap: 2 },
  eyebrow: {
    ...typography.caption,
    color: colors.orange,
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
    borderColor: 'rgba(245,158,11,0.35)',
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
  preparedHint: { ...typography.caption, color: colors.textMuted },
}),
    [colors, typography, gradients],
  );


  const kpis = buildFollowUpDetailKpis(followUp, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>BERATUNG · WIEDERVORLAGE</Text>
          <Text style={styles.title}>{followUp.caseSubject}</Text>
          <Text style={styles.meta}>{followUp.assigneeName} · {followUp.note ?? 'Keine Notiz'}</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🔔</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={WORKFLOW_STATUS_LABELS[followUp.status]} variant="orange" dot />
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {!isBeratungExtensionLiveReady() ? (
          <PremiumBadge label="Demo / preparedOnly" variant="muted" />
        ) : null}
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
      {!isBeratungExtensionLiveReady() ? (
        <Text style={styles.preparedHint}>{BERATUNG_EXTENSION_PREPARED_MESSAGE}</Text>
      ) : null}
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

