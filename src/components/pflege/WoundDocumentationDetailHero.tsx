import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import {
  buildWoundDocumentationDetailKpis,
  type WoundDocumentationDetail,
} from '@/lib/pflege/woundDocumentationDetailStats';
import {
  isWoundDocumentationLiveReady,
  WOUND_DETAIL_PREPARED_MESSAGE,
} from '@/lib/pflege/pflegeModuleConfig';
import { ROLE_LABELS } from '@/data/constants';

import type { RoleKey } from '@/types';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { designTokens, spacing } from '@/theme';

type WoundDocumentationDetailHeroProps = {
  detail: WoundDocumentationDetail;
  roleKey: RoleKey;
  isReadOnly: boolean;
};

function statusVariant(status: string) {
  switch (status) {
    case 'aktiv':
      return 'green' as const;
    case 'in_bearbeitung':
      return 'orange' as const;
    case 'archiviert':
      return 'muted' as const;
    default:
      return 'muted' as const;
  }
}

export function WoundDocumentationDetailHero({
  detail,
  roleKey,
  isReadOnly,
}: WoundDocumentationDetailHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const heroText = usePremiumHeroTextStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: { flexDirection: 'row', gap: spacing.md },
  textCol: { flex: 1, gap: 2 },
  eyebrow: heroText.eyebrow,
  title: heroText.title,
  meta: heroText.meta,
  subtitle: { ...typography.caption, color: 'rgba(255,255,255,0.85)' },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,77,106,0.35)',
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
}),
    [colors, typography, gradients],
  );


  const kpis = buildWoundDocumentationDetailKpis(detail, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>{detail.bodyLocation}</Text>
          <Text style={styles.meta}>
            {detail.clientName} · {detail.woundType}
            {isReadOnly ? ' · Lesemodus' : ''}
          </Text>
          <Text style={styles.subtitle}>{WOUND_DETAIL_PREPARED_MESSAGE}</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🩹</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[detail.status]}
          variant={statusVariant(detail.status)}
          dot
        />
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {!isWoundDocumentationLiveReady() ? (
          <PremiumBadge label="BodyMap extern" variant="orange" dot />
        ) : null}
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

export { WOUND_DETAIL_PREPARED_MESSAGE };

const iconSize = designTokens.hero.iconBadgeSize;

