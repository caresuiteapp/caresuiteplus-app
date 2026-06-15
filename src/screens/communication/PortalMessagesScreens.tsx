import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ConversationListItem } from '@/components/communication';
import { PortalTabHero } from '@/components/portal/PortalTabHero';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { EmptyState, LoadingState, PremiumButton, PremiumCard } from '@/components/ui';
import { useCommunicationPermissions, usePortalMessages } from '@/hooks/communication';
import { useAuth } from '@/lib/auth/context';
import { resolvePortalScope } from '@/lib/portal/portalVisibility';
import { colors, spacing } from '@/theme';

type PortalMessagesScreenProps = {
  detailBasePath: string;
  quickActionLabel?: string;
  onQuickAction?: () => void;
};

export function PortalMessagesListShell({
  detailBasePath,
  quickActionLabel = 'Nachricht ans Büro',
  onQuickAction,
}: PortalMessagesScreenProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const scope = resolvePortalScope(profile?.roleKey ?? null);
  const perms = useCommunicationPermissions();
  const { items, loading, refreshing, refresh, isEmpty, unreadCount } = usePortalMessages();

  if (!perms.canViewPortal) {
    return (
      <ScreenShell title="Nachrichten">
        <LockedActionBanner message="Keine Berechtigung für Portal-Nachrichten." />
      </ScreenShell>
    );
  }

  if (loading && items.length === 0) {
    return <LoadingState message="Nachrichten werden geladen…" />;
  }

  return (
    <View style={styles.wrap}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.cyan} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <PortalTabHero
              tab="messages"
              scope={scope}
              totalCount={items.length}
              unreadCount={unreadCount}
            />
            {onQuickAction ? (
              <PremiumButton title={quickActionLabel} onPress={onQuickAction} fullWidth />
            ) : null}
          </>
        }
        ListEmptyComponent={
          <EmptyState title="Keine Nachrichten" message="Ihr Posteingang ist leer." onAction={refresh} />
        }
        renderItem={({ item }) => (
          <PremiumCard
            accentColor={item.unreadCountBusiness > 0 ? colors.cyan : undefined}
            onPress={() => router.push(`${detailBasePath}/${item.id}` as never)}
          >
            <ConversationListItem item={item} />
          </PremiumCard>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: spacing.md },
  list: { gap: spacing.md, paddingBottom: spacing.xxl },
});

export function EmployeePortalMessagesScreen() {
  return (
    <ScreenShell title="Nachrichten" subtitle="Mitarbeiter:innenportal" showBack={false}>
      <PortalMessagesListShell detailBasePath="/portal/employee/messages" />
    </ScreenShell>
  );
}

export function ClientPortalMessagesScreen() {
  return (
    <ScreenShell title="Nachrichten" subtitle="Klient:innenportal" showBack={false}>
      <PortalMessagesListShell detailBasePath="/portal/client/messages" />
    </ScreenShell>
  );
}

export function RelativePortalMessagesScreen() {
  return (
    <ScreenShell title="Nachrichten" subtitle="Angehörigenportal" showBack={false}>
      <PortalMessagesListShell detailBasePath="/portal/relative/messages" />
    </ScreenShell>
  );
}
