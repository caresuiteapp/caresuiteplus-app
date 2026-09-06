import { useCallback, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { useRootNavigationState, useRouter } from 'expo-router';
import { AppState, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth/context';
import { useAppStartIntroReady } from '@/components/brand/appStartIntroSession';
import { ensurePortalPushRegistration, type PortalPushRegistrationResult } from '@/lib/portal/portalPushNotifications';
import { consumePortalPushResponse, portalPushDestination } from '@/lib/portal/portalPushNavigation';

const dismissed = new Set<string>();
export function PortalPushRegistrationGate() {
  const startupReady = useAppStartIntroReady();
  const router = useRouter();
  const navigation = useRootNavigationState();
  const { authReady, isAuthenticated, portalSession } = useAuth();
  const accountKey = `${portalSession?.tenantId ?? ''}:${portalSession?.accountId ?? ''}`;
  const currentAccount = useRef(accountKey); currentAccount.current = accountKey;
  const [result, setResult] = useState<PortalPushRegistrationResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [response, setResponse] = useState<Notifications.NotificationResponse | null>(null);
  const running = useRef(new Set<string>());
  const retries = useRef(0);
  const portalActive = startupReady && authReady && isAuthenticated && !!portalSession && !portalSession.mustChangePassword;
  const register = useCallback(async (ask: boolean) => {
    if (Platform.OS === 'web' || running.current.has(accountKey) || !portalActive) return;
    running.current.add(accountKey); setChecking(true);
    try {
      const next = await ensurePortalPushRegistration(ask);
      if (currentAccount.current === accountKey) setResult(next);
    } finally { running.current.delete(accountKey); if (currentAccount.current === accountKey) setChecking(false); }
  }, [accountKey, portalActive]);
  useEffect(() => { setResult(null); setHidden(dismissed.has(accountKey)); retries.current = 0; if (portalActive) void register(false); }, [accountKey, portalActive, register]);
  useEffect(() => {
    if (!portalActive || Platform.OS === 'web') return;
    const listener = AppState.addEventListener('change', state => { if (state === 'active') { retries.current = 0; void register(false); } });
    return () => listener.remove();
  }, [portalActive, register]);
  useEffect(() => {
    if (!portalActive || checking || !result || result.ok || result.permissionStatus !== 'granted' || retries.current >= 3) return;
    const timer = setTimeout(() => { retries.current += 1; void register(false); }, 30_000 * 2 ** retries.current);
    return () => clearTimeout(timer);
  }, [portalActive, checking, register, result]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    const listener = Notifications.addNotificationResponseReceivedListener(value => setResponse(value));
    void Notifications.getLastNotificationResponseAsync().then(value => { if (active && value) setResponse(value); }).catch(() => {});
    return () => { active = false; listener.remove(); };
  }, []);
  useEffect(() => {
    if (!portalActive || !navigation?.key || !response) return;
    const destination = portalPushDestination(response.notification.request.content.data, portalSession);
    if (!destination) return;
    const id = String(response.notification.request.content.data?.notificationId ?? response.notification.request.identifier);
    if (consumePortalPushResponse(id)) router.push(destination as never);
    setResponse(null);
    void Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }, [navigation?.key, portalActive, portalSession, response, router]);
  if (Platform.OS === 'web' || !portalActive || hidden || !result || result.ok || result.permissionStatus === 'granted') return null;
  const close = () => { dismissed.add(accountKey); setHidden(true); };
  return <Modal visible transparent animationType="fade" onRequestClose={close}>
    <View style={styles.backdrop}><View style={styles.card} accessibilityViewIsModal>
      <Text style={styles.title}>Wichtige Hinweise erhalten</Text>
      <Text style={styles.text}>Neue Einsätze, Nachrichten und offene Unterschriften können auch bei geschlossener App angekündigt werden.</Text>
      {result.error ? <Text style={styles.text}>{result.error}</Text> : null}
      <Pressable accessibilityRole="button" disabled={checking} style={styles.action} onPress={() => { if (result.canOpenSettings) void Linking.openSettings(); else void register(true); }}><Text style={styles.actionText}>{checking ? 'Wird geprüft …' : result.canOpenSettings ? 'App-Einstellungen öffnen' : 'Benachrichtigungen erlauben'}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={close} style={styles.secondary}><Text style={styles.text}>Später – Portal weiter benutzen</Text></Pressable>
      <Text style={styles.note}>In Ihrem Profil können Sie Benachrichtigungen jederzeit einrichten. Auf dem Sperrbildschirm erscheinen keine Dokumentinhalte.</Text>
    </View></View>
  </Modal>;
}
const styles = StyleSheet.create({ backdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(24,53,83,0.28)' }, card: { padding: 20, gap: 16, borderRadius: 24, backgroundColor: '#FFF', maxWidth: 480, alignSelf: 'center', width: '100%' }, title: { fontSize: 22, lineHeight: 30, fontWeight: '800', color: '#10283F' }, text: { fontSize: 16, lineHeight: 24, color: '#304E69' }, action: { minHeight: 52, justifyContent: 'center', alignItems: 'center', borderRadius: 14, backgroundColor: '#0668E8', padding: 12 }, actionText: { color: '#FFF', fontSize: 17, fontWeight: '700' }, secondary: { minHeight: 48, justifyContent: 'center', alignItems: 'center' }, note: { fontSize: 14, lineHeight: 21, color: '#526C84' } });
