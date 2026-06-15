import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { InsightSnapshotsListHero } from './InsightSnapshotsListHero';
import { InsightSnapshotsListTable } from './InsightSnapshotsListTable';
import { EmptyState, InfoBanner, PremiumBadge, PremiumCard } from '@/components/ui';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { INSIGHT_PREPARED_MESSAGE, isInsightLiveReady } from '@/lib/insight';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import type { InsightSnapshotItem } from '@/types/modules/insight';
import type { RoleKey } from '@/types';
import { colors, spacing, typography } from '@/theme';

type InsightSnapshotsListViewProps = {
  items: InsightSnapshotItem[];
  roleKey: RoleKey;
  loading: boolean;
  onRefresh: () => void;
};

function SnapshotCard({ item, onPress }: { item: InsightSnapshotItem; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <PremiumCard style={styles.card} accentColor="#2563EB">
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.meta}>{item.moduleLabel}</Text>
        <Text style={styles.date}>
          Aktualisiert {new Date(item.updatedAt).toLocaleDateString('de-DE')}
        </Text>
        <PremiumBadge label="preparedOnly" variant="muted" />
      </PremiumCard>
    </Pressable>
  );
}

export function InsightSnapshotsListView({
  items,
  roleKey,
  loading,
  onRefresh,
}: InsightSnapshotsListViewProps) {
  const router = useRouter();
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode, setViewMode } = useDesktopListViewPreference('insight.snapshots');
  const useTableLayout = isDesktop && viewMode === 'table';

  const handlePress = (id: string) => {
    router.push(`/insight/snapshots/${id}` as never);
  };

  const header = (
    <View style={styles.header}>
      <InsightSnapshotsListHero
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
          <EmptyState
            title="Keine Snapshots"
            message="Sobald Datenquellen angebunden sind, erscheinen hier gespeicherte KPI-Snapshots."
          />
        ) : (
          <InsightSnapshotsListTable items={items} onItemPress={handlePress} />
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
        <EmptyState
          title="Keine Snapshots"
          message="Sobald Datenquellen angebunden sind, erscheinen hier gespeicherte KPI-Snapshots."
        />
      }
      renderItem={({ item }) => (
        <SnapshotCard item={item} onPress={() => handlePress(item.id)} />
      )}
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
  meta: { ...typography.caption, color: colors.cyan, marginBottom: 4 },
  date: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
});
