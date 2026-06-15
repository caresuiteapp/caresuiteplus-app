import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FollowUpsListHero } from './FollowUpsListHero';
import { FollowUpsListTable } from './FollowUpsListTable';
import { ModuleExtensionNavStrip } from '@/components/navigation/ModuleExtensionNavStrip';
import { EmptyState, PremiumBadge, PremiumCard } from '@/components/ui';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import type { FollowUp } from '@/types/modules/beratung';
import type { RoleKey } from '@/types';
import { colors, spacing, typography } from '@/theme';

type FollowUpsListViewProps = {
  items: FollowUp[];
  roleKey: RoleKey;
  refreshing: boolean;
  onRefresh: () => void;
};

function FollowUpCard({ item, onPress }: { item: FollowUp; onPress: () => void }) {
  return (
    <PremiumCard style={styles.card} accentColor={colors.warning} onPress={onPress}>
      <Text style={styles.title}>{item.caseSubject}</Text>
      <Text style={styles.meta}>
        Fällig: {new Date(item.dueAt).toLocaleDateString('de-DE')} · {item.assigneeName}
      </Text>
      {item.note ? <Text style={styles.content}>{item.note}</Text> : null}
      <PremiumBadge label={item.status} variant="orange" />
    </PremiumCard>
  );
}

export function FollowUpsListView({ items, roleKey, refreshing, onRefresh }: FollowUpsListViewProps) {
  const router = useRouter();
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode, setViewMode } = useDesktopListViewPreference('beratung.followUps');
  const useTableLayout = isDesktop && viewMode === 'table';

  const handlePress = (id: string) => {
    router.push(`/beratung/wiedervorlagen/${id}` as never);
  };

  const header = (
    <View style={styles.header}>
      <FollowUpsListHero
        items={items}
        roleKey={roleKey}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showViewToggle={isDesktop}
      />
      <ModuleExtensionNavStrip productKey="beratung" currentPath="/beratung/wiedervorlagen" />
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
          <EmptyState title="Keine Wiedervorlagen" message="Alle Beratungsfälle sind ohne anstehende Fristen." />
        ) : (
          <FollowUpsListTable items={items} onItemPress={handlePress} />
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
        <EmptyState title="Keine Wiedervorlagen" message="Alle Beratungsfälle sind ohne anstehende Fristen." />
      }
      renderItem={({ item }) => <FollowUpCard item={item} onPress={() => handlePress(item.id)} />}
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
