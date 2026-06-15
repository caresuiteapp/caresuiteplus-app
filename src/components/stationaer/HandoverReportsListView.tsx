import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { HandoverReportListHero } from './HandoverReportListHero';
import { HandoverReportListTable } from './HandoverReportListTable';
import { ModuleExtensionNavStrip } from '@/components/navigation/ModuleExtensionNavStrip';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumCard } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { fetchHandoverReports } from '@/lib/stationaer/moduleExtensionService';
import type { HandoverReportListItem } from '@/types/modules/stationaer';
import { colors, spacing, typography } from '@/theme';

function HandoverCard({ item, onPress }: { item: HandoverReportListItem; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <PremiumCard style={styles.card} accentColor={colors.amber}>
        <View style={styles.cardHeader}>
          <Text style={styles.title}>{item.shiftLabel}</Text>
          <PremiumBadge label={item.wing ?? 'Haus'} variant="cyan" />
        </View>
        <Text style={styles.meta}>
          {new Date(item.handoverAt).toLocaleString('de-DE')} · {item.authorName}
        </Text>
        <Text style={styles.content} numberOfLines={2}>
          {item.content}
        </Text>
        <PremiumBadge label={item.status} variant="muted" />
      </PremiumCard>
    </Pressable>
  );
}

export function HandoverReportsListView() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'nurse';
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode, setViewMode } = useDesktopListViewPreference('stationaer.handovers');
  const useTableLayout = isDesktop && viewMode === 'table';

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchHandoverReports(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const items = query.data ?? [];

  const handlePress = (id: string) => {
    router.push(`/stationaer/uebergabebericht/${id}` as never);
  };

  const header = (
    <View style={styles.header}>
      <HandoverReportListHero
        items={items}
        roleKey={roleKey}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showViewToggle={isDesktop}
      />
      <ModuleExtensionNavStrip productKey="stationaer" currentPath="/stationaer/uebergabebericht" />
    </View>
  );

  if (query.loading && items.length === 0) {
    return <LoadingState message="Übergaben werden geladen…" />;
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
          <EmptyState title="Keine Übergaben" message="Für den gewählten Zeitraum liegen keine Übergabeberichte vor." />
        ) : (
          <HandoverReportListTable items={items} onItemPress={handlePress} />
        )}
        <Text style={styles.footer}>{items.length} Übergaben · {roleLabel ?? 'Demo'}</Text>
      </ScrollView>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <EmptyState title="Keine Übergaben" message="Für den gewählten Zeitraum liegen keine Übergabeberichte vor." />
      }
      renderItem={({ item }) => <HandoverCard item={item} onPress={() => handlePress(item.id)} />}
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  title: { ...typography.h3, flex: 1 },
  meta: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
  content: { ...typography.body, marginBottom: spacing.sm },
  footer: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md },
});
