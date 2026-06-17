import { getServiceMode } from '@/lib/services/mode';

/** Canonical Office client intake & record routes (Client Intake Rebuild). */
export const CLIENT_INTAKE_NEW_ROUTE = '/business/office/clients/new' as const;

/** Production create wizard (Supabase mode). */
export const CLIENT_CREATE_LEGACY_ROUTE = '/office/clients/create' as const;

export function clientCreateRoute(): typeof CLIENT_INTAKE_NEW_ROUTE | typeof CLIENT_CREATE_LEGACY_ROUTE {
  return getServiceMode() === 'supabase' ? CLIENT_CREATE_LEGACY_ROUTE : CLIENT_INTAKE_NEW_ROUTE;
}

export function clientRecordRoute(clientId: string): `/business/office/clients/${string}` {
  return `/business/office/clients/${clientId}`;
}

/** Stammdaten bearbeiten — business office edit route. */
export function clientEditRoute(clientId: string): `/business/office/clients/${string}/edit` {
  return `/business/office/clients/${clientId}/edit`;
}

export function clientRecordTabRoute(
  clientId: string,
  tab: string,
): `/business/office/clients/${string}` {
  return `/business/office/clients/${clientId}?tab=${tab}`;
}
