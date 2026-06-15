import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { InsightDataSourcesListHero } from './InsightDataSourcesListHero';
import { InsightDataSourcesListTable } from './InsightDataSourcesListTable';
import { EmptyState, InfoBanner, PremiumBadge, PremiumCard } from '@/components/ui';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { INSIGHT_PREPARED_MESSAGE, isInsightLiveReady } from '@/lib/insight';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import type { InsightDataSourceItem } from '@/types/modules/insight';
import type { RoleKey } from '@/types';
import { colors, spacing, typography } from '@/theme';

type InsightDataSourcesListViewProps = {
  items: InsightDataSourceItem[];
  roleKey: RoleKey;
  loading: boolean;
  onRefresh: () => void;
};

function DataSourceCard({ item, onPress }: { item: InsightDataSourceItem; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <PremiumCard style={styles.card} accentColor="#2563EB">
        <Text style={styles.title}>{item.label}</Text>
        <Text style={styles.meta}>Modul: {item.moduleKey}</Text>
        <PremiumBadge label={item.connectionStatus} variant="muted" />
      </PremiumCard>
    </Pressable>
  );
}

export function InsightDataSourcesListView({
  items,
  roleKey,
  loading,
  onRefresh,
}: InsightDataSourcesListViewProps) {
  const router = useRouter();
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode, setViewMode } = useDesktopListViewPreference('insight.dataSources');
  const useTableLayout = isDesktop && viewMode === 'table';

  const handlePress = (id: string) => {
    router.push(`/insight/data-sources/${id}` as never);
  };

  const header = (
    <View style={styles.header}>
      <InsightDataSourcesListHero
        items={items}
        roleKey={roleKey}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showViewToggle={isDesktop}
      />
      {!isInsightLiveReady() ? (
        <InfoBanner title="Modul in Vorbereitung" message={INSIGHT_PREPARED_MESSAGE} />
      ) : null}
    </View>
  );

  if (useTableLayout) {
    return (
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {header}
        {items.length === 0 ? (
          <EmptyState title="Keine Datenquellen" message="Es sind keine KPI-Feeds konfiguriert." />
        ) : (
          <InsightDataSourcesListTable items={items} onItemPress={handlePress} />
        )}
      </ScrollView>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <EmptyState title="Keine Datenquellen" message="Es sind keine KPI-Feeds konfiguriert." />
      }
      renderItem={({ item }) => <DataSourceCard item={item} onPress={() => handlePress(item.id)} />}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    />
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.sm, gap: spacing.sm },
  list: { paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.sm },
  title: { ...typography.h3, marginBottom: spacing.xs },
  meta: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
});
