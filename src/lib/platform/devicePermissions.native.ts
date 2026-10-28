import { Linking } from 'react-native';
import { actionPermissions, permissionStatus, type DevicePermissionItem } from './devicePermissions.types';
export * from './devicePermissions.types';

/** Read only: opening the overview must never prompt for a device permission. */
export async function readDevicePermissions(includeLocation = false): Promise<DevicePermissionItem[]> {
  const read = async (load: () => Promise<{ granted?: boolean; status?: string }>) => {
    try { return permissionStatus(await load()); } catch { return 'unavailable' as const; }
  };
  const [notifications, camera, microphone, biometric] = await Promise.all([
    read(async () => (await import('expo-notifications')).getPermissionsAsync()),
    read(async () => (await import('expo-image-picker')).getCameraPermissionsAsync()),
    read(async () => (await import('expo-audio')).getRecordingPermissionsAsync()),
    (async () => {
      try {
        const module = await import('expo-local-authentication');
        return await module.hasHardwareAsync() && await module.isEnrolledAsync() ? 'granted' as const : 'unavailable' as const;
      } catch { return 'unavailable' as const; }
    })(),
  ]);
  const items: DevicePermissionItem[] = [
    { key: 'notifications', title: 'Benachrichtigungen', purpose: 'Einsätze, Änderungen, Nachrichten und offene Unterschriften. Die Freigabe bleibt freiwillig.', kind: 'system', status: notifications },
    { key: 'camera', title: 'Kamera', purpose: 'Erst beim Start einer Aufnahme für Dokumentation oder Belege anfragen.', kind: 'system', status: camera },
    { key: 'microphone', title: 'Mikrofon', purpose: 'Optional für bewusst gestartete Spracheingaben oder Videos mit Ton.', kind: 'system', status: microphone },
    { key: 'biometric', title: 'Gerätebiometrie', purpose: 'Gesicht, Fingerabdruck oder Gerätecode zum lokalen Entsperren; Einrichtung im Profil.', kind: 'system', status: biometric },
  ];
  if (includeLocation) {
    const [foreground, background] = await Promise.all([
      read(async () => (await import('expo-location')).getForegroundPermissionsAsync()), read(async () => (await import('expo-location')).getBackgroundPermissionsAsync()),
    ]);
    items.push(
      { key: 'location', title: 'Standort bei Nutzung', purpose: 'Nur für gestartete dienstliche Fahrten und einsatzbezogene Standortfunktionen.', kind: 'system', status: foreground },
      { key: 'background_location', title: 'Standort im Hintergrund', purpose: 'Für eine laufende Fahrt bei gesperrtem Display; getrennt nach der Vordergrundfreigabe anfragen.', kind: 'system', status: background },
    );
  }
  return [...items, ...actionPermissions];
}
export async function openDevicePermissionSettings(): Promise<void> { await Linking.openSettings(); }
