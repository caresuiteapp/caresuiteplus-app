import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import {
  isWorkflowBuilderLiveReady,
  WORKFLOW_BUILDER_PREPARED_MESSAGE,
} from '@/lib/workflow/workflowModuleConfig';

import { designTokens, spacing } from '@/theme';

type WorkflowBuilderHeroProps = {
  stepCount: number;
};

export function WorkflowBuilderHero({ stepCount }: WorkflowBuilderHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: { flexDirection: 'row', gap: spacing.md },
  textCol: { flex: 1, gap: 2 },
  eyebrow: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
  },
  title: { ...typography.h2, color: '#FFFFFF', fontWeight: '800' },
  meta: { ...typography.caption, color: 'rgba(255,255,255,0.75)' },
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
  hint: { ...typography.caption, color: 'rgba(255,255,255,0.75)' },
}),
    [colors, typography, gradients],
  );


  const liveReady = isWorkflowBuilderLiveReady();

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>Workflow-Builder</Text>
          <Text style={styles.meta}>Status-Schritte und Übergänge konfigurieren (WP 455)</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>⚙️</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label="Katalog-Workflow" variant="orange" dot />
        {!liveReady ? <PremiumBadge label="preparedOnly" variant="muted" /> : null}
      </View>
      <View style={styles.kpiRow}>
        <PremiumKpiCard
          label="Schritte"
          value={String(stepCount)}
          subValue="Konfiguriert"
          icon="📋"
          accentColor={colors.orange}
          style={styles.kpiItem}
        />
        <PremiumKpiCard
          label="Domain"
          value="Katalog"
          subValue="WP 435–455"
          icon="📦"
          accentColor={colors.cyan}
          style={styles.kpiItem}
        />
        <PremiumKpiCard
          label="Persistenz"
          value={liveReady ? 'Live' : 'Demo'}
          subValue={liveReady ? 'Supabase' : 'Lokal'}
          icon="💾"
          accentColor={colors.violet}
          style={styles.kpiItem}
        />
      </View>
      {!liveReady ? <Text style={styles.hint}>{WORKFLOW_BUILDER_PREPARED_MESSAGE}</Text> : null}
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

