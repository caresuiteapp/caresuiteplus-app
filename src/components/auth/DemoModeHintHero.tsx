import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumListHeroFrame } from '@/components/ui';
import { defaultPublicVisibility } from '@/lib/ui/uiVisibility';
import { designTokens, spacing } from '@/theme';

export function DemoModeHintHero() {
  const { colors, typography } = useLegacyTheme();
  const visibility = useMemo(() => defaultPublicVisibility(), []);
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
    [colors, typography],
  );

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>DEMO</Text>
          <Text style={styles.title}>Demo mit Beispieldaten</Text>
          <Text style={styles.meta}>
            Der Demo-Modus ist derzeit nicht aktiv. Nutzen Sie den Mandantenzugang oder kontaktieren Sie den Support.
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>ℹ️</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label="Demo nicht verfügbar" variant="orange" dot />
        {visibility.showPrototypeInfo ? (
          <PremiumBadge label="Interner Pilotbetrieb" variant="cyan" />
        ) : null}
      </View>
      {visibility.showDeveloperDiagnostics ? (
        <Text style={styles.hint}>
          Entwickler: Setzen Sie EXPO_PUBLIC_DEMO_MODE=true in .env und starten Sie die App neu.
        </Text>
      ) : (
        <Text style={styles.hint}>
          Für eine geführte Demo wenden Sie sich an Ihre Ansprechperson oder nutzen Sie den Unternehmens-Login.
        </Text>
      )}
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;
