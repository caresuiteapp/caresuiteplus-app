import { actionPermissions, type DevicePermissionItem, type DevicePermissionStatus } from './devicePermissions.types';
export * from './devicePermissions.types';

async function readBrowserPermission(name: string): Promise<DevicePermissionStatus> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unavailable';
  try {
    const result = await navigator.permissions.query({ name: name as PermissionName });
    return result.state === 'granted' ? 'granted' : result.state === 'denied' ? 'denied' : 'undetermined';
  } catch { return 'unavailable'; }
}
export async function readDevicePermissions(includeLocation = false): Promise<DevicePermissionItem[]> {
  const [camera, microphone, location] = await Promise.all([
    readBrowserPermission('camera'), readBrowserPermission('microphone'),
    includeLocation ? readBrowserPermission('geolocation') : Promise.resolve('unavailable' as const),
  ]);
  const items: DevicePermissionItem[] = [
    { key: 'camera', title: 'Kamera', purpose: 'Aufnahme erst nach Ihrer bewussten Aktion und Browserfreigabe.', kind: 'system', status: camera },
    { key: 'microphone', title: 'Mikrofon', purpose: 'Optional für bewusst gestartete Spracheingaben.', kind: 'system', status: microphone },
  ];
  if (includeLocation) items.push({ key: 'location', title: 'Standort bei Nutzung', purpose: 'Einsatzbezogene Standortfunktionen; kein verlässlicher Hintergrundbetrieb im Browser.', kind: 'system', status: location });
  return [...items, ...actionPermissions];
}
export async function openDevicePermissionSettings(): Promise<void> {
  throw new Error('Öffnen Sie die Website-Berechtigungen über das Symbol neben der Browseradresse.');
}
