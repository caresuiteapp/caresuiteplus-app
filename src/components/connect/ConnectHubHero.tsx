import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumListHeroFrame } from '@/components/ui';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { ROLE_LABELS } from '@/data/demo';
import { isConnectLiveReady } from '@/lib/connect';
import type { ConnectCategory } from '@/types/modules/connect';
import type { RoleKey } from '@/types';
import { designTokens, spacing } from '@/theme';

type ConnectHubHeroProps = {
  categories: ConnectCategory[];
  roleKey: RoleKey;
};

export function ConnectHubHero({ categories, roleKey }: ConnectHubHeroProps) {
  const { colors, typography } = useLegacyTheme();
  const integrationCount = categories.reduce(
    (sum, category) => sum + category.integrations.filter((item) => item.readiness !== 'disabled').length,
    0,
  );

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
          backgroundColor: colors.bgElevated,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: 'rgba(98,243,255,0.35)',
        },
        iconText: { fontSize: 22 },
        badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
      }),
    [colors, typography],
  );

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>BUSINESS · CONNECT</Text>
          <Text style={styles.title}>CareSuite+ Connect</Text>
          <Text style={styles.meta}>
            {categories.length} Kategorien · {integrationCount} Schnittstellen
          </Text>
          <Text style={styles.subtitle}>
            Abrechnung, Zahlungen, TI, Kommunikation und Partner — zentral im Katalog.
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🔗</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {!isConnectLiveReady() ? (
          <PremiumBadge statusKind="preparedOnly" label="Connect in Vorbereitung" dot />
        ) : (
          <PremiumBadge statusKind="live" dot />
        )}
      </View>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;
