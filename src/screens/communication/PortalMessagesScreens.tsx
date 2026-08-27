import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ConversationListItem } from '@/components/communication';
import { PortalTabHero } from '@/components/portal/PortalTabHero';
import { GlassCard } from '@/design/components/GlassCard';
import { spatialCare } from '@/design/tokens/spatialCareSuite';
import { careSpacing } from '@/design/tokens/spacing';
import { moduleColor } from '@/design/tokens/modules';
import { withAlpha } from '@/design/tokens/motion';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout/ScreenShell';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { EmptyState, LoadingState, PremiumButton } from '@/components/ui';
import { useCommunicationPermissions, usePortalMessages } from '@/hooks/communication';
import type { PortalScope } from '@/types/portal';
import type { CommunicationAudience } from '@/features/communication/communication.types';
import { colors, spacing } from '@/theme';

type PortalMessagesScreenProps = {
  audience: Exclude<CommunicationAudience, 'business'>;
  detailBasePath: string;
  quickActionLabel?: string;
  onQuickAction?: () => void;
};

export function PortalMessagesListShell({
  audience,
  detailBasePath,
  quickActionLabel = 'Nachricht ans Büro',
  onQuickAction,
}: PortalMessagesScreenProps) {
  const router = useRouter();
  const scope: PortalScope =
    audience === 'employee_portal'
      ? 'portal_employee'
      : audience === 'relative_portal'
        ? 'portal_family'
        : 'portal_client';
  const perms = useCommunicationPermissions();
  const { items, loading, refreshing, refresh, unreadCount } = usePortalMessages(audience);

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
          <GlassCard
            style={{
              backgroundColor: spatialCare.stageStrong,
              borderColor: withAlpha(moduleColor('assist'), 0.22),
              padding: careSpacing.sm,
            }}
            onPress={() => router.push(`${detailBasePath}/${item.id}` as never)}
          >
            <ConversationListItem item={item} />
          </GlassCard>
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
    <PortalTabScreen title="Nachrichten" subtitle="Sicher mit dem Office kommunizieren" hideHeaderOnPhone scroll={false}>
      <PortalMessagesListShell
        audience="employee_portal"
        detailBasePath="/portal/employee/messages"
      />
    </PortalTabScreen>
  );
}

export function ClientPortalMessagesScreen() {
  return (
    <ScreenShell title="Nachrichten" subtitle="Klient:innenportal" showBack={false}>
      <PortalMessagesListShell
        audience="client_portal"
        detailBasePath="/portal/client/messages"
      />
    </ScreenShell>
  );
}

export function RelativePortalMessagesScreen() {
  return (
    <ScreenShell title="Nachrichten" subtitle="Angehörigenportal" showBack={false}>
      <PortalMessagesListShell
        audience="relative_portal"
        detailBasePath="/portal/relative/messages"
      />
    </ScreenShell>
  );
}
