export type DevicePermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable' | 'on_action';
export type DevicePermissionItem = {
  key: string;
  title: string;
  purpose: string;
  status: DevicePermissionStatus;
  kind: 'system' | 'picker' | 'workflow';
};
export const devicePermissionLabels: Record<DevicePermissionStatus, string> = {
  granted: 'Vom Gerät erlaubt', denied: 'Vom Gerät abgelehnt',
  undetermined: 'Noch nicht freigegeben', unavailable: 'Hier nicht verfügbar',
  on_action: 'Bei der jeweiligen Aktion',
};
export function permissionStatus(value: { granted?: boolean; status?: string }): DevicePermissionStatus {
  return value.granted || value.status === 'granted' ? 'granted'
    : value.status === 'denied' ? 'denied' : 'undetermined';
}
export const actionPermissions: DevicePermissionItem[] = [
  { key: 'photos', title: 'Fotos und Videos auswählen', purpose: 'Nur ausgewählte Bilder und Videos hinzufügen; kein pauschaler Galeriezugriff.', kind: 'picker', status: 'on_action' },
  { key: 'files', title: 'Dateien und PDFs', purpose: 'Dokumente und Belege gezielt über die Systemauswahl öffnen.', kind: 'picker', status: 'on_action' },
  { key: 'signature', title: 'Unterschriften', purpose: 'Unterschreiben ist eine fachlich freigegebene CareSuite-Funktion und benötigt keine Geräteberechtigung.', kind: 'workflow', status: 'on_action' },
];
