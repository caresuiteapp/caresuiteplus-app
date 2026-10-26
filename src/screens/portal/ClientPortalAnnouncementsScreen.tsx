import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PortalGlassHero } from '@/components/portal/assist/PortalGlassHero';
import { ClientPortalGuide } from '@/components/portal/ClientPortalGuide';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { useNotifications } from '@/hooks/usenotifications';
import { readClientPortalAnnouncement } from '@/lib/portal/clientAnnouncementReadService';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { careSpacing } from '@/design/tokens/spacing';
import { radius, typography } from '@/theme';
import type { AppNotification } from '@/types/office/broadcast';
import { usePortalActor } from '@/hooks/usePortalActor';

export function ClientPortalAnnouncementsScreen() {
  const query = useNotifications('broadcasts');
  const actor = usePortalActor();
  const scope = JSON.stringify([query.tenantId, query.userId, actor.actorId, actor.roleKey, actor.clientId]);
  return <ClientPortalAnnouncementsContent key={scope} query={query} />;
}

function ClientPortalAnnouncementsContent({ query }: { query: ReturnType<typeof useNotifications> }) {
  const { colors } = useLegacyTheme();
  const { notifications, loading, error, refresh, tenantId, userId } = query;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fullBodies, setFullBodies] = useState<Record<string, string>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [detailErrors, setDetailErrors] = useState<Record<string, string | undefined>>({});
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const openAnnouncement = useCallback(async (item: AppNotification) => {
    if (detailLoadingId === item.id) return;
    if (selectedId === item.id && !detailErrors[item.id]) {
      setSelectedId(null);
      return;
    }

    setSelectedId(item.id);
    if (!tenantId || !userId) {
      setDetailErrors((current) => ({ ...current, [item.id]: 'Ihre Anmeldung konnte gerade nicht zugeordnet werden. Bitte melden Sie sich erneut an.' }));
      return;
    }
    setDetailErrors((current) => ({ ...current, [item.id]: undefined }));
    setDetailLoadingId(item.id);
    const result = await readClientPortalAnnouncement(tenantId, userId, item, undefined, { isCurrent: () => mounted.current });
    if (!mounted.current) return;
    setDetailLoadingId((current) => current === item.id ? null : current);
    if (result.ok) {
      setFullBodies((current) => ({ ...current, [item.id]: result.data.body }));
      if (result.data.readWarning) setDetailErrors((current) => ({ ...current, [item.id]: result.data.readWarning! }));
      else void refresh();
    } else {
      setFullBodies((current) => { const next = { ...current }; delete next[item.id]; return next; });
      setDetailErrors((current) => ({ ...current, [item.id]: result.error }));
    }
  }, [detailErrors, detailLoadingId, refresh, selectedId, tenantId, userId]);

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
            <View
              key={item.id}
              style={[
                styles.card,
                {
                  backgroundColor: colors.bgSurface,
                  borderColor: isUrgent ? colors.danger : colors.borderSoft,
                },
              ]}
            >
              <Pressable accessibilityRole="button" accessibilityLabel={`Mitteilung ${item.title}`}
                accessibilityState={{ expanded: selected }} onPress={() => void openAnnouncement(item)} style={styles.cardHeader}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>{item.title}</Text>
                {!item.isRead ? (
                  <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.badgeText}>Neu</Text>
                  </View>
                ) : null}
              </Pressable>
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
              {selected && detailErrors[item.id] ? <Text accessibilityRole="alert"
                style={[styles.body, { color: colors.danger }]}>{detailErrors[item.id]}</Text> : null}
              <PremiumButton
                title={selected && detailErrors[item.id] ? 'Erneut versuchen' : selected ? 'Weniger anzeigen' : 'Vollständig lesen'}
                size="sm"
                variant="secondary"
                loading={detailLoadingId === item.id}
                onPress={() => void openAnnouncement(item)}
              />
            </View>
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
    minHeight: 44,
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
