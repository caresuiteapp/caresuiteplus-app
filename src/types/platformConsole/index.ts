export type PlatformRoleKey =
  | 'platform_owner'
  | 'platform_admin'
  | 'platform_billing'
  | 'platform_support'
  | 'platform_developer'
  | 'platform_readonly';

export type PlatformUserStatus = 'active' | 'disabled' | 'revoked';

export type PlatformTenantStatus =
  | 'active'
  | 'suspended'
  | 'locked'
  | 'terminated'
  | 'deleted_soft';

export type PlatformLifecycleStatus =
  | 'lead'
  | 'onboarding'
  | 'trial'
  | 'live'
  | 'paused'
  | 'offboarding'
  | 'terminated';

export type PlatformBillingStatus =
  | 'trial'
  | 'active'
  | 'past_due'
  | 'failed'
  | 'manual_free'
  | 'invoice_pending'
  | 'cancelled';

export type PlatformModuleStatus =
  | 'enabled'
  | 'disabled'
  | 'trial'
  | 'scheduled'
  | 'expired'
  | 'locked'
  | 'beta_enabled';

export type PlatformCapability =
  | 'tenants.read'
  | 'tenants.write'
  | 'tenants.suspend'
  | 'modules.read'
  | 'modules.write'
  | 'plans.read'
  | 'plans.write'
  | 'discounts.read'
  | 'discounts.write'
  | 'billing.read'
  | 'billing.write'
  | 'payments.read'
  | 'payments.write'
  | 'flags.read'
  | 'flags.write'
  | 'support.read'
  | 'support.write'
  | 'audit.read'
  | 'system.read'
  | 'system.write'
  | 'users.read'
  | 'users.write'
  | 'releases.read';

export type PlatformUser = {
  id: string;
  userId: string;
  email: string;
  fullName: string | null;
  role: PlatformRoleKey;
  status: PlatformUserStatus;
  lastLoginAt: string | null;
};

export type PlatformTenantListItem = {
  id: string;
  tenantId: string;
  tenantName: string;
  legalName: string | null;
  slug: string | null;
  status: PlatformTenantStatus;
  lifecycleStatus: PlatformLifecycleStatus;
  billingStatus: PlatformBillingStatus;
  planKey: string | null;
  trialEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
  activeModuleCount: number;
};

export type PlatformDashboardSummary = {
  tenants: {
    active: number;
    trial: number;
    suspended: number;
    onboarding: number;
    pastDue: number;
    cancelled: number;
  };
  billing: {
    openInvoices: number;
    pastDueInvoices: number;
    failedPayments: number;
    activeDiscounts: number;
  };
  modules: {
    betaActive: number;
    trialExpiring: number;
  };
  system: {
    activeFeatureFlags: number;
    activeSupportSessions: number;
    maintenanceMode: boolean;
  };
};

export type PlatformTenantModuleRow = {
  moduleKey: string;
  moduleName: string;
  status: PlatformModuleStatus | 'disabled';
  isTrial: boolean | null;
  trialEndsAt: string | null;
  manualOverride: boolean | null;
};

export type PlatformAuditEntry = {
  id: string;
  actor_user_id: string | null;
  actor_role: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  tenant_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
};

export type PlatformNavItem = {
  path: string;
  label: string;
  icon: string;
  group?: 'overview' | 'customers' | 'product' | 'finance' | 'operations';
  capability?: PlatformCapability;
};

export type PlatformDiscountType =
  | 'percentage'
  | 'fixed_amount'
  | 'free_months'
  | 'lifetime_discount'
  | 'beta_discount'
  | 'manual_credit'
  | 'goodwill_credit'
  | 'partner_discount';

export type PlatformDiscountRow = {
  id: string;
  discount_key: string;
  discount_name: string;
  discount_type: PlatformDiscountType;
  value: number | null;
  status: string;
  description: string | null;
  created_at: string;
};

export type PlatformTenantDiscountRow = {
  id: string;
  tenant_id: string;
  discount_key: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  reason: string | null;
  assigned_at: string;
};

export type PlatformInvoiceRow = {
  id: string;
  tenant_id: string;
  invoice_number: string;
  status: string;
  amount_cents: number;
  tax_cents: number | null;
  net_cents: number | null;
  currency: string;
  due_at: string | null;
  issued_at: string | null;
  paid_at: string | null;
  created_at: string;
};

export type PlatformPaymentRow = {
  id: string;
  tenant_id: string;
  invoice_id: string | null;
  amount_cents: number;
  status: string;
  provider: string | null;
  provider_payment_id: string | null;
  payment_method: string | null;
  failure_reason: string | null;
  created_at: string;
};

export type PlatformFeatureFlagRow = {
  id: string;
  flag_key: string;
  flag_name: string;
  scope: string;
  tenant_id: string | null;
  enabled: boolean;
  rollout_percentage: number | null;
  starts_at: string | null;
  ends_at: string | null;
  updated_at: string;
};

export type PlatformSupportSessionRow = {
  id: string;
  tenant_id: string;
  status: string;
  readonly: boolean;
  allowed_scopes: string[] | null;
  reason: string | null;
  started_at: string;
  expires_at: string;
  ended_at: string | null;
};

export type PlatformOperatorUserRow = {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: PlatformRoleKey;
  status: PlatformUserStatus;
  last_login_at: string | null;
  updated_at: string;
};

export type PlatformReleaseRow = {
  id: string;
  environment: 'preview' | 'staging' | 'production';
  version_label: string;
  commit_sha: string | null;
  status: 'planned' | 'building' | 'ready' | 'failed' | 'rolled_back';
  deployment_url: string | null;
  migration_version: string | null;
  checks: Record<string, unknown>;
  notes: string | null;
  deployed_at: string;
};

export type PlatformTenantUserRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  role_key: string | null;
  updated_at: string;
};
