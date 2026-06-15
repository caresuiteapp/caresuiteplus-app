import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SecurityListHero } from '@/components/security';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumCard } from '@/components/ui';
import { useSecurityList } from '@/hooks/useSecurityHub';
import { useAuth } from '@/lib/auth/context';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

const SEV = { critical: 'red' as const, warning: 'orange' as const, info: 'cyan' as const };

/** WP544 — Security Listenansicht */
export function SecurityListScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { items, loading, error, refresh } = useSecurityList();

  return (
    <ScreenShell title="Security Findings" subtitle="DSGVO & Audit" showBack>
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
          <SecurityListHero items={items} roleKey={roleKey} />
          {!items.length ? (
            <EmptyState title="Keine Einträge" message="Keine Findings vorhanden." />
          ) : (
            items.map((item) => (
              <PremiumCard
                key={item.id}
                accentColor={colors.orange}
                onPress={() => router.push(`/business/security/${item.id}` as never)}
              >
                <View style={styles.row}>
                  <Text style={styles.title}>{item.title}</Text>
                  <PremiumBadge label={item.severity} variant={SEV[item.severity]} />
                </View>
                <Text style={styles.meta}>
                  {item.category} · {WORKFLOW_STATUS_LABELS[item.status]}
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
