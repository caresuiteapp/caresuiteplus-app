import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { buildCareRecordDetailKpis } from '@/lib/assist/careRecordDetailStats';
import { ASSIST_EXTENSION_PREPARED_MESSAGE, isAssistExtensionLiveReady } from '@/lib/assist/assistModuleConfig';
import { ROLE_LABELS } from '@/data/constants';

import type { RoleKey } from '@/types';
import type { CareRecordDetail } from '@/types/modules/assist';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { designTokens, spacing } from '@/theme';

type CareRecordDetailHeroProps = {
  record: CareRecordDetail;
  roleKey: RoleKey;
};

function statusVariant(status: string) {
  switch (status) {
    case 'abgeschlossen':
    case 'aktiv':
      return 'green' as const;
    case 'fehlerhaft':
      return 'red' as const;
    case 'in_bearbeitung':
    case 'entwurf':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

export function CareRecordDetailHero({ record, roleKey }: CareRecordDetailHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: { flexDirection: 'row', gap: spacing.md },
  textCol: { flex: 1, gap: 2 },
  eyebrow: {
    ...typography.caption,
    color: colors.amber,
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
    borderColor: 'rgba(255,176,32,0.35)',
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
  preparedHint: { ...typography.caption, color: colors.textMuted },
}),
    [colors, typography, gradients],
  );


  const kpis = buildCareRecordDetailKpis(record, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>ASSIST · LEISTUNGSNACHWEIS</Text>
          <Text style={styles.title}>{record.assignmentTitle}</Text>
          <Text style={styles.meta}>{record.employeeName} · {record.clientName}</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>📝</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={WORKFLOW_STATUS_LABELS[record.status]} variant={statusVariant(record.status)} dot />
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {record.hasSignature ? <PremiumBadge label="Signiert" variant="green" /> : null}
        {record.pdfReady ? <PremiumBadge label="PDF bereit" variant="cyan" /> : null}
        {isAssistExtensionLiveReady() ? (
          <PremiumBadge label="Live Supabase" variant="green" />
        ) : (
          <PremiumBadge label="Demo / preparedOnly" variant="muted" />
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
      {!isAssistExtensionLiveReady() ? (
        <Text style={styles.preparedHint}>{ASSIST_EXTENSION_PREPARED_MESSAGE}</Text>
      ) : null}
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

