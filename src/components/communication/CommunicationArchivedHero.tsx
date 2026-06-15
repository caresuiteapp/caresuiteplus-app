import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumListHeroFrame } from '@/components/ui';
import { ROLE_LABELS } from '@/data/demo';
import { isDemoMode } from '@/lib/supabase/config';
import type { RoleKey } from '@/types';
import { designTokens, spacing } from '@/theme';

type CommunicationArchivedHeroProps = {
  archivedCount: number;
  roleKey: RoleKey;
};

export function CommunicationArchivedHero({ archivedCount, roleKey }: CommunicationArchivedHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
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
  hint: { ...typography.caption, color: colors.textMuted },
}),
    [colors, typography, gradients],
  );


  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>BUSINESS · KOMMUNIKATION</Text>
          <Text style={styles.title}>Archivierte Threads</Text>
          <Text style={styles.meta}>
            {archivedCount} archivierte Konversationen · Nur Lesemodus
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>📁</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        <PremiumBadge label="Archiviert" variant="muted" />
        {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
      </View>
      <Text style={styles.hint}>
        Archivierte Threads können wiederhergestellt werden — keine neuen Nachrichten in diesem Zustand.
      </Text>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

