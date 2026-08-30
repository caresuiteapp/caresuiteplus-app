import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { sensitiveAuthStorage } from '@/lib/security/sensitiveAuthStorage';
import { invokeEdgeFunction } from '@/lib/supabase/edgeFunctions';

const TOKEN_STORAGE_KEY = 'caresuite.portal.push-token.v1';
const TOKEN_TIMEOUT_MS = 15_000;

export type PortalPushPermissionStatus = 'granted' | 'denied' | 'undetermined';

export type PortalPushRegistrationResult =
  | { ok: true; permissionStatus: 'granted'; expoPushToken: string }
  | {
      ok: false;
      permissionStatus: PortalPushPermissionStatus;
      error: string;
      canOpenSettings: boolean;
    };

type RegisterResponse = { ok?: boolean; deviceId: string; registeredAt: string };

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

function normalizePermissionStatus(status: Notifications.PermissionStatus): PortalPushPermissionStatus {
  if (status === Notifications.PermissionStatus.GRANTED) return 'granted';
  if (status === Notifications.PermissionStatus.DENIED) return 'denied';
  return 'undetermined';
}

async function configureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Promise.all([
    Notifications.setNotificationChannelAsync('caresuite-important', {
      name: 'CareSuite Mitteilungen',
      description: 'Dienstliche Mitteilungen aus CareSuite Office',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: '#6246EA',
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    }),
    Notifications.setNotificationChannelAsync('caresuite-urgent', {
      name: 'Dringende CareSuite Mitteilungen',
      description: 'Dringende dienstliche Mitteilungen aus CareSuite Office',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 150, 300, 150, 300],
      lightColor: '#C62828',
      sound: 'default',
      bypassDnd: false,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    }),
  ]);
}

function projectId(): string | null {
  const configured = Constants.expoConfig?.extra?.eas?.projectId;
  const embedded = Constants.easConfig?.projectId;
  return typeof configured === 'string' && configured.trim()
    ? configured.trim()
    : typeof embedded === 'string' && embedded.trim()
      ? embedded.trim()
      : null;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Zeitüberschreitung bei der Push-Registrierung.')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Never expose native Firebase, Expo or transport diagnostics in a portal UI. */
export function toPortalPushUserMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const normalized = raw.toLowerCase();

  if (
    normalized.includes('firebaseapp') ||
    normalized.includes('firebase app') ||
    normalized.includes('fcm-credentials') ||
    normalized.includes('fcm credentials') ||
    normalized.includes('getexpopushtoken')
  ) {
    return 'Benachrichtigungen werden mit dem nächsten App-Start erneut eingerichtet.';
  }
  if (normalized.includes('zeitüberschreitung') || normalized.includes('timeout')) {
    return 'Die Push-Verbindung antwortet gerade nicht. CareSuite versucht es automatisch erneut.';
  }
  if (normalized.includes('network') || normalized.includes('netzwerk') || normalized.includes('fetch')) {
    return 'Die Push-Verbindung ist momentan offline und wird automatisch erneut geprüft.';
  }
  return 'Benachrichtigungen konnten noch nicht verbunden werden. CareSuite versucht es automatisch erneut.';
}

export async function readPortalPushPermission(): Promise<PortalPushPermissionStatus> {
  if (Platform.OS === 'web') return 'denied';
  const permission = await Notifications.getPermissionsAsync();
  return normalizePermissionStatus(permission.status);
}

export async function ensurePortalPushRegistration(
  requestPermission = true,
): Promise<PortalPushRegistrationResult> {
  if (Platform.OS === 'web') {
    return {
      ok: false,
      permissionStatus: 'denied',
      error: 'System-Push ist nur in der installierten App verfügbar.',
      canOpenSettings: false,
    };
  }

  try {
    await configureAndroidChannels();
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && requestPermission && permission.canAskAgain) {
      permission = await Notifications.requestPermissionsAsync();
    }

    const permissionStatus = normalizePermissionStatus(permission.status);
    if (!permission.granted) {
      return {
        ok: false,
        permissionStatus,
        error: 'Benachrichtigungen sind für CareSuite nicht freigegeben.',
        canOpenSettings: permissionStatus === 'denied' || !permission.canAskAgain,
      };
    }

    const easProjectId = projectId();
    if (!easProjectId) {
      return {
        ok: false,
        permissionStatus: 'granted',
        error: 'Die EAS-Projekt-ID fehlt im App-Build.',
        canOpenSettings: false,
      };
    }

    const token = (
      await withTimeout(
        Notifications.getExpoPushTokenAsync({ projectId: easProjectId }),
        TOKEN_TIMEOUT_MS,
      )
    ).data;

    const response = await invokeEdgeFunction<RegisterResponse>('portal-push-register', {
      action: 'register',
      expoPushToken: token,
      platform: Platform.OS,
      appVersion: Constants.expoConfig?.version ?? null,
      permissionStatus: 'granted',
    });
    if (!response.ok) {
      return {
        ok: false,
        permissionStatus: 'granted',
        error: toPortalPushUserMessage(response.error),
        canOpenSettings: false,
      };
    }

    await sensitiveAuthStorage.setItem(TOKEN_STORAGE_KEY, token);
    return { ok: true, permissionStatus: 'granted', expoPushToken: token };
  } catch (error) {
    return {
      ok: false,
      permissionStatus: 'granted',
      error: toPortalPushUserMessage(error),
      canOpenSettings: false,
    };
  }
}

export async function unregisterPortalPushDeviceBeforeLogout(): Promise<void> {
  if (Platform.OS === 'web') return;
  const token = await sensitiveAuthStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) return;

  const result = await invokeEdgeFunction<{ unregistered: boolean }>('portal-push-register', {
    action: 'unregister',
    expoPushToken: token,
  });
  if (result.ok) {
    await sensitiveAuthStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export function isAllowedPortalPushRoute(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    (value.startsWith('/portal/employee/') || value.startsWith('/portal/client/')) &&
    !value.includes('..')
  );
}
