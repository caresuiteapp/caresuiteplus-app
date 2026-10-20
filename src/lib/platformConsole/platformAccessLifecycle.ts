export type PlatformTenantAccessAction = 'suspend' | 'unsuspend' | 'deactivate' | 'reactivate' | 'delete' | 'restore';
export type PlatformAccountAccessAction = 'deactivate' | 'reactivate' | 'delete' | 'restore';
export type PlatformAccountAccessState = 'active' | 'inactive' | 'deleted';
export const PLATFORM_ACCESS_RELEASE = 'caresuite-platform-access-controls-20261007';

export const TENANT_ACCESS_ACTIONS: Record<PlatformTenantAccessAction, { label: string; audit: string; danger?: boolean }> = {
  suspend: { label: 'Sperren', audit: 'tenant.suspended', danger: true },
  unsuspend: { label: 'Entsperren', audit: 'tenant.unsuspended' },
  deactivate: { label: 'Deaktivieren', audit: 'tenant.deactivated', danger: true },
  reactivate: { label: 'Reaktivieren', audit: 'tenant.reactivated' },
  delete: { label: 'Löschen', audit: 'tenant.deleted', danger: true },
  restore: { label: 'Wiederherstellen', audit: 'tenant.restored' },
};
export const ACCOUNT_ACCESS_ACTIONS: Record<PlatformAccountAccessAction, string> = {
  deactivate: 'Konto deaktivieren', reactivate: 'Konto reaktivieren', delete: 'Konto löschen', restore: 'Konto wiederherstellen',
};
export function tenantAccessActions(status: unknown): PlatformTenantAccessAction[] {
  if (status === 'deleted_soft') return ['restore'];
  if (status === 'terminated') return ['reactivate', 'delete'];
  if (status === 'suspended' || status === 'locked') return ['unsuspend', 'deactivate', 'delete'];
  return status === 'active' ? ['suspend', 'deactivate', 'delete'] : [];
}
export function accountAccessActions(state: PlatformAccountAccessState, status: string): PlatformAccountAccessAction[] {
  if (state === 'deleted') return ['restore'];
  if (state === 'inactive') return ['reactivate', 'delete'];
  if (status === 'archived') return [];
  return ['active', 'pending_first_login', 'password_reset_required'].includes(status) ? ['deactivate', 'delete'] : ['delete'];
}
export function tenantAccessConfirmation(action: PlatformTenantAccessAction, name: string): string | undefined {
  if (action === 'delete') return name.trim();
  return action === 'suspend' ? 'SPERREN' : action === 'deactivate' ? 'DEAKTIVIEREN' : undefined;
}
export function accountAccessConfirmation(action: PlatformAccountAccessAction, accountName: string): string | undefined {
  return action === 'delete' ? accountName.trim() : action === 'deactivate' ? 'DEAKTIVIEREN' : undefined;
}
export function tenantAccessDescription(action: PlatformTenantAccessAction, name: string): string {
  const target = `Unternehmen „${name}“`;
  switch (action) {
    case 'suspend': return `${target} wird vorübergehend gesperrt. Der Zugriff auf die Unternehmensdaten wird beendet. Die Daten bleiben erhalten.`;
    case 'unsuspend': return `${target} wird entsperrt. Bereits einzeln deaktivierte oder gelöschte Konten bleiben gesperrt.`;
    case 'deactivate': return `${target} wird deaktiviert. Die zugehörigen Zugänge erhalten keinen Zugriff auf die Unternehmensdaten. Das Unternehmen bleibt in der Verwaltung sichtbar und kann später reaktiviert werden.`;
    case 'reactivate': return `${target} wird wieder aktiviert. Bereits einzeln deaktivierte oder gelöschte Konten bleiben gesperrt.`;
    case 'delete': return `${target} wird aus der laufenden Übersicht entfernt und unter „Gelöscht“ geführt. Der Zugriff auf die Unternehmensdaten wird beendet. Unternehmensdaten, Nachweise und Änderungsprotokolle bleiben erhalten; dies ist keine endgültige Datenlöschung.`;
    case 'restore': return `${target} wird in die Übersicht zurückgeholt und bleibt zunächst deaktiviert. Prüfen Sie die Akte, bevor Sie das Unternehmen reaktivieren.`;
  }
}
export function accountAccessDescription(action: PlatformAccountAccessAction, name: string): string {
  const target = `Konto „${name}“`;
  switch (action) {
    case 'deactivate': return `${target} erhält keinen Zugriff mehr auf dieses Unternehmen. Das Konto bleibt sichtbar und kann später reaktiviert werden. Zugänge zu anderen Unternehmen bleiben erhalten.`;
    case 'reactivate': return `${target} wird für dieses Unternehmen reaktiviert. Ein gesperrtes oder deaktiviertes Unternehmen bleibt weiterhin unzugänglich.`;
    case 'delete': return `${target} wird aus der laufenden Kontenliste entfernt und unter „Gelöschte Konten“ geführt. Der Zugang zu diesem Unternehmen wird beendet. Nachweise und Änderungsprotokolle bleiben erhalten. Zugänge zu anderen Unternehmen werden nicht gelöscht.`;
    case 'restore': return `${target} wird mit seinem Zustand vor der Löschung wiederhergestellt. War es zuvor deaktiviert, muss es anschließend gesondert reaktiviert werden.`;
  }
}
