/** Supabase seed demo tenant UUID — block in production (see 0004_demo_seed.sql). */
export const DEMO_SUPABASE_UUID = 'a0000000-0000-4000-8000-000000000001';

/** E2E / QA tenants — internal_test, not production demo leak. */
export const E2E_TEST_TENANT_ID = 'a4ba83bd-65db-46cf-8cf7-61492cc78315';

export const INTERNAL_TEST_TENANT_IDS = [
  E2E_TEST_TENANT_ID,
  '6e8a5c3b-03fd-423d-acd9-00edf9b24f99',
] as const;

/** Prefix match for pilot-verify tenants (e.g. 3d6220dd-…). */
export const INTERNAL_TEST_TENANT_PREFIXES = ['3d6220dd'] as const;

/** Confirmed live tenants — never treat as demo. */
export const LIVE_PROTECTED_TENANT_IDS = [
  '56180c22-b894-4fab-b55e-a563c94dd6e7',
] as const;

export function isDemoSupabaseTenantId(tenantId: string): boolean {
  return tenantId.trim() === DEMO_SUPABASE_UUID;
}

export function isInternalTestTenantId(tenantId: string): boolean {
  const id = tenantId.trim();
  if ((INTERNAL_TEST_TENANT_IDS as readonly string[]).includes(id)) return true;
  return INTERNAL_TEST_TENANT_PREFIXES.some((prefix) => id.startsWith(prefix));
}

export function isLiveProtectedTenantId(tenantId: string): boolean {
  return (LIVE_PROTECTED_TENANT_IDS as readonly string[]).includes(tenantId.trim());
}
