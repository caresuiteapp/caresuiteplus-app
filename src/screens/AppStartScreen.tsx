import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AdaptiveCardGrid } from '@/components/adaptive';
import {
  CareBotCard,
  CareSuiteLightBackground,
  CareSuiteLogo,
  CareSuiteWordmark,
  VoiceFlowPanel,
} from '@/components/brand';
import { AppStartFooter, CareAdaptiveShell } from '@/components/layout';
import {
  CareLightButton,
  CareLightCard,
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumInput,
} from '@/components/ui';
import { resolveCareSuitePalette } from '@/design/tokens/colors';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { useThemeMode } from '@/design/ThemeModeProvider';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useAuth } from '@/lib/auth/context';
import { fetchAppStartSnapshot } from '@/lib/landing/appStartService';
import { isDemoMode } from '@/lib/supabase/config';
import { moduleColor } from '@/design/tokens/modules';

export function AppStartScreen() {
  const router = useRouter();
  const { signInDemo, isLoading } = useAuth();
  const [demoError, setDemoError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { isPhone, isTablet, isDesktopOrWide } = useDeviceClass();
  const { mode } = useThemeMode();
  const palette = resolveCareSuitePalette(mode);
  const demoMode = isDemoMode();
  const officeAccent = moduleColor('office');

  const entriesQuery = useAsyncQuery(() => fetchAppStartSnapshot(), []);

  const mainEntries = useMemo(() => {
    const entries = entriesQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) => e.label.toLowerCase().includes(q) || e.description.toLowerCase().includes(q),
    );
  }, [entriesQuery.data, search]);

  const openDemoDashboard = async () => {
    setDemoError(null);
    try {
      await signInDemo('business_admin');
      router.replace('/business' as never);
    } catch {
      router.push('/auth/demo' as never);
    }
  };

  if ((entriesQuery.loading || isLoading) && mainEntries.length === 0) {
    return (
      <CareAdaptiveShell area="business" bare>
        <CareSuiteLightBackground>
          <LoadingState message="CareSuite+ wird geladen…" />
        </CareSuiteLightBackground>
      </CareAdaptiveShell>
    );
  }

  if (entriesQuery.error && mainEntries.length === 0) {
    return (
      <CareAdaptiveShell area="business" bare>
        <CareSuiteLightBackground>
          <ErrorState message={entriesQuery.error} onRetry={entriesQuery.refresh} />
        </CareSuiteLightBackground>
      </CareAdaptiveShell>
    );
  }

  const entryCards = mainEntries.map((entry) => (
    <CareLightCard
      key={entry.path}
      accentColor={entry.accentColor}
      onPress={() => router.push(entry.path as never)}
    >
      <Text style={styles.icon}>{entry.icon}</Text>
      <Text style={[styles.cardTitle, { color: palette.text.primary }]} numberOfLines={2}>
        {entry.label}
      </Text>
      <Text style={[styles.cardDescription, { color: palette.text.secondary }]} numberOfLines={3}>
        {entry.description}
      </Text>
    </CareLightCard>
  ));

  const demoCard = demoMode ? (
    <CareLightCard accentColor={moduleColor('assist')} onPress={() => void openDemoDashboard()}>
      <Text style={styles.icon}>🎯</Text>
      <Text style={[styles.cardTitle, { color: palette.text.primary }]} numberOfLines={2}>
        Demo mit Beispieldaten ansehen
      </Text>
      <Text style={[styles.cardDescription, { color: palette.text.secondary }]} numberOfLines={3}>
        CareSuite+ ohne Passwort mit Beispieldaten erkunden.
      </Text>
    </CareLightCard>
  ) : null;

  const allCards = demoCard ? [...entryCards, demoCard] : entryCards;

  const heroBlock = (
    <View style={styles.hero}>
      {isPhone ? (
        <View style={styles.logoTop}>
          <CareSuiteLogo size="lg" />
        </View>
      ) : (
        <CareSuiteWordmark size={isDesktopOrWide ? 'lg' : 'md'} />
      )}
      <Text style={[styles.claim, { color: palette.text.primary }]}>
        CareSuite+ — für alle Organisationen
      </Text>
      <Text style={[styles.claimSub, { color: palette.text.secondary }]}>
        Office inklusive · Module aktivieren · Jetzt registrieren
      </Text>
      <PremiumInput
        label="Modul suchen"
        value={search}
        onChangeText={setSearch}
        placeholder="Assist, Pflege, Office…"
      />
      {(isTablet || isDesktopOrWide) && (
        <View style={styles.illustrationArea}>
          <CareBotCard compact={isTablet} />
          <VoiceFlowPanel compact={isTablet} onStart={() => router.push('/assist' as never)} />
        </View>
      )}
      {isDesktopOrWide ? (
        <View style={[styles.brandStripe, { borderColor: `${officeAccent}33` }]}>
          <Text style={[styles.brandStripeText, { color: palette.brand.orange }]}>
            CareSuite+ Plattform — adaptiv auf Phone, Tablet, Desktop und Web
          </Text>
        </View>
      ) : null}
    </View>
  );

  const cardsBlock =
    allCards.length === 0 ? (
      <EmptyState title="Keine Einträge" message="Passen Sie die Suche an oder starten Sie die Demo." />
    ) : (
      <AdaptiveCardGrid>{allCards}</AdaptiveCardGrid>
    );

  const layoutBody = isPhone ? (
    <>
      {heroBlock}
      {cardsBlock}
    </>
  ) : isDesktopOrWide ? (
    <View style={styles.desktopRow}>
      <View style={styles.desktopHero}>{heroBlock}</View>
      <View style={styles.desktopCards}>{cardsBlock}</View>
    </View>
  ) : (
    <View style={styles.tabletRow}>
      <View style={styles.tabletHero}>{heroBlock}</View>
      <View style={styles.tabletCards}>{cardsBlock}</View>
    </View>
  );

  return (
    <CareAdaptiveShell area="business" bare>
      <CareSuiteLightBackground>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { padding: isPhone ? careSpacing.md : careSpacing.lg },
          ]}
        >
          {demoMode ? (
            <View style={styles.demoRow}>
              <PremiumBadge label="Demo-Modus aktiv" variant="cyan" dot />
              <CareLightButton
                title="Demo-Dashboard öffnen"
                variant="secondary"
                onPress={() => void openDemoDashboard()}
                loading={isLoading}
              />
              {demoError ? <ErrorState message={demoError} /> : null}
            </View>
          ) : null}
          {layoutBody}
          <AppStartFooter />
        </ScrollView>
      </CareSuiteLightBackground>
    </CareAdaptiveShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, gap: careSpacing.lg },
  demoRow: { gap: careSpacing.sm },
  hero: { gap: careSpacing.md, marginBottom: careSpacing.sm },
  logoTop: { alignItems: 'center', marginBottom: careSpacing.xs },
  claim: { ...careTypography.h3 },
  claimSub: { ...careTypography.body },
  illustrationArea: { gap: careSpacing.md, marginTop: careSpacing.sm },
  brandStripe: {
    marginTop: careSpacing.md,
    paddingVertical: careSpacing.sm,
    paddingHorizontal: careSpacing.md,
    borderLeftWidth: 3,
    borderRadius: 4,
  },
  brandStripeText: { ...careTypography.bodyStrong },
  desktopRow: { flexDirection: 'row', gap: careSpacing.xl, alignItems: 'flex-start' },
  desktopHero: { flex: 1, minWidth: 280, maxWidth: 420 },
  desktopCards: { flex: 1.2, minWidth: 320 },
  tabletRow: { flexDirection: 'row', gap: careSpacing.lg, alignItems: 'flex-start' },
  tabletHero: { flex: 1, minWidth: 240, maxWidth: 360 },
  tabletCards: { flex: 1.1, minWidth: 280 },
  icon: { fontSize: 28, marginBottom: careSpacing.xs },
  cardTitle: { ...careTypography.bodyStrong, marginBottom: careSpacing.xs },
  cardDescription: { ...careTypography.caption },
});
