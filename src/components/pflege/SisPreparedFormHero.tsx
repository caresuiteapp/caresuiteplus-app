import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumListHeroFrame } from '@/components/ui';
import {
  isSisWriteReady,
  SIS_CREATE_PREPARED_MESSAGE,
  SIS_EDIT_PREPARED_MESSAGE,
} from '@/lib/pflege/pflegeModuleConfig';
import { ROLE_LABELS } from '@/data/demo';
import { isDemoMode } from '@/lib/supabase/config';
import type { RoleKey } from '@/types';
import { designTokens, spacing } from '@/theme';

type SisPreparedFormHeroProps = {
  mode: 'create' | 'edit';
  clientName?: string;
  roleKey: RoleKey;
  isReadOnly: boolean;
};

export function SisPreparedFormHero({
  mode,
  clientName,
  roleKey,
  isReadOnly,
}: SisPreparedFormHeroProps) {
  const { colors, typography, gradients } = useLegacyTheme();
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
  subtitle: { ...typography.caption, color: colors.textSecondary },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: colors.violet,
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


  const writeReady = isSisWriteReady();
  const title = mode === 'create' ? 'SIS anlegen' : 'SIS bearbeiten';
  const preparedMessage =
    mode === 'create' ? SIS_CREATE_PREPARED_MESSAGE : SIS_EDIT_PREPARED_MESSAGE;

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>PFLEGE · SIS · FORMULAR</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.meta}>
            {clientName ?? 'Neues Assessment'}
            {isReadOnly ? ' · Lesemodus' : ''}
          </Text>
          <Text style={styles.subtitle}>{preparedMessage}</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>📊</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
        {writeReady ? (
          <PremiumBadge label="Speichern aktiv" variant="green" dot />
        ) : (
          <PremiumBadge label="Demo-funktional" variant="orange" dot />
        )}
      </View>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

