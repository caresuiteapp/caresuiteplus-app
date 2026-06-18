import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CareLightKpiCard, CareLightListHeroFrame, PremiumBadge } from '@/components/ui';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { isDemoMode } from '@/lib/supabase/config';
import { designTokens } from '@/theme';

type DemoLoginHeroProps = {
  title: string;
  subtitle: string;
  roleCount: number;
};

export function DemoLoginHero({ title, subtitle, roleCount }: DemoLoginHeroProps) {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        topRow: { flexDirection: 'row', gap: careSpacing.md },
        textCol: { flex: 1, gap: 2 },
        eyebrow: {
          ...careTypography.caption,
          color: careLightColors.orange,
          letterSpacing: designTokens.hero.eyebrowLetterSpacing,
          fontWeight: '700',
        },
        title: { ...careTypography.h2, color: careLightColors.navy },
        meta: { ...careTypography.caption, color: careLightColors.muted },
        iconBadge: {
          width: iconSize,
          height: iconSize,
          borderRadius: iconSize / 2,
          backgroundColor: `${careLightColors.orange}18`,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: careLightColors.border,
        },
        iconText: { fontSize: 22 },
        badges: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
        kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
        kpiItem: { flex: 1, minWidth: 100 },
        hint: { ...careTypography.caption, color: careLightColors.muted },
      }),
    [],
  );

  return (
    <CareLightListHeroFrame accentColor={careLightColors.orange}>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>AUTH · DEMO · EINSTIEG</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.meta}>{subtitle}</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🎭</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label="Demo-Zugang" variant="orange" dot />
        {isDemoMode() ? <PremiumBadge label="Demo-Modus aktiv" variant="cyan" /> : null}
        <PremiumBadge label="preparedOnly Auth" variant="muted" />
      </View>
      <View style={styles.kpiRow}>
        <CareLightKpiCard
          label="Rollen"
          value={String(roleCount)}
          subValue="Lokal wählbar"
          icon="👤"
          accentColor={careLightColors.orange}
          style={styles.kpiItem}
        />
        <CareLightKpiCard
          label="Session"
          value="Lokal"
          subValue="Kein Supabase"
          icon="💾"
          accentColor={careLightColors.cyan}
          style={styles.kpiItem}
        />
        <CareLightKpiCard
          label="Status"
          value="Prototyp"
          subValue="Kein Store-Release"
          icon="📋"
          accentColor={careLightColors.violet}
          style={styles.kpiItem}
        />
      </View>
      <Text style={styles.hint}>
        Demo-Anmeldung ohne Passwort — Session wird nur lokal simuliert. Für Live-Pilot Mandanten-Zugang
        nutzen.
      </Text>
    </CareLightListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;
