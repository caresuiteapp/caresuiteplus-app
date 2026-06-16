import { useEffect, useMemo } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AdaptiveCardGrid } from '@/components/adaptive';
import { CareSuiteLogo, CareSuiteWordmark } from '@/components/brand';
import { EmptyState, ErrorState, LoadingState, OfflineNotice } from '@/components/ui';
import { AppScreen, FooterLinks, PortalCard } from '@/design/components';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { careSpacing } from '@/design/tokens/spacing';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useAuth } from '@/lib/auth/context';
import { fetchAppStartSnapshot } from '@/lib/landing/appStartService';
import { resolveSessionHomeRoute, shouldShowPortalChoice } from '@/lib/navigation/sessionRouting';

export function AppStartScreen() {
  const router = useRouter();
  const { isInitialized, isLoading, isAuthenticated, profile, portalSession } = useAuth();
  const { isPhone, isDesktopOrWide, width } = useDeviceClass();
  const type = useMemo(() => resolveGalaxyTypography(width), [width]);

  const entriesQuery = useAsyncQuery(() => fetchAppStartSnapshot(), []);
  const mainEntries = entriesQuery.data ?? [];
  const homePath = String(
    resolveSessionHomeRoute(profile?.roleKey ?? null, portalSession),
  );
  const showPortalChoice = shouldShowPortalChoice(isAuthenticated);

  useEffect(() => {
    if (!isInitialized || isLoading || !isAuthenticated) return;
    router.replace(homePath as never);
  }, [homePath, isAuthenticated, isInitialized, isLoading, router]);

  useEffect(() => {
    if (!showPortalChoice) return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => false);
    return () => subscription.remove();
  }, [showPortalChoice]);

  if (!isInitialized || isLoading || isAuthenticated) {
    return (
      <AppScreen scroll={false}>
        <LoadingState message="CareSuite+ wird geladen…" />
      </AppScreen>
    );
  }

  if ((entriesQuery.loading || isLoading) && mainEntries.length === 0) {
    return (
      <AppScreen scroll={false}>
        <LoadingState message="CareSuite+ wird geladen…" />
      </AppScreen>
    );
  }

  if (entriesQuery.error && mainEntries.length === 0) {
    return (
      <AppScreen scroll={false}>
        <ErrorState message={entriesQuery.error} onRetry={entriesQuery.refresh} />
      </AppScreen>
    );
  }

  const entryCards = mainEntries.map((entry) => (
    <PortalCard
      key={entry.path}
      icon={entry.icon}
      title={entry.label}
      description={entry.description}
      accentColor={entry.accentColor}
      onPress={() => router.push(entry.path as never)}
    />
  ));

  const heroBlock = (
    <View style={styles.hero}>
      {isPhone ? (
        <View style={styles.logoTop}>
          <CareSuiteLogo size="lg" />
        </View>
      ) : (
        <CareSuiteWordmark size={isDesktopOrWide ? 'lg' : 'md'} />
      )}
      <Text style={[type.h2, styles.claim]} numberOfLines={2}>
        CareSuite+
      </Text>
      <Text style={[type.body, styles.claimSub]} numberOfLines={3}>
        Wählen Sie Ihren Zugang — Verwaltung, Mitarbeitende oder Klient:innen.
      </Text>
    </View>
  );

  const cardsBlock =
    entryCards.length === 0 ? (
      <EmptyState title="Keine Einträge" message="Bitte versuchen Sie es später erneut." />
    ) : (
      <AdaptiveCardGrid>{entryCards}</AdaptiveCardGrid>
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
    <AppScreen maxWidth={1200}>
      <OfflineNotice />
      {layoutBody}
      <FooterLinks />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: careSpacing.md, marginBottom: careSpacing.sm },
  logoTop: { alignItems: 'center', marginBottom: careSpacing.xs },
  claim: { flexShrink: 1, minWidth: 0 },
  claimSub: { flexShrink: 1, minWidth: 0 },
  desktopRow: { flexDirection: 'row', gap: careSpacing.xl, alignItems: 'flex-start' },
  desktopHero: { flex: 1, minWidth: 280, maxWidth: 420 },
  desktopCards: { flex: 1.2, minWidth: 320 },
  tabletRow: { flexDirection: 'row', gap: careSpacing.lg, alignItems: 'flex-start' },
  tabletHero: { flex: 1, minWidth: 240, maxWidth: 360 },
  tabletCards: { flex: 1.1, minWidth: 280 },
});
