import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { RoadmapListHero } from '@/components/roadmap';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumBadge,
  PremiumCard,
} from '@/components/ui';
import { useRoadmapList } from '@/hooks/useRoadmapHub';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { isRoadmapLiveReady, ROADMAP_PREPARED_MESSAGE } from '@/lib/roadmap/roadmapModuleConfig';
import { ROADMAP_PHASE_LABELS } from '@/types/roadmap';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

/** WP584 — Roadmap Liste */
export function RoadmapListScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { items, loading, error, refresh } = useRoadmapList();

  if (!can('roadmap.view')) {
    return (
      <ScreenShell title="Meilensteine" subtitle="Kein Zugriff" showBack>
        <LockedActionBanner
          message={check('roadmap.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Meilensteine" subtitle="Markteintritt" showBack>
      {loading && !items.length ? (
        <LoadingState message="Lädt…" />
      ) : error && !items.length ? (
        <ErrorState title="Fehler" message={error} onRetry={refresh} />
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
          contentContainerStyle={styles.scroll}
        >
          <RoadmapListHero items={items} roleKey={roleKey} />

          {!isRoadmapLiveReady() ? (
            <InfoBanner title="Live-Sync in Vorbereitung" message={ROADMAP_PREPARED_MESSAGE} />
          ) : null}

          {!items.length ? (
            <EmptyState title="Keine Meilensteine" message="Roadmap ist leer." />
          ) : (
            items.map((item) => (
              <PremiumCard key={item.id} onPress={() => router.push(`/business/roadmap/${item.id}` as never)}>
                <View style={styles.row}>
                  <Text style={styles.title}>{item.title}</Text>
                  <PremiumBadge label={ROADMAP_PHASE_LABELS[item.phase]} variant="cyan" />
                </View>
                <Text style={styles.meta}>
                  {item.quarter} · {WORKFLOW_STATUS_LABELS[item.status]}
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
