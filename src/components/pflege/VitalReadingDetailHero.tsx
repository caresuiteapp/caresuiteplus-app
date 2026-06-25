import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { buildVitalListKpis } from '@/lib/pflege/vitalListStats';
import { isVitalReadingsLiveReady } from '@/lib/pflege/pflegeModuleConfig';
import { ROLE_LABELS } from '@/data/constants';

import type { RoleKey } from '@/types';
import type { VitalReadingListItem } from '@/types/modules/pflege';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { designTokens, spacing } from '@/theme';

type VitalReadingDetailHeroProps = {
  reading: VitalReadingListItem;
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

export function VitalReadingDetailHero({ reading, roleKey, isReadOnly }: VitalReadingDetailHeroProps) {
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
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
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


  const kpis = buildVitalListKpis([reading]);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>
            {reading.value} {reading.unit}
          </Text>
          <Text style={styles.meta}>
            {reading.typeLabel} · {reading.clientName}
            {isReadOnly ? ' · Lesemodus' : ''}
          </Text>
        </View>
        <View
          style={[
            styles.iconBadge,
            {
              backgroundColor: reading.isAlert
                ? colors.danger
                : reading.isDue
                  ? colors.warning
                  : colors.success,
            },
          ]}
        >
          <Text style={styles.iconText}>❤️</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[reading.status]}
          variant={statusVariant(reading.status)}
          dot
        />
        {reading.isDue ? <PremiumBadge label="Fällig" variant="orange" /> : null}
        {reading.isAlert ? <PremiumBadge label="Auffällig" variant="red" /> : null}
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isVitalReadingsLiveReady() ? (
          <PremiumBadge label="Live v_vital_sign_overview" variant="green" dot />
        ) : (
          <PremiumBadge label="Teilweise live" variant="orange" dot />
        )}
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

