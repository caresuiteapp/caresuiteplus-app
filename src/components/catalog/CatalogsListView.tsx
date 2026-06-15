import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CatalogsListHero } from './CatalogsListHero';
import { CatalogsListTable } from './CatalogsListTable';
import { EmptyState, PremiumBadge, PremiumCard } from '@/components/ui';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { CATALOG_TYPE_LABELS } from '@/types/modules/catalog';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import type { CatalogListItem } from '@/types/modules/catalog';
import type { RoleKey } from '@/types';
import { colors, spacing, typography } from '@/theme';

type CatalogsListViewProps = {
  items: CatalogListItem[];
  roleKey: RoleKey;
  loading: boolean;
  onRefresh: () => void;
};

function CatalogCard({ item, onPress }: { item: CatalogListItem; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <PremiumCard accentColor={colors.orange}>
        <View style={styles.row}>
          <Text style={styles.title}>{item.name}</Text>
          <PremiumBadge label={CATALOG_TYPE_LABELS[item.catalogType]} variant="muted" />
        </View>
        {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
        <Text style={styles.meta}>
          {item.itemCount} Positionen · {WORKFLOW_STATUS_LABELS[item.status]}
        </Text>
      </PremiumCard>
    </Pressable>
  );
}

export function CatalogsListView({ items, roleKey, loading, onRefresh }: CatalogsListViewProps) {
  const router = useRouter();
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode, setViewMode } = useDesktopListViewPreference('office.catalogs');
  const useTableLayout = isDesktop && viewMode === 'table';

  const handlePress = (id: string) => {
    router.push(`/office/catalogs/${id}` as never);
  };

  const header = (
    <CatalogsListHero
      items={items}
      roleKey={roleKey}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      showViewToggle={isDesktop}
    />
  );

  if (useTableLayout) {
    return (
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {header}
        {items.length === 0 ? (
          <EmptyState title="Keine Kataloge" message="Es sind keine Kataloge angelegt." />
        ) : (
          <CatalogsListTable items={items} onItemPress={handlePress} />
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
        <EmptyState title="Keine Kataloge" message="Es sind keine Kataloge angelegt." />
      }
      renderItem={({ item }) => (
        <CatalogCard item={item} onPress={() => handlePress(item.id)} />
      )}
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    />
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
  desc: { ...typography.caption, color: colors.textSecondary },
  meta: { ...typography.caption, marginTop: spacing.xs },
});
