import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import {
  DATA_QUALITY_PREPARED_MESSAGE,
  isDataQualityLiveReady,
} from '@/lib/admin/dataQualityService';
import type { DataQualityOverview } from '@/types/admin/dataQuality';
import { isDemoMode } from '@/lib/supabase/config';
import { designTokens, spacing } from '@/theme';

const iconSize = 52;

type DataQualityDashboardHeroProps = {
  overview: DataQualityOverview;
};

export function DataQualityDashboardHero({ overview }: DataQualityDashboardHeroProps) {
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

  const kpis = [
    { id: 'status', label: 'Gesamtstatus', value: overview.overallStatus, subValue: 'Stammdaten' },
    { id: 'blocking', label: 'Blocker', value: String(overview.totalBlocking), subValue: 'kritisch' },
    { id: 'warnings', label: 'Warnungen', value: String(overview.totalWarnings), subValue: 'Hinweise' },
    { id: 'areas', label: 'Bereiche', value: String(overview.areas.length), subValue: 'geprüft' },
  ];

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>OFFICE · VERWALTUNG</Text>
          <Text style={styles.title}>Datenqualität</Text>
          <Text style={styles.meta}>Pflichtdatenprüfung und Stammdatenqualität je Mandant</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>✓</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label="Mandanten-Admin" variant="orange" dot />
        {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
        {!isDataQualityLiveReady() ? <PremiumBadge label="preparedOnly" variant="muted" /> : null}
      </View>
      <View style={styles.kpiRow}>
        {kpis.map((kpi) => (
          <View key={kpi.id} style={styles.kpiItem}>
            <PremiumKpiCard label={kpi.label} value={kpi.value} subValue={kpi.subValue} />
          </View>
        ))}
      </View>
      {!isDataQualityLiveReady() ? (
        <Text style={styles.preparedHint}>{DATA_QUALITY_PREPARED_MESSAGE}</Text>
      ) : null}
    </PremiumListHeroFrame>
  );
}
