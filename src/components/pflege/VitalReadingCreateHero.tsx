import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumListHeroFrame } from '@/components/ui';
import { isVitalWriteReady, VITAL_WRITE_PREPARED_MESSAGE } from '@/lib/pflege/pflegeModuleConfig';
import { ROLE_LABELS } from '@/data/constants';

import type { RoleKey } from '@/types';
import { designTokens, spacing } from '@/theme';

type VitalReadingCreateHeroProps = {
  roleKey: RoleKey;
  isReadOnly: boolean;
};

export function VitalReadingCreateHero({ roleKey, isReadOnly }: VitalReadingCreateHeroProps) {
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
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
}),
    [colors, typography, gradients],
  );


  const writeReady = isVitalWriteReady();

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>Vitalwert erfassen</Text>
          <Text style={styles.meta}>
            Formular-Vorschau{isReadOnly ? ' · Lesemodus' : ''}
          </Text>
          <Text style={styles.subtitle}>{VITAL_WRITE_PREPARED_MESSAGE}</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>❤️</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {writeReady ? (
          <PremiumBadge label="Schreiben aktiv" variant="green" dot />
        ) : (
          <PremiumBadge label="Demo-funktional" variant="orange" dot />
        )}
      </View>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

