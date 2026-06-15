import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumListHeroFrame } from '@/components/ui';
import {
  isPflegeSettingsLiveReady,
  PFLEGE_SETTINGS_PREPARED_MESSAGE,
} from '@/lib/pflege/pflegeModuleConfig';
import { ROLE_LABELS } from '@/data/demo';
import { isDemoMode } from '@/lib/supabase/config';
import type { RoleKey } from '@/types';
import type { PflegeModuleSettings } from '@/types/modules/pflege';
import { designTokens, spacing } from '@/theme';

type PflegeSettingsHeroProps = {
  settings: PflegeModuleSettings;
  roleKey: RoleKey;
};

export function PflegeSettingsHero({ settings, roleKey }: PflegeSettingsHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.cyan,
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
  },
  title: {
    ...typography.h2,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(139,149,167,0.35)',
  },
  iconText: {
    fontSize: 22,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
}),
    [colors, typography, gradients],
  );


  const enabledCount = Object.values(settings).filter(Boolean).length;

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>PFLEGE · EINSTELLUNGEN</Text>
          <Text style={styles.title}>Modul-Konfiguration</Text>
          <Text style={styles.meta}>
            {enabledCount} von {Object.keys(settings).length} Funktionen aktiv
          </Text>
          <Text style={styles.subtitle}>
            SIS, Vitalwarnungen, Wunddokumentation und MDK-Export — mandantenspezifisch.
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>⚙️</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
        {!isPflegeSettingsLiveReady() ? (
          <PremiumBadge label="Teilweise live" variant="orange" dot />
        ) : null}
      </View>
    </PremiumListHeroFrame>
  );
}

export { PFLEGE_SETTINGS_PREPARED_MESSAGE };

const iconSize = designTokens.hero.iconBadgeSize;

