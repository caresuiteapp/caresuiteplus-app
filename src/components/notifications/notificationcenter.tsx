import { useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CarePopupShell } from '@/components/layout/platform/CarePopupShell';
import { CarePopupTabPills } from '@/components/layout/platform/CarePopupTabPills';
import { PremiumButton } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { SpaceBellIcon } from '@/components/icons/space';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { useNotifications } from '@/hooks/usenotifications';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  acknowledgeBroadcastNotification,
  fetchBroadcastForNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/office/notificationservice';
import { startBroadcastReplyThread } from '@/lib/office/broadcastservice';
import { glass as glassTokens } from '@/design/tokens/glass';
import { spacing, radius } from '@/theme';
import type { AppNotification, NotificationCenterTab } from '@/types/office/broadcast';
import { BROADCAST_PRIORITIES } from '@/types/office/broadcast';

const TABS: { key: NotificationCenterTab; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'unread', label: 'Ungelesen' },
  { key: 'messages', label: 'Nachrichten' },
  { key: 'broadcasts', label: 'Broadcasts' },
  { key: 'system', label: 'System' },
];

const PRIORITY_LABELS = Object.fromEntries(BROADCAST_PRIORITIES.map((p) => [p.key, p.label]));

type NotificationCenterProps = {
  visible: boolean;
  onClose: () => void;
  employeeId?: string | null;
};

