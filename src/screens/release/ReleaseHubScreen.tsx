import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ReleaseHubHero } from '@/components/release';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
} from '@/components/ui';
import { useReleaseHub } from '@/hooks/useReleaseHub';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { wp538A11y } from '@/lib/a11y/wp538-release';
import { isReleaseLiveReady, RELEASE_PREPARED_MESSAGE } from '@/lib/release/releaseModuleConfig';
import { colors, spacing, typography } from '@/theme';

/** WP523 — Release Hub Dashboard */
export function ReleaseHubScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { data, loading, error, refresh } = useReleaseHub();

  if (!can('release.view')) {
    return (
      <ScreenShell title="Release" subtitle={roleLabel ?? 'Betrieb'} showBack={false} a11yMeta={wp538A11y}>
        <LockedActionBanner message={check('release.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </ScreenShell>
    );
  }

  if (loading && !data) {
    return (
      <ScreenShell title="Release" subtitle="WP 523" showBack={false} a11yMeta={wp538A11y}>
        <LoadingState message="Release-Status wird geladen…" />
      </ScreenShell>
    );
  }

  if (error && !data) {
    return (
      <ScreenShell title="Release" subtitle="Fehler" showBack={false} a11yMeta={wp538A11y}>
        <ErrorState title="Release" message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  const manifest = data!.manifest;

  return (
    <ScreenShell
      title="Release & Deployment"
      subtitle={`v${manifest.appVersion} (${manifest.buildNumber})`}
      showBack={false}
      a11yMeta={wp538A11y}
      rightSlot={
        <PremiumButton title="Liste" size="sm" variant="ghost" onPress={() => router.push('/business/release/list' as never)} />
      }
    >
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.scroll}
      >
        <ReleaseHubHero data={data!} roleKey={roleKey} />

        {!isReleaseLiveReady() ? (
          <InfoBanner title="Live-Deployment in Vorbereitung" message={RELEASE_PREPARED_MESSAGE} />
        ) : null}

        <PremiumCard accentColor={colors.cyan}>
          <Text style={styles.sectionTitle}>Version Manifest</Text>
          <Text style={styles.meta}>Kanal: {manifest.channel}</Text>
          <Text style={styles.meta}>Commit: {manifest.gitCommit}</Text>
          <Text style={styles.meta}>Released: {new Date(manifest.releasedAt).toLocaleDateString('de-DE')}</Text>
        </PremiumCard>

        <Text style={styles.sectionTitle}>Umgebungsprofile</Text>
        {data!.envProfiles.map((env) => (
          <PremiumCard key={env.key} accentColor={colors.orange}>
            <View style={styles.row}>
              <Text style={styles.title}>{env.label}</Text>
              <PremiumBadge label={env.key} variant="cyan" />
            </View>
            <Text style={styles.meta}>{env.apiBaseUrl}</Text>
            <Text style={styles.meta}>{env.featuresEnabled.join(', ')}</Text>
          </PremiumCard>
        ))}

        <PremiumButton
          title="Neues Release anlegen"
          onPress={() => router.push('/business/release/create' as never)}
          disabled={!can('release.manage')}
        />
        <PremiumButton
          title="Pilot-Readiness (rm-001)"
          variant="secondary"
          onPress={() => router.push('/business/ops/pilot-readiness' as never)}
        />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  sectionTitle: { ...typography.bodyStrong, marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.xs },
  title: { ...typography.bodyStrong, flex: 1 },
  meta: { ...typography.caption, color: colors.textSecondary, marginBottom: 2 },
});
