import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { InsightExportsListHero } from './InsightExportsListHero';
import { InsightExportsListTable } from './InsightExportsListTable';
import { EmptyState, InfoBanner, PremiumBadge, PremiumCard } from '@/components/ui';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { INSIGHT_PREPARED_MESSAGE, isInsightLiveReady } from '@/lib/insight';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import type { InsightExportItem } from '@/types/modules/insight';
import type { RoleKey } from '@/types';
import { colors, spacing, typography } from '@/theme';

type InsightExportsListViewProps = {
  items: InsightExportItem[];
  roleKey: RoleKey;
  loading: boolean;
  onRefresh: () => void;
};

function ExportCard({ item, onPress }: { item: InsightExportItem; onPress: () => void }) {
  return (
    <PremiumCard style={styles.card} accentColor={colors.violet} onPress={onPress}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.meta}>
        {item.format.toUpperCase()} · {item.scheduleLabel}
      </Text>
      <PremiumBadge
        label={item.status === 'planned' ? 'Geplant' : 'Pausiert'}
        variant="muted"
      />
    </PremiumCard>
  );
}

export function InsightExportsListView({
  items,
  roleKey,
  loading,
  onRefresh,
}: InsightExportsListViewProps) {
  const router = useRouter();
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode, setViewMode } = useDesktopListViewPreference('insight.exports');
  const useTableLayout = isDesktop && viewMode === 'table';

  const handlePress = (id: string) => {
    router.push(`/insight/exports/${id}` as never);
  };

  const header = (
    <View style={styles.header}>
      <InsightExportsListHero
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
            title="Keine Exporte"
            message="Geplante CSV- und PDF-Exporte erscheinen hier, sobald der Scheduler angebunden ist."
          />
        ) : (
          <InsightExportsListTable items={items} onItemPress={handlePress} />
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
          title="Keine Exporte"
          message="Geplante CSV- und PDF-Exporte erscheinen hier, sobald der Scheduler angebunden ist."
        />
      }
      renderItem={({ item }) => (
        <ExportCard item={item} onPress={() => handlePress(item.id)} />
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
  meta: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
});
