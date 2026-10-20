import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { ReleaseListHero } from '@/components/release';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumBadge,
  PremiumCard,
} from '@/components/ui';
import { useReleaseList } from '@/hooks/useReleaseHub';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { isReleaseLiveReady, RELEASE_PREPARED_MESSAGE } from '@/lib/release/releaseModuleConfig';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

/** WP524 — Release Listenansicht */
export function ReleaseListScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { items, loading, error, refresh } = useReleaseList();

  if (!can('release.view')) {
    return (
      <ScreenShell title="Releases" subtitle="Kein Zugriff" showBack>
        <LockedActionBanner
          message={check('release.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Releases" subtitle="Deployment-Checklisten" showBack>
      {loading && items.length === 0 ? (
        <LoadingState message="Releases werden geladen…" />
      ) : error && items.length === 0 ? (
        <ErrorState title="Fehler" message={error} onRetry={refresh} />
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
          contentContainerStyle={styles.scroll}
        >
          <ReleaseListHero items={items} roleKey={roleKey} />

          {!isReleaseLiveReady() ? (
            <InfoBanner title="Live-Deployment in Vorbereitung" message={RELEASE_PREPARED_MESSAGE} />
          ) : null}

          {items.length === 0 ? (
            <EmptyState title="Keine Releases" message="Noch keine Release-Pakete angelegt." />
          ) : (
            items.map((item) => (
              <PremiumCard
                key={item.id}
                accentColor={item.checklistDone === item.checklistTotal ? colors.success : colors.orange}
                onPress={() => router.push(`/business/release/${item.id}` as never)}
              >
                <View style={styles.row}>
                  <Text style={styles.title}>{item.title}</Text>
                  <PremiumBadge label={WORKFLOW_STATUS_LABELS[item.status]} variant="orange" />
                </View>
                <Text style={styles.meta}>
                  {item.env} · Checkliste {item.checklistDone}/{item.checklistTotal}
                </Text>
              </PremiumCard>
            ))
          )}
        </ScrollView>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.xs },
  title: { ...typography.bodyStrong, flex: 1 },
  meta: { ...typography.caption, color: colors.textSecondary },
});
