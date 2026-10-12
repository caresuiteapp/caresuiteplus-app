import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { PortalAnnouncementsHero } from '@/components/portal';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumCard } from '@/components/ui';
import { useNotifications } from '@/hooks/usenotifications';
import { readClientPortalAnnouncement } from '@/lib/portal/clientAnnouncementReadService';
import { acknowledgeBroadcastNotification } from '@/lib/office/notificationservice';
import { useRouter } from 'expo-router';
import type { AppNotification } from '@/types/office/broadcast';
import { typography, spacing } from '@/theme';
import { portalPremium } from '@/design/tokens/portalPremium';

export function EmployeePortalAnnouncementsScreen() {
  const { notifications, loading, error, refresh, tenantId, userId, employeeId } = useNotifications('broadcasts');
  const scope = JSON.stringify([tenantId, userId, employeeId]);
  return <EmployeeAnnouncementsContent key={scope} {...{ notifications, loading, error, refresh, tenantId, userId, employeeId }} />;
}

function EmployeeAnnouncementsContent({ notifications, loading, error, refresh, tenantId, userId, employeeId }:
  Pick<ReturnType<typeof useNotifications>, 'notifications' | 'loading' | 'error' | 'refresh' | 'tenantId' | 'userId' | 'employeeId'>) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fullBodies, setFullBodies] = useState<Record<string, string>>({});
  const [detailErrors, setDetailErrors] = useState<Record<string, string | undefined>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [acknowledgedIds, setAcknowledgedIds] = useState(() => new Set<string>());
  const router = useRouter();
  const inFlight = useRef(new Set<string>());
  const acknowledge = async (item: AppNotification) => {
    if (!tenantId || !userId || !employeeId || !fullBodies[item.id] || inFlight.current.has(item.id)) return;
    inFlight.current.add(item.id);
    setLoadingId(item.id);
    try {
      const result = await acknowledgeBroadcastNotification(tenantId, item.id, userId, employeeId);
      if (!result.ok) setDetailErrors((current) => ({ ...current, [item.id]: 'Die Bestätigung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.' }));
      else {
        setAcknowledgedIds((current) => new Set([...current, item.id]));
        setDetailErrors((current) => ({ ...current, [item.id]: undefined }));
        void refresh();
      }
    } catch {
      setDetailErrors((current) => ({ ...current, [item.id]: 'Die Bestätigung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.' }));
    } finally {
      inFlight.current.delete(item.id);
      setLoadingId(null);
    }
  };
  const openAnnouncement = async (item: AppNotification) => {
    if (inFlight.current.has(item.id)) return;
    if (selectedId === item.id && !detailErrors[item.id]) { setSelectedId(null); return; }
    setSelectedId(item.id);
    if (!tenantId || !userId || !employeeId) {
      setDetailErrors((current) => ({ ...current, [item.id]: 'Ihre Anmeldung konnte gerade nicht zugeordnet werden. Bitte melden Sie sich erneut an.' }));
      return;
    }
    inFlight.current.add(item.id);
    setLoadingId(item.id);
    setDetailErrors((current) => ({ ...current, [item.id]: undefined }));
    try {
      const result = await readClientPortalAnnouncement(tenantId, userId, item, employeeId);
      if (result.ok) {
        setFullBodies((current) => ({ ...current, [item.id]: result.data.body }));
        if (result.data.readWarning) setDetailErrors((current) => ({ ...current, [item.id]: result.data.readWarning! }));
        else void refresh();
      } else {
        setDetailErrors((current) => ({ ...current, [item.id]: result.error }));
      }
    } finally {
      inFlight.current.delete(item.id);
      setLoadingId((current) => current === item.id ? null : current);
    }
  };

  return (
    <PortalTabScreen title="Mitteilungen" subtitle="Informationen der Verwaltung" hideHeaderOnPhone contentOwnsHero>
      <View style={styles.scroll}>
        <PortalAnnouncementsHero
          scope="portal_employee"
          itemCount={notifications.length}
          activeCount={notifications.length}
        />
        {loading ? <LoadingState message="Mitteilungen werden geladen…" /> : null}
        {error ? <ErrorState title="Mitteilungen nicht verfügbar" message="Die Mitteilungen konnten gerade nicht geladen werden." onRetry={refresh} /> : null}
        {!loading && !error && notifications.length === 0 ? <EmptyState title="Keine Mitteilungen"
          message="Sobald Ihre Verwaltung eine Information für Sie veröffentlicht, erscheint sie hier." /> : null}
        {notifications.map((item) => (
          <PremiumCard key={item.id}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Mitteilung ${item.title}`}
              accessibilityState={{ expanded: selectedId === item.id }} style={styles.cardHeader} onPress={() => void openAnnouncement(item)}>
              <Text style={styles.title}>{item.title}{!item.isRead ? ' · Neu' : ''}</Text>
            </Pressable>
            <Text style={styles.meta}>{item.senderDisplayName ?? 'Verwaltung'} · {new Date(item.createdAt).toLocaleString('de-DE')}</Text>
            <Text numberOfLines={selectedId === item.id ? undefined : 3} style={styles.body}>
              {fullBodies[item.id] ?? item.bodyPreview ?? 'Mitteilung öffnen'}
            </Text>
            {selectedId === item.id && detailErrors[item.id] ? <Text accessibilityRole="alert" style={styles.error}>{detailErrors[item.id]}</Text> : null}
            <PremiumButton title={selectedId === item.id && detailErrors[item.id] ? 'Erneut versuchen'
              : selectedId === item.id ? 'Weniger anzeigen' : 'Vollständig lesen'} size="sm" variant="secondary"
              loading={loadingId === item.id} onPress={() => void openAnnouncement(item)} />
            {selectedId === item.id && fullBodies[item.id] && item.requireAcknowledgement ?
              item.isAcknowledged || acknowledgedIds.has(item.id) ? <Text style={styles.meta}>Mitteilung bestätigt</Text>
              : <PremiumButton title="Mitteilung bestätigen" loading={loadingId === item.id} onPress={() => void acknowledge(item)} /> : null}
            {selectedId === item.id && fullBodies[item.id] && item.allowReplies ?
              <PremiumButton title="Verwaltung antworten" variant="secondary"
                onPress={() => router.push('/portal/employee/messages?compose=1' as never)} /> : null}
          </PremiumCard>
        ))}
      </View>
    </PortalTabScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md },
  cardHeader: { minHeight: 44, justifyContent: 'center' },
  title: { ...typography.bodyStrong, color: portalPremium.text.primary },
  meta: { ...typography.caption, color: portalPremium.text.secondary },
  body: { ...typography.body, color: portalPremium.text.primary },
  error: { ...typography.body, color: '#C53A52' },
});
