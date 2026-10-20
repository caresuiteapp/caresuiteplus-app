import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EnrollmentsListHero } from './EnrollmentsListHero';
import { EnrollmentsListTable } from './EnrollmentsListTable';
import { ModuleExtensionNavStrip } from '@/components/navigation/ModuleExtensionNavStrip';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumCard } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { fetchEnrollmentList } from '@/lib/akademie/moduleExtensionService';
import type { EnrollmentListItem } from '@/types/modules/akademie';
import { colors, spacing, typography } from '@/theme';

function EnrollmentCard({ item, onPress }: { item: EnrollmentListItem; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <PremiumCard style={styles.card} accentColor="#FFD166">
        <Text style={styles.title}>{item.participantName}</Text>
        <Text style={styles.meta}>{item.courseTitle}</Text>
        <Text style={styles.meta}>Fortschritt: {item.progressPercent} %</Text>
        <PremiumBadge label={item.status} variant="muted" />
      </PremiumCard>
    </Pressable>
  );
}

export function EnrollmentsListView() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'akademie_admin';
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode, setViewMode } = useDesktopListViewPreference('akademie.enrollments');
  const useTableLayout = isDesktop && viewMode === 'table';

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchEnrollmentList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const items = query.data ?? [];

  const handlePress = (id: string) => {
    router.push(`/akademie/teilnehmer/${id}` as never);
  };

  const header = (
    <View style={styles.header}>
      <EnrollmentsListHero
        items={items}
        roleKey={roleKey}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showViewToggle={isDesktop}
      />
      <ModuleExtensionNavStrip productKey="akademie" currentPath="/akademie/teilnehmer" />
    </View>
  );

  if (query.loading && items.length === 0) {
    return <LoadingState message="Teilnahmen werden geladen…" />;
  }

  if (query.error && items.length === 0) {
    return <ErrorState message={query.error} onRetry={query.refresh} />;
  }

  if (useTableLayout) {
    return (
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={query.refreshing} onRefresh={query.refresh} tintColor={colors.primary} />
        }
      >
        {header}
        {items.length === 0 ? (
          <EmptyState title="Keine Teilnahmen" message="Es sind keine Kurseinschreibungen hinterlegt." />
        ) : (
          <EnrollmentsListTable items={items} onItemPress={handlePress} />
        )}
        <Text style={styles.footer}>{items.length} Teilnahmen · {roleLabel ?? 'Demo'}</Text>
      </ScrollView>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <EmptyState title="Keine Teilnahmen" message="Es sind keine Kurseinschreibungen hinterlegt." />
      }
      renderItem={({ item }) => <EnrollmentCard item={item} onPress={() => handlePress(item.id)} />}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={query.refreshing} onRefresh={query.refresh} tintColor={colors.primary} />
      }
    />
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.sm, gap: spacing.sm },
  list: { paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.sm },
  title: { ...typography.h3, marginBottom: spacing.xs },
  meta: { ...typography.caption, color: colors.textMuted, marginBottom: 4 },
  footer: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md },
});
