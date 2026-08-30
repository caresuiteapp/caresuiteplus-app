import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import {
  AppState,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@/lib/auth/context';
import {
  ensurePortalPushRegistration,
  isAllowedPortalPushRoute,
  type PortalPushPermissionStatus,
} from '@/lib/portal/portalPushNotifications';

type GateState = {
  checking: boolean;
  permissionStatus: PortalPushPermissionStatus;
  registered: boolean;
  error: string | null;
  canOpenSettings: boolean;
};

const INITIAL_STATE: GateState = {
  checking: true,
  permissionStatus: 'undetermined',
  registered: false,
  error: null,
  canOpenSettings: false,
};

export function PortalPushRegistrationGate() {
  const router = useRouter();
  const { authReady, isAuthenticated, portalSession } = useAuth();
  const [state, setState] = useState<GateState>(INITIAL_STATE);
  const requestRunning = useRef(false);
  const portalActive = authReady && isAuthenticated && Boolean(portalSession);

  const register = useCallback(async (requestPermission: boolean) => {
    if (Platform.OS === 'web' || requestRunning.current) return;
    requestRunning.current = true;
    setState((current) => ({ ...current, checking: true, error: null }));
    const result = await ensurePortalPushRegistration(requestPermission);
    requestRunning.current = false;
    if (result.ok) {
      setState({
        checking: false,
        permissionStatus: 'granted',
        registered: true,
        error: null,
        canOpenSettings: false,
      });
      return;
    }
    setState({
      checking: false,
      permissionStatus: result.permissionStatus,
      registered: false,
      error: result.error,
      canOpenSettings: result.canOpenSettings,
    });
  }, []);

  useEffect(() => {
    if (!portalActive || Platform.OS === 'web') {
      setState(INITIAL_STATE);
      return;
    }
    // Inspect first. The system permission dialog is only opened after a
    // deliberate user action, never automatically while the portal hydrates.
    void register(false);
  }, [portalActive, register]);

  useEffect(() => {
    if (
      !portalActive ||
      Platform.OS === 'web' ||
      state.registered ||
      state.checking ||
      state.permissionStatus !== 'granted' ||
      !state.error
    ) {
      return;
    }

    // Token/server failures must not block or cover the portal. Retry quietly
    // after the app has become usable.
    const retryTimer = setTimeout(() => void register(false), 30_000);
    return () => clearTimeout(retryTimer);
  }, [portalActive, register, state.checking, state.error, state.permissionStatus, state.registered]);

  useEffect(() => {
    if (!portalActive || Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void register(false);
    });
    return () => subscription.remove();
  }, [portalActive, register]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const openResponse = (response: Notifications.NotificationResponse | null | undefined) => {
      const route = response?.notification.request.content.data?.route;
      if (isAllowedPortalPushRoute(route)) router.push(route as never);
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(openResponse);
    void Notifications.getLastNotificationResponseAsync().then(openResponse);
    return () => subscription.remove();
  }, [router]);

  const styles = useMemo(() => createStyles(), []);
  if (!portalActive || Platform.OS === 'web' || state.registered) return null;

  if (state.checking && state.permissionStatus === 'undetermined' && !state.error) {
    return null;
  }

  const permissionMissing = state.permissionStatus !== 'granted';
  if (!permissionMissing) return null;

  return (
    <View style={styles.overlay} accessibilityViewIsModal accessibilityRole="alert">
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>🔔</Text>
        </View>
        <Text style={styles.title}>Benachrichtigungen erforderlich</Text>
        <Text style={styles.body}>
          CareSuite benötigt Benachrichtigungen, damit wichtige Einsatzänderungen und Mitteilungen
          aus Office auch bei geschlossener App zuverlässig ankommen.
        </Text>
        {state.error && state.permissionStatus === 'denied' ? (
          <Text style={styles.error}>{state.error}</Text>
        ) : null}
        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            if (state.canOpenSettings) void Linking.openSettings();
            else void register(true);
          }}
          disabled={state.checking}
        >
          <Text style={styles.primaryButtonText}>
            {state.checking
              ? 'Berechtigung wird geprüft …'
              : state.canOpenSettings
                ? 'App-Einstellungen öffnen'
                : 'Benachrichtigungen aktivieren'}
          </Text>
        </Pressable>
        <Text style={styles.privacy}>
          Auf dem Sperrbildschirm erscheint nur ein neutraler Hinweis. Geschützte Inhalte werden
          erst nach dem Öffnen und Entsperren von CareSuite angezeigt.
        </Text>
      </View>
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 10000,
      padding: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(7, 13, 28, 0.88)',
    },
    card: {
      width: '100%',
      maxWidth: 480,
      padding: 24,
      borderRadius: 24,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      gap: 14,
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#EEEAFE',
    },
    icon: { fontSize: 30 },
    title: { fontSize: 22, lineHeight: 28, fontWeight: '800', color: '#171B2C', textAlign: 'center' },
    body: { fontSize: 16, lineHeight: 23, color: '#4B5568', textAlign: 'center' },
    error: { fontSize: 14, lineHeight: 20, color: '#B42318', textAlign: 'center' },
    primaryButton: {
      width: '100%',
      minHeight: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
      backgroundColor: '#6246EA',
    },
    primaryButtonText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
    privacy: { fontSize: 12, lineHeight: 17, color: '#6B7280', textAlign: 'center' },
  });
}
