import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { listThreads } from '@/features/communication/communication.service';
import { useRouter } from 'expo-router';
import { ConversationListItem } from '@/components/communication';
import { CommunicationArchivedHero } from '@/components/communication/CommunicationArchivedHero';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumCard, PremiumInput } from '@/components/ui';
import { useThreads } from '@/hooks/communication';
import { useAuth } from '@/lib/auth/context';
import { colors, spacing } from '@/theme';

export function ArchivedConversationsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { items, loading, refreshing, refresh } = useThreads({ filter: 'archived', includeArchived: true });

  return (
    <ScreenShell title="Archivierte Threads" subtitle="Kommunikation" scroll={false}>
      {loading && items.length === 0 ? <LoadingState message="Wird geladen…" /> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <CommunicationArchivedHero archivedCount={items.length} roleKey={roleKey} />
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.cyan} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState title="Keine archivierten Threads" />}
        renderItem={({ item }) => (
          <PremiumCard onPress={() => router.push(`/business/messages/${item.id}` as never)}>
            <ConversationListItem item={item} />
          </PremiumCard>
        )}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.md },
  list: { gap: spacing.md, paddingBottom: spacing.xxl },
});
