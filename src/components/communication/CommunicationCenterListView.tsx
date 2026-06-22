import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { CommunicationCenterListHero } from './CommunicationCenterListHero';
import { NewConversationModal } from './NewConversationModal';
import { CommunicationThreadListCard } from './CommunicationThreadListCard';
import { ConversationFilterBar, MessageSearchBar } from '@/components/communication';
import { LockedActionBanner } from '@/components/permissions';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
} from '@/components/ui';
import { buildCommunicationListKpis } from '@/lib/communication/communicationListStats';
import { COMMUNICATION_ACCENT } from '@/features/communication/communication.constants';
import { useCommunicationCenter, useCommunicationPermissions } from '@/hooks/communication';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { useAuth } from '@/lib/auth/context';
import { colors, spacing, typography } from '@/theme';

type CommunicationCenterListViewProps = {
  onThreadPress?: (threadId: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
};

export function CommunicationCenterListView({
  onThreadPress,
  selectedId = null,
  embedded = false,
}: CommunicationCenterListViewProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const perms = useCommunicationPermissions();
  const { shellVariant } = usePlatformLayout();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const [composeOpen, setComposeOpen] = useState(false);

  const {
    threads,
    loading,
    error,
    refreshing,
    filter,
    setFilter,
    filters,
    search,
    setSearch,
    refresh,
  } = useCommunicationCenter();

  const kpis = useMemo(() => buildCommunicationListKpis(threads), [threads]);
  const compactHero = embedded || shellVariant === 'desktop';
  const totalCount = threads.length;
  const filteredCount = threads.length;

  if (!perms.canViewCenter) {
    return (
      <LockedActionBanner message="Keine Berechtigung für das Kommunikationszentrum." />
    );
  }

  const toolbar = (
    <View style={styles.toolbar}>
      {embedded ? (
        <View style={styles.embeddedHeader}>
          <Text style={styles.embeddedTitle}>Kommunikationszentrum</Text>
          <Text style={styles.embeddedMeta}>
            {filteredCount} von {totalCount} Threads
          </Text>
        </View>
      ) : (
        <CommunicationCenterListHero
          kpis={kpis}
          roleKey={roleKey}
          filteredCount={filteredCount}
          totalCount={totalCount}
          isReadOnly={!perms.canCreateThread}
          compact={compactHero}
        />
      )}

      {perms.canCreateThread ? (
        <PremiumButton title="Neue Nachricht" onPress={() => setComposeOpen(true)} />
      ) : null}

      <MessageSearchBar value={search} onChangeText={setSearch} placeholder="Name, Betreff, Text…" />
      <ConversationFilterBar filter={filter} onChange={setFilter} filters={filters} />

      <View style={styles.links}>
        <PremiumButton
          title="Archiviert"
          size="sm"
          variant="secondary"
          onPress={() => router.push('/business/messages/archived' as never)}
        />
        <PremiumButton
          title="Zuordnungen"
          size="sm"
          variant="secondary"
          onPress={() => router.push('/business/messages/assignments' as never)}
        />
        <PremiumButton
          title="Einstellungen"
          size="sm"
          variant="ghost"
          onPress={() => router.push('/business/messages/settings' as never)}
        />
      </View>
    </View>
  );

  if (loading && threads.length === 0) {
    return (
      <View style={styles.container}>
        {!embedded ? toolbar : null}
        <LoadingState message="Threads werden geladen…" />
      </View>
    );
  }

  if (error && threads.length === 0) {
    return (
      <View style={styles.container}>
        <ErrorState message={error} onRetry={refresh} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NewConversationModal
        visible={composeOpen}
        onClose={() => setComposeOpen(false)}
        onCreated={() => void refresh()}
      />
      <FlatList
        style={styles.flatList}
        data={threads}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={toolbar}
        ListEmptyComponent={
          <EmptyState
            title="Keine Threads"
            message="Passen Sie Filter oder Suche an."
            onAction={refresh}
          />
        }
        ListFooterComponent={
          filteredCount > 0 ? (
            <Text style={styles.footer}>{filteredCount} Threads angezeigt</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <CommunicationThreadListCard
            thread={item}
            selected={selectedId === item.id}
            onPress={
              onThreadPress
                ? () => onThreadPress(item.id)
                : () => router.push(`/business/messages/${item.id}` as never)
            }
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={COMMUNICATION_ACCENT}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flatList: { flex: 1 },
  toolbar: { gap: spacing.sm, marginBottom: spacing.md },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  list: { paddingBottom: spacing.xxl },
  footer: { ...typography.caption, textAlign: 'center', marginVertical: spacing.md },
  embeddedHeader: {
    marginBottom: spacing.xs,
    paddingRight: spacing.xxl,
  },
  embeddedTitle: { ...typography.h3 },
  embeddedMeta: { ...typography.caption, color: colors.textMuted },
});
