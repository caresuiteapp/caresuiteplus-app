import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PremiumButton } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { usePortalActor } from '@/hooks/usePortalActor';
import { readDeviceSyncOverview, type DeviceSyncOverview } from '@/lib/offline/deviceSyncOverview';
import { refreshPortalDeviceCache } from '@/lib/offline/refreshPortalDeviceCache';
import { isDeviceOffline } from '@/lib/offline/connectivity';

export function DeviceSyncStatusCard() {
  const { user, portalSession } = useAuth();
  if (!portalSession || !user) return null;
  return <Content key={`${user.id}:${portalSession.tenantId}:${portalSession.employeeId}:${portalSession.clientId}:${portalSession.accountId}`} />;
}
function Content() {
  const { user, portalSession } = useAuth();
  const actor = usePortalActor();
  const router = useRouter();
  const active = useRef(true), lock = useRef(false);
  const [overview, setOverview] = useState<DeviceSyncOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(isDeviceOffline);
  const refresh = useCallback(async () => {
    if (!user || !portalSession || !actor.tenantId) return;
    const next = await readDeviceSyncOverview({ tenantId: actor.tenantId, userId: user.id,
      employeeId: actor.employeeId ?? null, clientId: actor.clientId ?? null, accountId: portalSession.accountId, roleKey: String(user.roleKey) });
    if (active.current) { setOverview(next); setOffline(isDeviceOffline()); }
  }, [actor.tenantId, actor.employeeId, actor.clientId, portalSession, user]);
  useEffect(() => {
    active.current = true;
    const load = () => { void refresh().catch(() => { if (active.current) setError('Der lokale Übertragungsstand konnte nicht vollständig gelesen werden.'); }); };
    load(); const timer = setInterval(load, 30_000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') load(); });
    return () => { active.current = false; clearInterval(timer); listener.remove(); };
  }, [refresh]);
  return <View style={styles.card}>
    <Text style={styles.title}>Offline und Übertragungen</Text>
    <Text style={styles.text}>{offline ? 'Derzeit ohne Verbindung' : 'Verbindung verfügbar'}</Text>
    <Text style={styles.text}>{overview?.cachedAt ? `Letzter bestätigter Planabgleich: ${new Date(overview.cachedAt).toLocaleString('de-DE')}` : 'Für dieses Konto ist noch kein bestätigter Planabgleich gespeichert.'}</Text>
    <Text style={styles.text}>Geladene Pläne bleiben auf diesem Gerät verfügbar. Eigene Aufgaben- und Dokumentationsentwürfe können Sie im jeweiligen Einsatz weiterbearbeiten. Erst eine bestätigte Übertragung gilt als Speicherung auf dem Server.</Text>
    <Text style={styles.label}>{overview ? `${overview.pending.length} offene lokale Entwürfe` : 'Lokaler Stand wird geprüft'}</Text>
    {overview?.pending.map(item => <PremiumButton key={item.key} title={`${item.title} · Einsatz öffnen`} variant="secondary" onPress={() => router.push(item.route as never)} />)}
    <PremiumButton title="Planabgleich jetzt prüfen" variant="secondary" loading={busy} onPress={() => {
      if (lock.current) return; lock.current = true; setBusy(true); setError(null);
      void (async () => {
        try {
          if (!await refreshPortalDeviceCache()) throw new Error('Der Planabgleich konnte noch nicht bestätigt werden. Vorhandene Entwürfe bleiben erhalten.');
          if (active.current) await refresh();
        } catch (cause) { if (active.current) setError(cause instanceof Error ? cause.message : 'Der Abgleich ist fehlgeschlagen.'); }
        finally { lock.current = false; if (active.current) setBusy(false); }
      })();
    }} />
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({ card: { gap: 12, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: '#CBD8E6', backgroundColor: '#FFFFFF', minWidth: 0 }, title: { fontSize: 20, lineHeight: 28, fontWeight: '800', color: '#10283F' }, text: { fontSize: 15, lineHeight: 23, color: '#304E69' }, label: { fontSize: 16, lineHeight: 24, color: '#10283F', fontWeight: '700' }, error: { fontSize: 15, lineHeight: 23, color: '#A51E35' } });
