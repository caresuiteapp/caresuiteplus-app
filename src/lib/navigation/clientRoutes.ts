/** Canonical Office client intake & record routes (Client Intake Rebuild). */
export const CLIENT_INTAKE_NEW_ROUTE = '/business/office/clients/new' as const;

export function clientRecordRoute(clientId: string): `/business/office/clients/${string}` {
  return `/business/office/clients/${clientId}`;
}

/** @deprecated Prefer client record with ?edit=1 — opens ClientIntakeModal in edit mode. */
export function clientEditRoute(clientId: string): `/office/clients/${string}/edit` {
  return `/office/clients/${clientId}/edit`;
}

/** @deprecated Redirect alias — prefer CLIENT_INTAKE_NEW_ROUTE. */
export const CLIENT_CREATE_LEGACY_ROUTE = '/office/clients/create' as const;
