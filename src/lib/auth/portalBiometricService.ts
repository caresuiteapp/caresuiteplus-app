import { Platform } from 'react-native';
import { sensitiveAuthStorage } from '@/lib/security/sensitiveAuthStorage';

type LocalAuthenticationModule = typeof import('expo-local-authentication');

export type PortalFaceAvailability = {
  available: boolean;
  hardwareAvailable: boolean;
  enrolled: boolean;
  faceSupported: boolean;
  strongBiometricEnrolled: boolean;
  reason: string | null;
};

export type PortalFaceAuthenticationResult =
  | { ok: true }
  | { ok: false; cancelled: boolean; error: string };

type PreferenceListener = (accountId: string, enabled: boolean) => void;

const STORAGE_PREFIX = 'caresuite.portal.face-unlock.v1';
const preferenceListeners = new Set<PreferenceListener>();

function preferenceKey(accountId: string): string {
  return `${STORAGE_PREFIX}.${accountId}`;
}

function isNativePortalApp(): boolean {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}

async function getLocalAuthentication(): Promise<LocalAuthenticationModule> {
  return import('expo-local-authentication');
}

export async function getPortalFaceAvailability(): Promise<PortalFaceAvailability> {
  if (!isNativePortalApp()) {
    return {
      available: false,
      hardwareAvailable: false,
      enrolled: false,
      faceSupported: false,
      strongBiometricEnrolled: false,
      reason: 'Die Gesichtsentsperrung ist nur in der installierten CareSuite-App verfügbar.',
    };
  }

  try {
    const localAuthentication = await getLocalAuthentication();
    const [hardwareAvailable, enrolled, supportedTypes, enrolledLevel] = await Promise.all([
      localAuthentication.hasHardwareAsync(),
      localAuthentication.isEnrolledAsync(),
      localAuthentication.supportedAuthenticationTypesAsync(),
      localAuthentication.getEnrolledLevelAsync(),
    ]);
    const faceSupported = supportedTypes.includes(
      localAuthentication.AuthenticationType.FACIAL_RECOGNITION,
    );
    const strongBiometricEnrolled =
      enrolledLevel === localAuthentication.SecurityLevel.BIOMETRIC_STRONG;

    let reason: string | null = null;
    if (!hardwareAvailable) {
      reason = 'Dieses Gerät besitzt keine unterstützte biometrische Hardware.';
    } else if (!faceSupported) {
      reason = 'Dieses Gerät bietet CareSuite keine Gesichtserkennung an.';
    } else if (!enrolled) {
      reason = 'Richten Sie zuerst die Gesichtserkennung in den Geräteeinstellungen ein.';
    } else if (!strongBiometricEnrolled) {
      reason =
        'Die eingerichtete Gesichtserkennung erfüllt nicht die erforderliche starke Android-Sicherheitsklasse.';
    }

    return {
      available:
        hardwareAvailable && enrolled && faceSupported && strongBiometricEnrolled,
      hardwareAvailable,
      enrolled,
      faceSupported,
      strongBiometricEnrolled,
      reason,
    };
  } catch {
    return {
      available: false,
      hardwareAvailable: false,
      enrolled: false,
      faceSupported: false,
      strongBiometricEnrolled: false,
      reason: 'Die Gerätebiometrie konnte gerade nicht geprüft werden.',
    };
  }
}

export async function authenticatePortalFace(): Promise<PortalFaceAuthenticationResult> {
  const availability = await getPortalFaceAvailability();
  if (!availability.available) {
    return {
      ok: false,
      cancelled: false,
      error: availability.reason ?? 'Gesichtserkennung ist nicht verfügbar.',
    };
  }

  try {
    const localAuthentication = await getLocalAuthentication();
    const result = await localAuthentication.authenticateAsync({
      promptMessage: 'CareSuite entsperren',
      promptSubtitle: 'Sichere Gesichtserkennung',
      promptDescription:
        'Bestätigen Sie Ihre Identität, um persönliche Portal- und Gesundheitsdaten anzuzeigen.',
      cancelLabel: 'Abbrechen',
      fallbackLabel: '',
      disableDeviceFallback: true,
      biometricsSecurityLevel: 'strong',
      requireConfirmation: true,
    });

    if (result.success) return { ok: true };
    const cancelled = ['user_cancel', 'app_cancel', 'system_cancel'].includes(result.error);
    return {
      ok: false,
      cancelled,
      error: cancelled
        ? 'Gesichtserkennung wurde abgebrochen.'
        : result.error === 'lockout'
          ? 'Die Gerätebiometrie ist vorübergehend gesperrt. Bitte warten Sie oder melden Sie sich normal an.'
          : 'Das Gesicht wurde nicht bestätigt. Bitte versuchen Sie es erneut.',
    };
  } catch {
    return {
      ok: false,
      cancelled: false,
      error: 'Die sichere Geräteabfrage konnte nicht gestartet werden.',
    };
  }
}

export async function isPortalFaceUnlockEnabled(accountId: string): Promise<boolean> {
  if (!accountId || !isNativePortalApp()) return false;
  return (await sensitiveAuthStorage.getItem(preferenceKey(accountId))) === 'enabled';
}

export async function setPortalFaceUnlockEnabled(
  accountId: string,
  enabled: boolean,
): Promise<void> {
  if (!accountId || !isNativePortalApp()) return;
  if (enabled) {
    await sensitiveAuthStorage.setItem(preferenceKey(accountId), 'enabled');
  } else {
    await sensitiveAuthStorage.removeItem(preferenceKey(accountId));
  }
  preferenceListeners.forEach((listener) => listener(accountId, enabled));
}

export function subscribePortalFacePreference(listener: PreferenceListener): () => void {
  preferenceListeners.add(listener);
  return () => preferenceListeners.delete(listener);
}
