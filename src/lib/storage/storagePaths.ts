/** Mandanten-isolierter Storage-Pfad-Präfix — muss mit Supabase storage.objects Policies übereinstimmen. */
export const TENANT_STORAGE_PREFIX = 'tenant';

/** Baut einen tenant-isolierten Objektpfad: `tenant/{tenantId}/seg1/seg2/…` */
export function buildTenantStoragePath(tenantId: string, ...segments: string[]): string {
  return [TENANT_STORAGE_PREFIX, tenantId, ...segments.filter(Boolean)].join('/');
}
