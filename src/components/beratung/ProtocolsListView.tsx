import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ProtocolsListHero } from './ProtocolsListHero';
import { ProtocolsListTable } from './ProtocolsListTable';
import { ModuleExtensionNavStrip } from '@/components/navigation/ModuleExtensionNavStrip';
import { EmptyState, PremiumBadge, PremiumCard } from '@/components/ui';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import type { Protocol } from '@/types/modules/beratung';
import type { RoleKey } from '@/types';
import { colors, spacing, typography } from '@/theme';

type ProtocolRow = Protocol & { caseSubject: string };

type ProtocolsListViewProps = {
  items: ProtocolRow[];
  roleKey: RoleKey;
  refreshing: boolean;
  onRefresh: () => void;
};

function ProtocolCard({ item, onPress }: { item: ProtocolRow; onPress: () => void }) {
  return (
    <PremiumCard style={styles.card} accentColor={colors.cyan} onPress={onPress}>
      <Text style={styles.title}>{item.caseSubject}</Text>
      <Text style={styles.meta}>{new Date(item.recordedAt).toLocaleDateString('de-DE')}</Text>
      <Text style={styles.content} numberOfLines={3}>
        {item.content}
      </Text>
      <PremiumBadge label={item.status} variant="muted" />
    </PremiumCard>
  );
}

export function ProtocolsListView({ items, roleKey, refreshing, onRefresh }: ProtocolsListViewProps) {
  const router = useRouter();
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode, setViewMode } = useDesktopListViewPreference('beratung.protocols');
  const useTableLayout = isDesktop && viewMode === 'table';

  const handlePress = (id: string) => {
    router.push(`/beratung/protokolle/${id}` as never);
  };

  const header = (
    <View style={styles.header}>
      <ProtocolsListHero
        items={items}
        roleKey={roleKey}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showViewToggle={isDesktop}
      />
      <ModuleExtensionNavStrip productKey="beratung" currentPath="/beratung/protokolle" />
    </View>
  );

  if (useTableLayout) {
    return (
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {header}
        {items.length === 0 ? (
          <EmptyState title="Keine Protokolle" message="Es sind noch keine Beratungsprotokolle dokumentiert." />
        ) : (
          <ProtocolsListTable items={items} onItemPress={handlePress} />
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
        <EmptyState title="Keine Protokolle" message="Es sind noch keine Beratungsprotokolle dokumentiert." />
      }
      renderItem={({ item }) => <ProtocolCard item={item} onPress={() => handlePress(item.id)} />}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
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
  content: { ...typography.body, marginBottom: spacing.sm },
});
