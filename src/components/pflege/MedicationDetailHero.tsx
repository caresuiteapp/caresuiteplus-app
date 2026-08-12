import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import {
  buildMedicationDetailKpis,
} from '@/lib/pflege/medicationDetailStats';
import type { MedicationDetail } from '@/types/modules/pflege';
import { ROLE_LABELS } from '@/data/constants';

import type { RoleKey } from '@/types';
import { designTokens, spacing } from '@/theme';

type MedicationDetailHeroProps = {
  detail: MedicationDetail;
  roleKey: RoleKey;
  isReadOnly: boolean;
};

function statusVariant(status: string) {
  switch (status) {
    case 'active':
      return 'green' as const;
    case 'paused':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

export function MedicationDetailHero({ detail, roleKey, isReadOnly }: MedicationDetailHeroProps) {
  const { colors, typography, mode } = useLegacyTheme();
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
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(98,243,255,0.35)',
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
}),
    [heroText.eyebrow, heroText.title, heroText.meta, typography.caption, colors.cyan],
  );


  const kpis = buildMedicationDetailKpis(detail, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>{detail.medicationName}</Text>
          <Text style={styles.meta}>
            {detail.clientName} · {detail.dosage}
            {isReadOnly ? ' · Lesemodus' : ''}
          </Text>
          <Text style={styles.subtitle}>Produktive Verordnung mit lückenloser Gaben- und Abweichungsdokumentation</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>💊</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge
          label={{ active: 'Aktiv', paused: 'Pausiert', stopped: 'Beendet', archived: 'Archiviert' }[detail.status]}
          variant={statusVariant(detail.status)}
          dot
        />
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        <PremiumBadge label="Live-Daten" variant="green" dot />
        {detail.isHighAlert ? <PremiumBadge label="Hochrisiko" variant="red" dot /> : null}
        {detail.isControlledSubstance ? <PremiumBadge label="BtM · Gegenkontrolle" variant="red" dot /> : null}
        {detail.intensiveCareRelevant ? <PremiumBadge label="Intensivpflege" variant="muted" /> : null}
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
