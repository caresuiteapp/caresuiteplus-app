import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { PILOT_MILESTONE_ID, PILOT_TENANT_IDS } from '@/lib/pilot/pilotConfig';

import { designTokens, spacing } from '@/theme';

type PilotReadinessHeroProps = {
  overallReadinessPercent: number;
  releaseGateLinked: boolean;
  selectedTenantName?: string;
  selectedTenantPercent?: number;
  selectedTenantPhase?: string;
};

export function PilotReadinessHero({
  overallReadinessPercent,
  releaseGateLinked,
  selectedTenantName,
  selectedTenantPercent,
  selectedTenantPhase,
}: PilotReadinessHeroProps) {
  const { colors, typography } = useLegacyTheme();
  const heroText = usePremiumHeroTextStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        topRow: { flexDirection: 'row', gap: spacing.md },
        textCol: { flex: 1, gap: 2 },
        eyebrow: {
          ...typography.caption,
          color: colors.violet,
          letterSpacing: designTokens.hero.eyebrowLetterSpacing,
        },
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
          borderColor: 'rgba(139,92,246,0.35)',
        },
        iconText: { fontSize: 22 },
        badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
        kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
        kpiItem: { flex: 1, minWidth: 100 },
        hint: { ...typography.caption, color: 'rgba(255,255,255,0.75)' },
      }),
    [colors, typography],
  );

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>Pilot-Readiness {PILOT_MILESTONE_ID}</Text>
          <Text style={styles.meta}>
            3 ambulante Mandanten · NRW Pilotphase Q2 2026 · Release-Gates{' '}
            {releaseGateLinked ? 'verknüpft' : 'offen'}
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🛫</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label="Dev/QA" variant="cyan" dot />
        <PremiumBadge label="preparedOnly Pilot" variant="muted" />
      </View>
      <View style={styles.kpiRow}>
        <PremiumKpiCard
          label="Gesamt"
          value={`${overallReadinessPercent}%`}
          subValue={`${PILOT_TENANT_IDS.length} Mandanten`}
          icon="📊"
          accentColor={colors.violet}
          style={styles.kpiItem}
        />
        {selectedTenantName ? (
          <PremiumKpiCard
            label={selectedTenantName.split(' ')[0]}
            value={`${selectedTenantPercent ?? 0}%`}
            subValue={selectedTenantPhase ?? '—'}
            icon="🏥"
            accentColor={colors.cyan}
            style={styles.kpiItem}
          />
        ) : null}
        <PremiumKpiCard
          label="Gates"
          value={releaseGateLinked ? 'Ja' : 'Nein'}
          subValue="Release-Hub"
          icon="🚦"
          accentColor={colors.orange}
          style={styles.kpiItem}
        />
      </View>
      <Text style={styles.hint}>
        Checkliste lokal — Live-Pilot erfordert Remote-Migrationen 0021–0036. Kein Store-Release.
      </Text>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;
