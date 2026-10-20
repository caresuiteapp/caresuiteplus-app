/** Route zum Mandanten-Stammdaten-Bereich. */
export const TENANT_SETTINGS_ROUTE = '/settings/tenant';

/** Berechtigung für Mandanten-Stammdaten (nur Mandanten-Admin). */
export const TENANT_SETTINGS_PERMISSION = 'business.tenant.manage' as const;
