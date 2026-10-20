import { Platform } from 'react-native';
import { sensitiveAuthStorage } from '@/lib/security/sensitiveAuthStorage';

type LocalAuthenticationModule = typeof import('expo-local-authentication');

export type PortalFaceAvailability = {
  available: boolean;
  hardwareAvailable: boolean;
  enrolled: boolean;
  faceSupported: boolean;
  fingerprintSupported: boolean;
  strongBiometricEnrolled: boolean;
  methodLabel: string;
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
      fingerprintSupported: false,
      strongBiometricEnrolled: false,
      methodLabel: 'Gerätebiometrie',
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
    const fingerprintSupported = supportedTypes.includes(
      localAuthentication.AuthenticationType.FINGERPRINT,
    );
    const biometricSupported = faceSupported || fingerprintSupported;
    const strongBiometricEnrolled =
      enrolledLevel === localAuthentication.SecurityLevel.BIOMETRIC_STRONG;

    let reason: string | null = null;
    if (!hardwareAvailable) {
      reason = 'Dieses Gerät besitzt keine unterstützte biometrische Hardware.';
    } else if (!biometricSupported) {
      reason = 'Dieses Gerät bietet CareSuite keine unterstützte biometrische Entsperrung an.';
    } else if (!enrolled) {
      reason = 'Richten Sie zuerst Gesicht oder Fingerabdruck in den Geräteeinstellungen ein.';
    }

    const methodLabel = faceSupported && fingerprintSupported
      ? 'Gesicht oder Fingerabdruck'
      : faceSupported
        ? 'Gesichtserkennung'
        : fingerprintSupported
          ? 'Fingerabdruck'
          : 'Gerätebiometrie';

    return {
      available:
        hardwareAvailable && enrolled && biometricSupported,
      hardwareAvailable,
      enrolled,
      faceSupported,
      fingerprintSupported,
      strongBiometricEnrolled,
      methodLabel,
      reason,
    };
  } catch {
    return {
      available: false,
      hardwareAvailable: false,
      enrolled: false,
      faceSupported: false,
      fingerprintSupported: false,
      strongBiometricEnrolled: false,
      methodLabel: 'Gerätebiometrie',
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
      error: availability.reason ?? 'Biometrische Entsperrung ist nicht verfügbar.',
    };
  }

  try {
    const localAuthentication = await getLocalAuthentication();
    const result = await localAuthentication.authenticateAsync({
      promptMessage: 'CareSuite entsperren',
      promptSubtitle: availability.methodLabel,
      promptDescription:
        'Bestätigen Sie Ihre Identität, um persönliche Portal- und Gesundheitsdaten anzuzeigen.',
      cancelLabel: 'Abbrechen',
      fallbackLabel: 'Gerätecode verwenden',
      disableDeviceFallback: false,
      biometricsSecurityLevel: Platform.OS === 'android' ? 'weak' : 'strong',
      requireConfirmation: true,
    });

    if (result.success) return { ok: true };
    const cancelled = ['user_cancel', 'app_cancel', 'system_cancel'].includes(result.error);
    return {
      ok: false,
      cancelled,
      error: cancelled
        ? 'Geräteentsperrung wurde abgebrochen.'
        : result.error === 'lockout'
          ? 'Die Gerätebiometrie ist vorübergehend gesperrt. Bitte warten Sie oder melden Sie sich normal an.'
          : 'Ihre Identität wurde nicht bestätigt. Bitte versuchen Sie es erneut.',
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
