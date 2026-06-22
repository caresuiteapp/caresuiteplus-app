import type { Product, Profile, Role, Tenant, TenantProduct, TenantSubscription } from '@/types';
import { demoProfiles } from './profiles';
import { demoProducts, demoTenantProducts } from './products';
import { demoRoles } from './roles';
import {
  demoTenant,
  demoTenantAddress,
  demoTenantContact,
  demoTenantSubscription,
  DEMO_TENANT_ID,
} from './tenant';

export type DemoFoundationSnapshot = {
  tenant: Tenant;
  tenantId: string;
  address: typeof demoTenantAddress;
  contact: typeof demoTenantContact;
  subscription: TenantSubscription;
  products: Product[];
  tenantProducts: TenantProduct[];
  roles: Role[];
  profiles: Profile[];
  isDemoMode: boolean;
  supabaseConnected: boolean;
};

/** @deprecated Dev-tool preview only — use buildDevFoundationPreview in FundamentScreen. */
export function getDemoFoundationSnapshot(
  isDemoMode = false,
  supabaseConnected = false,
): DemoFoundationSnapshot {
  return {
    tenant: demoTenant,
    tenantId: DEMO_TENANT_ID,
    address: demoTenantAddress,
    contact: demoTenantContact,
    subscription: demoTenantSubscription,
    products: demoProducts,
    tenantProducts: demoTenantProducts,
    roles: demoRoles,
    profiles: demoProfiles,
    isDemoMode,
    supabaseConnected,
  };
}

export { DEMO_TENANT_ID, TEST_TENANT_ID } from '@/data/constants/testTenant';
export { ROLE_LABELS } from '@/data/constants/roleLabels';
export {
  ROLE_PERMISSIONS,
  PERMISSION_LABELS,
  PERMISSION_DENIED_MESSAGES,
  getPermissionsForRole,
} from '@/lib/permissions/staticRolePermissions';
export { PRODUCT_LABELS } from '@/data/constants/productLabels';
export {
  MODULE_NAV_CONFIG,
  PUBLIC_ENTRIES,
  DEV_TOOL_ENTRIES,
  DEMO_LOGIN_ROLES,
} from '@/data/navigation/moduleNavConfig';
export { buildDemoDashboard } from './dashboard';
export { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
export { buildOfficeDashboard, OFFICE_AREA_SHORTCUTS } from './officeDashboard';
export { demoClients } from './clients';
export { demoEmployees } from './employees';
export { demoAppointments, demoInvoices, demoPortalMessages, demoPortalDocuments, demoBudgets } from './seedCatalog';
export { getDemoSeedSummary } from './seedCatalog';
export { getDemoProfileForRole } from './profiles';
export { DEMO_SUPABASE_IDS, DEMO_CLIENT_UUIDS } from './uuidMap';
