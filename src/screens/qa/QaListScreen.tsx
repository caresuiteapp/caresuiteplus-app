import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { QaListHero } from '@/components/qa';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumCard } from '@/components/ui';
import { useQaList } from '@/hooks/useQaHub';
import { useAuth } from '@/lib/auth/context';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

/** WP564 — QA Listenansicht */
export function QaListScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { items, loading, error, refresh } = useQaList();

  return (
    <ScreenShell title="QA Triage" subtitle="Pilot, Bugs, Coverage" showBack>
      {loading && !items.length ? (
        <LoadingState message="Lädt…" />
      ) : error && !items.length ? (
        <ErrorState title="Fehler" message={error} onRetry={refresh} />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
          }
          contentContainerStyle={styles.scroll}
        >
          <QaListHero items={items} roleKey={roleKey} />
          {!items.length ? (
            <EmptyState title="Keine Einträge" message="Keine QA-Items." />
          ) : (
            items.map((item) => (
              <PremiumCard key={item.id} onPress={() => router.push(`/business/qa/${item.id}` as never)}>
                <View style={styles.row}>
                  <Text style={styles.title}>{item.title}</Text>
                  <PremiumBadge label={item.kind} variant="cyan" />
                </View>
                <Text style={styles.meta}>
                  {item.priority} · {WORKFLOW_STATUS_LABELS[item.status]}
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  title: { ...typography.bodyStrong, flex: 1 },
  meta: { ...typography.caption, color: colors.textSecondary },
});
