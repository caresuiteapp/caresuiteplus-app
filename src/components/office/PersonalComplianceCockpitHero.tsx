import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import {
  isPersonalComplianceLiveReady,
  PERSONAL_COMPLIANCE_PREPARED_MESSAGE,
} from '@/lib/office/personalComplianceCockpitService';
import type { PersonalComplianceSnapshot } from '@/types/modules/personalComplianceCockpit';

import { designTokens, spacing } from '@/theme';

const iconSize = 52;

type PersonalComplianceCockpitHeroProps = {
  snapshot: PersonalComplianceSnapshot;
};

export function PersonalComplianceCockpitHero({ snapshot }: PersonalComplianceCockpitHeroProps) {
  const { colors, typography } = useLegacyTheme();
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
        preparedHint: { ...typography.caption, color: colors.textMuted },
      }),
    [colors, typography],
  );

  const heroKpis = [
    {
      id: 'risks',
      label: 'Risiken gesamt',
      value: String(snapshot.risks.length),
      subValue: 'Warnungen',
    },
    {
      id: 'critical',
      label: 'Kritisch',
      value: String(snapshot.risks.filter((r) => r.severity === 'critical').length),
      subValue: 'sofort prüfen',
    },
    {
      id: 'deployable',
      label: 'Einsatzfähig',
      value: String(snapshot.kpis.find((k) => k.key === 'deployable')?.value ?? 0),
      subValue: 'aktiv',
    },
    {
      id: 'active',
      label: 'Aktive MA',
      value: String(snapshot.kpis.find((k) => k.key === 'active_employees')?.value ?? 0),
      subValue: 'Personalstand',
    },
  ];

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>OFFICE · PERSONAL</Text>
          <Text style={styles.title}>Personal-Compliance</Text>
          <Text style={styles.meta}>Mehr → Personal → Personal-Compliance</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>👥</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label="Verwaltung · QM · GF" variant="orange" dot />
        {!isPersonalComplianceLiveReady() || snapshot.preparedOnly ? (
          <PremiumBadge label="preparedOnly" variant="muted" />
        ) : null}
      </View>
      <View style={styles.kpiRow}>
        {heroKpis.map((kpi) => (
          <View key={kpi.id} style={styles.kpiItem}>
            <PremiumKpiCard label={kpi.label} value={kpi.value} subValue={kpi.subValue} />
          </View>
        ))}
      </View>
      {!isPersonalComplianceLiveReady() ? (
        <Text style={styles.preparedHint}>{PERSONAL_COMPLIANCE_PREPARED_MESSAGE}</Text>
      ) : null}
    </PremiumListHeroFrame>
  );
}
