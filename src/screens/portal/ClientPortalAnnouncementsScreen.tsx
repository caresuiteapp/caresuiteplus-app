import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PortalGlassHero } from '@/components/portal/assist/PortalGlassHero';
import { ClientPortalGuide } from '@/components/portal/ClientPortalGuide';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { useNotifications } from '@/hooks/usenotifications';
import {
  fetchBroadcastForNotification,
  markNotificationRead,
} from '@/lib/office/notificationservice';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { careSpacing } from '@/design/tokens/spacing';
import { radius, typography } from '@/theme';
import type { AppNotification } from '@/types/office/broadcast';

export function ClientPortalAnnouncementsScreen() {
  const { colors } = useLegacyTheme();
  const { notifications, loading, error, refresh, tenantId, userId } = useNotifications('broadcasts');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fullBodies, setFullBodies] = useState<Record<string, string>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);

  const openAnnouncement = useCallback(async (item: AppNotification) => {
    if (selectedId === item.id) {
      setSelectedId(null);
      return;
    }

    setSelectedId(item.id);
    if (tenantId && userId && !item.isRead) {
      await markNotificationRead(tenantId, item.id, userId);
      void refresh();
    }

    if (!tenantId || !item.relatedBroadcastId || fullBodies[item.id]) return;
    setDetailLoadingId(item.id);
    const detail = await fetchBroadcastForNotification(tenantId, item.relatedBroadcastId);
    setDetailLoadingId(null);
    if (detail.ok) {
      setFullBodies((current) => ({ ...current, [item.id]: detail.data.body }));
    }
  }, [fullBodies, refresh, selectedId, tenantId, userId]);

  return (
    <PortalTabScreen title="Mitteilungen" hideHeaderOnPhone>
      <View style={styles.content}>
        <PortalGlassHero
          title="Mitteilungen"
          subtitle="Wichtige Informationen von Ihrem Pflegebüro"
          showStatusDot
        />
        {loading ? <LoadingState message="Mitteilungen werden geladen…" /> : null}
        {error ? (
          <ErrorState
            title="Mitteilungen nicht verfügbar"
            message="Die Mitteilungen konnten gerade nicht geladen werden."
            onRetry={refresh}
          />
        ) : null}
        {!loading && !error && notifications.length === 0 ? (
          <ClientPortalGuide
            compact
            title="Keine neuen Mitteilungen"
            message="Sobald Ihr Pflegebüro eine Information für Sie veröffentlicht, erscheint sie hier."
          />
        ) : null}
        {notifications.map((item) => {
          const selected = selectedId === item.id;
          const isUrgent = item.priority === 'urgent' || item.priority === 'critical';
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`Mitteilung ${item.title}`}
              onPress={() => void openAnnouncement(item)}
              style={[
                styles.card,
                {
                  backgroundColor: colors.bgSurface,
                  borderColor: isUrgent ? colors.danger : colors.borderSoft,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>{item.title}</Text>
                {!item.isRead ? (
                  <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.badgeText}>Neu</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.meta, { color: colors.textSecondary }]}>
                {item.senderDisplayName ?? 'Verwaltung'} ·{' '}
                {new Date(item.createdAt).toLocaleString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
              <Text
                numberOfLines={selected ? undefined : 3}
                style={[styles.body, { color: colors.textPrimary }]}
              >
                {fullBodies[item.id] ?? item.bodyPreview ?? 'Mitteilung öffnen'}
              </Text>
              {detailLoadingId === item.id ? <LoadingState message="Mitteilung wird geöffnet…" /> : null}
              <PremiumButton
                title={selected ? 'Weniger anzeigen' : 'Vollständig lesen'}
                size="sm"
                variant="secondary"
                onPress={() => void openAnnouncement(item)}
              />
            </Pressable>
          );
        })}
      </View>
    </PortalTabScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: careSpacing.md,
    paddingBottom: careSpacing.xxl,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: careSpacing.lg,
    gap: careSpacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: careSpacing.sm,
  },
  title: {
    ...typography.h3,
    flex: 1,
  },
  body: {
    ...typography.body,
    lineHeight: 24,
  },
  meta: {
    ...typography.caption,
  },
  badge: {
    borderRadius: radius.capsule,
    paddingHorizontal: careSpacing.sm,
    paddingVertical: 4,
  },
  badgeText: {
    ...typography.caption,
    color: '#ffffff',
    fontWeight: '700',
  },
});
