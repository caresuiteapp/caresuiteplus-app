import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightPageShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumCard } from '@/components/ui';
import { useQmChanges } from '@/hooks/qm';
import { usePermissions } from '@/hooks/usePermissions';
import { colors, spacing, typography } from '@/theme';

export function QmChangesScreen() {
  const { can, check, roleLabel } = usePermissions();
  const { data, loading, error, refresh } = useQmChanges();

  if (!can('qm.view')) {
    return (
      <CareLightPageShell title="Änderungen" showBack>
        <LockedActionBanner message={check('qm.view').reason ?? ''} roleLabel={roleLabel} />
      </CareLightPageShell>
    );
  }

  if (loading && !data) {
    return (
      <CareLightPageShell title="Änderungen" showBack>
        <LoadingState message="Änderungen werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (error && !data) {
    return (
      <CareLightPageShell title="Änderungen" showBack>
        <ErrorState title="Änderungen" message={error} onRetry={refresh} />
      </CareLightPageShell>
    );
  }

  const items = data ?? [];

  return (
    <CareLightPageShell title="Änderungsmanagement" subtitle={`${items.length} Änderungen`} showBack>
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.scroll}
      >
        {items.length === 0 ? (
          <EmptyState title="Keine Änderungen" message="" />
        ) : (
          items.map((ch) => (
            <PremiumCard key={ch.id} accentColor={colors.orange}>
              <Text style={styles.title}>{ch.title}</Text>
              <Text style={styles.meta}>{ch.changeType} · {ch.status}</Text>
              <Text style={styles.desc}>{ch.description}</Text>
            </PremiumCard>
          ))
        )}
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.bodyStrong, marginBottom: spacing.xs },
  meta: { ...typography.caption, color: colors.textMuted },
  desc: { ...typography.body, marginTop: spacing.xs },
});
