export type PlatformModuleAccessState =
  | 'active'
  | 'beta'
  | 'coming_soon'
  | 'disabled'
  | 'internal';

export type PlatformSubscriptionStatus =
  | 'active'
  | 'scheduled'
  | 'suspended'
  | 'cancelled'
  | 'expired';

export type PlatformBillingInterval = 'monthly' | 'yearly';

export type PlatformPlanVersion = {
  id: string;
  planKey: string;
  versionNumber: number;
  effectiveFrom: string;
  effectiveUntil: string | null;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  currency: string;
  status: 'draft' | 'active' | 'superseded' | 'archived';
};

export type PlatformPlanModule = {
  moduleKey: string;
  accessState: PlatformModuleAccessState;
};

export type PlatformPlanLimit = {
  limitKey: string;
  limitValue: number;
};

export type PlatformTenantSubscription = {
  planKey: string;
  planVersionId: string | null;
  status: PlatformSubscriptionStatus;
  billingInterval: PlatformBillingInterval;
  priceOverrideMonthlyCents: number | null;
  priceOverrideYearlyCents: number | null;
};

export type PlatformTenantAddon = {
  addonKey: string;
  addonName: string;
  billingInterval: PlatformBillingInterval;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  priceOverrideCents: number | null;
  status: 'active' | 'scheduled' | 'cancelled' | 'expired';
};

export type PlatformTenantDiscount = {
  discountKey: string;
  discountType: 'percentage' | 'fixed_amount' | string;
  percentage: number | null;
  amountCents: number | null;
  status: 'active' | 'scheduled' | 'expired' | 'revoked';
  startsAt: string | null;
  endsAt: string | null;
  catalogStatus?: string;
};

export type PlatformTenantEntitlement = {
  entitlementKey: string;
  entitlementType: 'module' | 'feature' | 'limit';
  moduleKey: string | null;
  accessState: PlatformModuleAccessState;
  sourceType: 'plan' | 'addon' | 'manual' | 'beta' | 'override';
  limitValue?: number | null;
};

export type PlatformPricingInput = {
  planVersions: PlatformPlanVersion[];
  planKey: string;
  billingInterval: PlatformBillingInterval;
  at?: string;
  priceOverrideMonthlyCents?: number | null;
  priceOverrideYearlyCents?: number | null;
  addons?: PlatformTenantAddon[];
};

export type PlatformPricingResult = {
  planVersion: PlatformPlanVersion | null;
  planPriceCents: number;
  addonTotalCents: number;
  subtotalCents: number;
  currency: string;
};

export type PlatformEntitlementInput = {
  subscriptionStatus: PlatformSubscriptionStatus | null;
  planModules: PlatformPlanModule[];
  addonModules: PlatformPlanModule[];
  manualOverrides: Array<{ moduleKey: string; accessState: PlatformModuleAccessState }>;
  betaModules: string[];
  moduleCatalog: Array<{
    moduleKey: string;
    status: string;
    isBeta?: boolean;
    isInternal?: boolean;
  }>;
};

export type PlatformBillingPreviewInput = {
  pricing: PlatformPricingResult;
  discounts: PlatformTenantDiscount[];
  creditBalanceCents: number;
  at?: string;
};

export type PlatformBillingPreviewResult = {
  subtotalCents: number;
  discountCents: number;
  creditCents: number;
  totalCents: number;
  lineItems: Array<{
    lineType: 'plan' | 'addon' | 'discount' | 'credit';
    description: string;
    amountCents: number;
  }>;
};
