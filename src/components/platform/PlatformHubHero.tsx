import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { ROLE_LABELS } from '@/data/constants';

import type { RoleKey } from '@/types';
import { designTokens, spacing } from '@/theme';

type PlatformHubHeroProps = {
  roleKey: RoleKey;
  ocrJobCount?: number;
  aiJobCount?: number;
};

export function PlatformHubHero({ roleKey, ocrJobCount = 0, aiJobCount = 0 }: PlatformHubHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const heroText = usePremiumHeroTextStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: { flexDirection: 'row', gap: spacing.md },
  textCol: { flex: 1, gap: 2 },
  eyebrow: {
    ...typography.caption,
    color: '#A78BFA',
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
    borderColor: 'rgba(167,139,250,0.35)',
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
}),
    [colors, typography, gradients],
  );


  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>KI & OCR</Text>
          <Text style={styles.meta}>Dokumentenerkennung und KI-Assistenz — Demo-Jobs</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🤖</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        <PremiumBadge label="preparedOnly" variant="muted" />
      </View>
      <View style={styles.kpiRow}>
        <PremiumKpiCard label="OCR-Jobs" value={String(ocrJobCount)} icon="📄" accentColor="#62F3FF" style={styles.kpiItem} />
        <PremiumKpiCard label="KI-Jobs" value={String(aiJobCount)} icon="🤖" accentColor="#A78BFA" style={styles.kpiItem} />
        <PremiumKpiCard label="Pipeline" value="Demo" subValue="Kein Live-Render" icon="⚙️" accentColor={colors.orange} style={styles.kpiItem} />
      </View>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

