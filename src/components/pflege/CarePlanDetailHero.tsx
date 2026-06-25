import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { buildCarePlanDetailKpis } from '@/lib/pflege/carePlanDetailStats';
import { ROLE_LABELS } from '@/data/constants';

import type { RoleKey } from '@/types';
import type { CarePlanDetail } from '@/types/modules/pflege';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { designTokens, spacing } from '@/theme';

type CarePlanDetailHeroProps = {
  plan: CarePlanDetail;
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

export function CarePlanDetailHero({ plan, roleKey, isReadOnly }: CarePlanDetailHeroProps) {
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
    backgroundColor: colors.success,
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


  const kpis = buildCarePlanDetailKpis(plan, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>{plan.title}</Text>
          <Text style={styles.meta}>
            {plan.clientName}
            {plan.careLevel ? ` · ${plan.careLevel}` : ''}
          </Text>
          <Text style={styles.subtitle}>{plan.nextActionHint}</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>💊</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[plan.status]}
          variant={statusVariant(plan.status)}
          dot
        />
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isReadOnly ? <PremiumBadge label="Lesemodus" variant="muted" /> : null}
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

