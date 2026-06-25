import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { StyleSheet, Text, View } from 'react-native';
import { AdaptiveKpiGrid } from '@/components/adaptive';
import { PremiumBadge, PremiumListHeroFrame } from '@/components/ui';
import { dashboardKpisToGridItems } from '@/lib/adaptive/kpiGridItems';
import {
  isPdlCockpitLiveReady,
  PDL_COCKPIT_PREPARED_MESSAGE,
} from '@/lib/reporting/reportingModuleConfig';
import { ROLE_LABELS } from '@/data/constants';

import type { RoleKey } from '@/types';
import type { PdlCockpitSnapshot } from '@/types/reporting';
import { designTokens, spacing } from '@/theme';

type PdlCockpitHeroProps = {
  snapshot: PdlCockpitSnapshot;
  roleKey: RoleKey;
  openTaskCount: number;
  riskCount: number;
};

export function PdlCockpitHero({
  snapshot,
  roleKey,
  openTaskCount,
  riskCount,
}: PdlCockpitHeroProps) {
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
  generatedMeta: { ...typography.caption, color: 'rgba(255,255,255,0.75)' },
  preparedHint: { ...typography.caption, color: 'rgba(255,255,255,0.75)' },
}),
    [colors, typography, gradients],
  );


  const generatedLabel = snapshot.generatedAt
    ? new Date(snapshot.generatedAt).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>PDL-Cockpit</Text>
          <Text style={styles.meta}>
            Pflegedienstleitung · {openTaskCount} Aufgaben · {riskCount} Risiken
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🩺</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isPdlCockpitLiveReady() ? (
          <PremiumBadge label="Live Supabase" variant="green" />
        ) : (
          <PremiumBadge label="Demo / preparedOnly" variant="muted" />
        )}
      </View>
      <AdaptiveKpiGrid
        items={dashboardKpisToGridItems(
          snapshot.kpis.map((kpi) => ({
            ...kpi,
            value: String(kpi.value),
          })),
        )}
      />
      <Text style={styles.generatedMeta}>Stand: {generatedLabel}</Text>
      {!isPdlCockpitLiveReady() ? (
        <Text style={styles.preparedHint}>{PDL_COCKPIT_PREPARED_MESSAGE}</Text>
      ) : null}
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

