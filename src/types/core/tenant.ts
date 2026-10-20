import type { ISODateTime, EntityId } from './base';

export type ProductKey =
  | 'office'
  | 'assist'
  | 'pflege'
  | 'stationaer'
  | 'beratung'
  | 'akademie';

/** Wie ein Mandanten-Modul freigeschaltet wurde. */
export type ModuleAccessSource =
  | 'purchased'
  | 'included_base'
  | 'trial'
  | 'admin_granted'
  | 'demo'
  | 'expired'
  | 'disabled'
  | 'free_active'
  | 'free_available';

/** Abrechnungsstatus je Modul — Free Platform + Legacy-Abrechnung. */
export type ModuleBillingStatus =
  | 'billable'
  | 'included'
  | 'not_billed'
  | 'free_active'
  | 'free_available'
  | 'premium_prepared'
  | 'admin_disabled';

export type ModuleAccessType = 'free' | 'premium_prepared' | 'admin_disabled' | 'legacy_paid';

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'inactive'
  | 'free_active';

export type Tenant = {
  id: EntityId;
  name: string;
  slug: string | null;
  legalForm: string | null;
  industry: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type TenantAddress = {
  id: EntityId;
  tenantId: string;
  street: string;
  zip: string;
  city: string;
  state: string | null;
  country: string;
  createdAt: ISODateTime;
};

export type TenantContact = {
  id: EntityId;
  tenantId: string;
  firstName: string;
  lastName: string;
  role: string;
  phone: string | null;
  email: string;
  isPrimary: boolean;
  createdAt: ISODateTime;
};

export type Product = {
  id: EntityId;
  key: ProductKey;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: ISODateTime;
};

export type TenantProduct = {
  id: EntityId;
  tenantId: string;
  productId: string;
  productKey: ProductKey;
  isActive: boolean;
  activatedAt: ISODateTime;
  accessSource: ModuleAccessSource;
  includedByModuleKey: ProductKey | null;
  isBaseIncluded: boolean;
  billingStatus: ModuleBillingStatus;
  accessType?: ModuleAccessType;
  priceCents?: number;
  premiumReady?: boolean;
};

/** Effektiver Modulzugriff inkl. automatisch enthaltenem Office. */
export type EffectiveModuleAccess = TenantProduct & {
  isEffective: boolean;
  accessSourceLabel: string;
};

export type TenantSubscription = {
  id: EntityId;
  tenantId: string;
  status: SubscriptionStatus;
  planKey: string | null;
  trialEndsAt: ISODateTime | null;
  currentPeriodStart: ISODateTime | null;
  currentPeriodEnd: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};