function NotificationRow({
  item,
  onOpen,
}: {
  item: AppNotification;
  onOpen: (item: AppNotification) => void;
}) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          padding: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          backgroundColor: item.isRead ? 'transparent' : `${c.violet}08`,
        },
        header: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
        title: { ...typography.body, fontWeight: '700', color: c.text, flex: 1 },
        time: { ...typography.caption, color: c.muted },
        preview: { ...typography.caption, color: c.muted, marginTop: spacing.xs },
        meta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
        badge: {
          paddingHorizontal: spacing.sm,
          paddingVertical: 2,
          borderRadius: radius.capsule,
          backgroundColor: `${c.violet}18`,
        },
        badgeText: { ...typography.caption, color: c.violet, fontWeight: '600' },
        urgentBadge: { backgroundColor: `${c.danger}22` },
        urgentText: { color: c.danger },
      }),
    [c, typography, item.isRead],
  );

  const isUrgent = item.priority === 'urgent' || item.priority === 'critical';
  const typeLabel =
    item.notificationType === 'broadcast' ? 'Broadcast' : item.notificationType;

  return (
    <Pressable onPress={() => onOpen(item)} style={styles.row} accessibilityRole="button">
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.time}>
          {new Date(item.createdAt).toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
      {item.bodyPreview ? (
        <Text style={styles.preview} numberOfLines={2}>
          {item.bodyPreview}
        </Text>
      ) : null}
      <View style={styles.meta}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{typeLabel}</Text>
        </View>
        {item.categoryLabel ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.categoryLabel}</Text>
          </View>
        ) : null}
        {item.priority !== 'normal' ? (
          <View style={[styles.badge, isUrgent && styles.urgentBadge]}>
            <Text style={[styles.badgeText, isUrgent && styles.urgentText]}>
              {PRIORITY_LABELS[item.priority] ?? item.priority}
            </Text>
          </View>
        ) : null}
        {!item.isRead ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Ungelesen</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export function NotificationCenter({ visible, onClose, employeeId }: NotificationCenterProps) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [tab, setTab] = useState<NotificationCenterTab>('all');
  const { notifications, unreadCount, loading, refresh, userId } = useNotifications(tab);
  const [selected, setSelected] = useState<AppNotification | null>(null);
  const [detailBody, setDetailBody] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        empty: { ...typography.body, color: c.muted, textAlign: 'center', padding: spacing.lg },
        detailBody: { ...typography.body, color: c.text, lineHeight: 22 },
        detailMeta: { ...typography.caption, color: c.muted, marginTop: spacing.sm },
        actions: { gap: spacing.sm, marginTop: spacing.md },
      }),
    [c, typography],
  );

  const openNotification = async (item: AppNotification) => {
    setSelected(item);
    setDetailBody(null);
    if (item.notificationType === 'broadcast' && item.relatedBroadcastId && tenantId) {
      setDetailLoading(true);
      const result = await fetchBroadcastForNotification(tenantId, item.relatedBroadcastId);
      setDetailLoading(false);
      if (result.ok) setDetailBody(result.data.body);
    }
    if (!item.isRead && tenantId && userId) {
      void markNotificationRead(tenantId, item.id, userId, employeeId);
      void refresh();
    }
  };

  const handleAcknowledge = async () => {
    if (!selected || !tenantId || !userId || !employeeId) return;
    setActionLoading(true);
    await acknowledgeBroadcastNotification(tenantId, selected.id, userId, employeeId);
    setActionLoading(false);
    setSelected(null);
    void refresh();
  };

  const handleMarkRead = async () => {
    if (!selected || !tenantId || !userId) return;
    setActionLoading(true);
    await markNotificationRead(tenantId, selected.id, userId, employeeId);
    setActionLoading(false);
    setSelected(null);
    void refresh();
  };

  const handleReply = async () => {
    if (!selected?.relatedBroadcastId || !tenantId || !employeeId) return;
    setActionLoading(true);
    await startBroadcastReplyThread(
      tenantId,
      selected.relatedBroadcastId,
      employeeId,
      'Rückfrage zum Broadcast',
      profile?.roleKey,
      profile?.id,
    );
    setActionLoading(false);
    setSelected(null);
    onClose();
  };

  const handleMarkAllRead = async () => {
    if (!tenantId || !userId) return;
    await markAllNotificationsRead(tenantId, userId, employeeId);
    void refresh();
  };

  if (selected) {
    const needsAck = selected.requireAcknowledgement && !selected.isAcknowledged;
    return (
      <CarePopupShell
        visible={visible}
        title={selected.title}
        subtitle={selected.categoryLabel ?? undefined}
        onClose={() => setSelected(null)}
        onBack={() => setSelected(null)}
        footerActions={[
          ...(needsAck
            ? [{ title: 'Gelesen und verstanden', onPress: handleAcknowledge, loading: actionLoading }]
            : [{ title: 'Als gelesen markieren', onPress: handleMarkRead, loading: actionLoading }]),
          ...(selected.allowReplies && employeeId
            ? [{ title: 'Rückfrage an Verwaltung', onPress: handleReply, loading: actionLoading, variant: 'secondary' as const }]
            : []),
        ]}
      >
        {detailLoading ? (
          <Text style={styles.empty}>Wird geladen …</Text>
        ) : (
          <Text style={styles.detailBody}>{detailBody ?? selected.bodyPreview ?? ''}</Text>
        )}
        <Text style={styles.detailMeta}>
          {selected.senderDisplayName ?? 'Verwaltung'} ·{' '}
          {new Date(selected.createdAt).toLocaleString('de-DE')}
        </Text>
        {selected.notificationType === 'broadcast' ? (
          <Text style={styles.detailMeta}>An alle Mitarbeitenden</Text>
        ) : null}
      </CarePopupShell>
    );
  }

  return (
    <CarePopupShell
      visible={visible}
      title="Benachrichtigungen"
      subtitle={unreadCount > 0 ? `${unreadCount} ungelesen` : undefined}
      onClose={onClose}
      footerActions={
        unreadCount > 0
          ? [{ title: 'Alle als gelesen markieren', onPress: handleMarkAllRead, variant: 'secondary' }]
          : undefined
      }
      maxWidth={480}
    >
      <CarePopupTabPills tabs={TABS} activeTab={tab} onTabChange={setTab} />
      {loading ? (
        <Text style={styles.empty}>Wird geladen …</Text>
      ) : notifications.length === 0 ? (
        <Text style={styles.empty}>Keine neuen Benachrichtigungen.</Text>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NotificationRow item={item} onOpen={openNotification} />}
          style={{ maxHeight: 360 }}
        />
      )}
    </CarePopupShell>
  );
}

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

