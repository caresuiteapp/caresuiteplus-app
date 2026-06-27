import { useEffect } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { AdaptiveCardGrid } from '@/components/adaptive';
import { CareSuiteLogo } from '@/components/brand';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { OfflineNotice } from '@/components/ui/OfflineNotice';
import { AppScreen, FooterLinks, PortalCard } from '@/design/components';
import { useAuthFlowTypography } from '@/design/tokens/authTypography';
import { careSpacing } from '@/design/tokens/spacing';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useAuth } from '@/lib/auth/context';
import { resolveAuthSessionTarget } from '@/lib/auth/sessionTarget';
import { useSupabaseSessionProbe } from '@/lib/auth/useSupabaseSessionProbe';
import { fetchAppStartSnapshot } from '@/lib/landing/appStartService';
import { shouldShowPortalChoice } from '@/lib/navigation/sessionRouting';

const LANDING_HEADLINE =
  'CareSuite+ Software\nfür Office, Assist, Pflege, Stationär,\nBeratung und Akademie';

const LANDING_MAX_WIDTH = 520;

export function AppStartScreen() {
  const router = useRouter();
  const { authReady, authMode, isAuthenticated, profile, portalSession, user, session } =
    useAuth();
  const sessionPending = useSupabaseSessionProbe(authMode, authReady, isAuthenticated);
  const { isPhone, isDesktopOrWide } = useDeviceClass();
  const type = useAuthFlowTypography();

  const entriesQuery = useAsyncQuery(() => fetchAppStartSnapshot(), []);
  const mainEntries = entriesQuery.data ?? [];
  const { homePath, canRedirectHome } = resolveAuthSessionTarget({
    profile,
    portalSession,
    user,
    session,
  });
  const showPortalChoice = shouldShowPortalChoice(isAuthenticated);

  useEffect(() => {
    if (!authReady || sessionPending || !isAuthenticated || !canRedirectHome) return;
    router.replace(homePath as never);
  }, [authReady, canRedirectHome, homePath, isAuthenticated, router, sessionPending]);

  useEffect(() => {
    if (!isAuthenticated || !canRedirectHome) return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace(homePath as never);
      return true;
    });

    return () => subscription.remove();
  }, [canRedirectHome, homePath, isAuthenticated, router]);

  useEffect(() => {
    if (!showPortalChoice) return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => false);
    return () => subscription.remove();
  }, [showPortalChoice]);

  if (!authReady || sessionPending) {
    return (
      <AppScreen scroll={false}>
        <LoadingState message="CareSuite+ wird geladen…" />
      </AppScreen>
    );
  }

  if (isAuthenticated && canRedirectHome) {
    return <Redirect href={homePath as never} />;
  }

  if (isAuthenticated) {
    return (
      <AppScreen scroll={false}>
        <LoadingState message="Weiterleitung zum Dashboard…" />
      </AppScreen>
    );
  }

  if (entriesQuery.loading && mainEntries.length === 0) {
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

  const logoSize = isPhone ? 'xl' : isDesktopOrWide ? 'hero' : 'xxl';

  const entryCards = mainEntries.map((entry, index) => (
    <PortalCard
      key={entry.path}
      iconKey={entry.iconKey}
      title={entry.label}
      description={entry.description}
      accentColor={entry.accentColor}
      enterIndex={index}
      onPress={() => router.push(entry.path as never)}
    />
  ));

  const heroBlock = (
    <View style={styles.hero}>
      <View style={styles.logoTop}>
        <CareSuiteLogo size={logoSize} />
      </View>
      <Text style={[type.h2, styles.headline]} numberOfLines={6}>
        {LANDING_HEADLINE}
      </Text>
    </View>
  );

  const cardsBlock =
    entryCards.length === 0 ? (
      <EmptyState title="Keine Einträge" message="Bitte versuchen Sie es später erneut." />
    ) : (
      <AdaptiveCardGrid style={styles.cardGrid}>{entryCards}</AdaptiveCardGrid>
    );

  return (
    <AppScreen maxWidth={LANDING_MAX_WIDTH} contentStyle={styles.screenContent}>
      <OfflineNotice />
      <View style={styles.landing}>
        {heroBlock}
        {cardsBlock}
      </View>
      <FooterLinks />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    alignItems: 'center',
  },
  landing: {
    width: '100%',
    alignItems: 'center',
    gap: careSpacing.md,
  },
  hero: {
    width: '100%',
    alignItems: 'center',
    gap: careSpacing.md,
    marginBottom: careSpacing.sm,
  },
  logoTop: {
    alignItems: 'center',
    marginBottom: careSpacing.xs,
  },
  headline: {
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'center',
  },
  cardGrid: {
    width: '100%',
    maxWidth: LANDING_MAX_WIDTH,
    alignSelf: 'center',
  },
});