type NotificationBellButtonProps = {
  onPress: () => void;
  unreadCount: number;
  hasUrgent?: boolean;
  size?: 'topbar' | 'compact' | 'rail';
  variant?: 'default' | 'glass';
};

const webGlassBlur =
  Platform.OS === 'web'
    ? ({
        backdropFilter: `blur(${glassTokens.blur.medium}px)`,
        WebkitBackdropFilter: `blur(${glassTokens.blur.medium}px)`,
      } as unknown as ViewStyle)
    : null;

export function NotificationBellButton({
  onPress,
  unreadCount,
  hasUrgent = false,
  size = 'topbar',
  variant = 'default',
}: NotificationBellButtonProps) {
  const { c } = useCareLightPalette();
  const bellPink = careSuiteAuroraTheme.accent.pink;
  const bellAccent = bellPink;
  const btnSize =
    size === 'rail'
      ? 56
      : variant === 'glass' && size === 'topbar'
        ? 48
        : size === 'topbar'
          ? 48
          : 40;
  const btnRadius = size === 'rail' ? 18 : radius.md;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        btn: {
          width: btnSize,
          height: btnSize,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: btnRadius,
          borderWidth: 0,
          backgroundColor: 'transparent',
          position: 'relative',
        },
        badge: {
          position: 'absolute',
          top: 4,
          right: 4,
          minWidth: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: hasUrgent ? c.danger : bellPink,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 3,
        },
        badgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
      }),
    [btnRadius, btnSize, bellPink, c, hasUrgent],
  );

  return (
    <Pressable
      onPress={onPress}
      style={[styles.btn, webCursor]}
      accessibilityRole="button"
      accessibilityLabel={`Benachrichtigungen${unreadCount > 0 ? `, ${unreadCount} ungelesen` : ''}`}
    >
      <SpaceBellIcon
        accentColor={bellAccent}
        size={size === 'rail' ? 48 : size === 'topbar' ? 40 : 32}
        active={hasUrgent}
        frame={size === 'rail' ? 'rail' : 'card'}
      />
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function NotificationBellWithCenter({
  employeeId,
  size = 'topbar',
  variant = 'default',
}: {
  employeeId?: string | null;
  size?: 'topbar' | 'compact' | 'rail';
  variant?: 'default' | 'glass';
}) {
  const [open, setOpen] = useState(false);
  const { unreadCount, hasUrgent, refresh } = useNotifications('unread');

  return (
    <>
      <NotificationBellButton
        onPress={() => {
          setOpen(true);
          void refresh();
        }}
        unreadCount={unreadCount}
        hasUrgent={hasUrgent}
        size={size}
        variant={variant}
      />
      <NotificationCenter
        visible={open}
        onClose={() => {
          setOpen(false);
          void refresh();
        }}
        employeeId={employeeId}
      />
    </>
  );
}

type NotificationBellFabProps = {
  employeeId?: string | null;
  /** Extra offset above bottom edge (e.g. mobile tab bar). */
  bottomOffset?: number;
};

/** Fixed bottom-right notification bell — rendered at shell level, not in topbar. */
export function NotificationBellFab({ employeeId, bottomOffset = 0 }: NotificationBellFabProps) {
  const insets = useSafeAreaInsets();

  const fabStyle = useMemo(
    (): ViewStyle => ({
      ...(Platform.OS === 'web'
        ? ({ position: 'fixed' } as ViewStyle)
        : { position: 'absolute' }),
      bottom: spacing.lg + Math.max(insets.bottom, 0) + bottomOffset,
      right: spacing.lg,
      zIndex: 100,
    }),
    [bottomOffset, insets.bottom],
  );

  return (
    <View style={fabStyle} pointerEvents="box-none">
      <NotificationBellWithCenter employeeId={employeeId} size="topbar" variant="glass" />
    </View>
  );
}
