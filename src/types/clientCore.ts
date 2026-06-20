import type { EntityId, ISODateTime } from '@/types/core/base';

/** Canonical service type keys (K.0 steering dimension). */
export type ClientServiceTypeKey =
  | 'alltagsbegleitung'
  | 'betreuung'
  | 'begleitung'
  | 'ambulante_pflege'
  | 'stationaere_pflege'
  | 'beratung';

export type ClientServiceProfileStatus = 'active' | 'paused' | 'ended';

export type ClientBudgetMovementType =
  | 'allocation'
  | 'usage'
  | 'reservation'
  | 'release'
  | 'adjustment';

export type ClientPortalAccessRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type ClientPortalFeatureKey =
  | 'appointments'
  | 'messages'
  | 'documents'
  | 'proofs'
  | 'budget'
  | 'visit_tracking';

export type TenantClientServiceType = {
  id: EntityId;
  tenantId: EntityId;
  serviceTypeKey: ClientServiceTypeKey;
  careContextKey: string;
  name: string;
  description: string | null;
  moduleKeys: string[];
  colorKey: string | null;
  iconKey: string | null;
  isActive: boolean;
  isSystemTemplate: boolean;
  sortOrder: number;
  metadata: Record<string, unknown>;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type ClientServiceProfile = {
  id: EntityId;
  tenantId: EntityId;
  clientId: EntityId;
  serviceTypeId: EntityId;
  serviceTypeKey?: ClientServiceTypeKey;
  serviceTypeName?: string;
  isPrimary: boolean;
  status: ClientServiceProfileStatus;
  startedOn: string | null;
  endedOn: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type TenantServiceIntakeSection = {
  id: EntityId;
  tenantId: EntityId;
  serviceTypeId: EntityId;
  sectionKey: string;
  isRequired: boolean;
  isVisible: boolean;
  sortOrder: number;
};

export type TenantBudgetYear = {
  id: EntityId;
  tenantId: EntityId;
  budgetYear: number;
  label: string | null;
  isActive: boolean;
};

export type TenantBudgetType = {
  id: EntityId;
  tenantId: EntityId;
  budgetTypeKey: string;
  name: string;
  description: string | null;
  period: 'monthly' | 'yearly' | 'quarterly';
  currency: string;
  isActive: boolean;
  sortOrder: number;
};

export type TenantBudgetDefault = {
  id: EntityId;
  tenantId: EntityId;
  budgetYearId: EntityId;
  budgetTypeId: EntityId;
  amountCents: number;
  conversionRatePct: number | null;
  monthlyAmountCents: number | null;
  yearlyAmountCents: number | null;
  notes: string | null;
};

export type ClientBudgetSetting = {
  id: EntityId;
  tenantId: EntityId;
  clientId: EntityId;
  budgetYearId: EntityId;
  budgetTypeId: EntityId;
  budgetYear?: number;
  budgetTypeKey?: string;
  budgetTypeName?: string;
  allocatedCents: number;
  usedCents: number;
  reservedCents: number;
  conversionRatePct: number | null;
  monthlyLimitCents: number | null;
  yearlyLimitCents: number | null;
  notes: string | null;
  remainingCents?: number;
};

export type ClientBudgetMovement = {
  id: EntityId;
  tenantId: EntityId;
  clientId: EntityId;
  budgetSettingId: EntityId;
  movementType: ClientBudgetMovementType;
  amountCents: number;
  referenceType: string | null;
  referenceId: EntityId | null;
  note: string | null;
  createdAt: ISODateTime;
};

export type TenantClientPortalDefaults = {
  id: EntityId;
  tenantId: EntityId;
  portalEnabled: boolean;
  showAppointments: boolean;
  showMessages: boolean;
  showDocuments: boolean;
  showProofs: boolean;
  showBudget: boolean;
  showVisitTracking: boolean;
  allowAccessRequests: boolean;
};

export type ClientPortalSettingsResolved = {
  portalEnabled: boolean;
  showAppointments: boolean;
  showMessages: boolean;
  showDocuments: boolean;
  showProofs: boolean;
  showBudget: boolean;
  showVisitTracking: boolean;
  inheritTenantDefaults: boolean;
  source: 'tenant' | 'client' | 'merged';
};

export type ClientPortalAccessRequest = {
  id: EntityId;
  tenantId: EntityId;
  clientId: EntityId;
  requesterName: string;
  requesterEmail: string | null;
  requesterPhone: string | null;
  requestType: string;
  status: ClientPortalAccessRequestStatus;
  requestedFeatures: string[];
  reviewNote: string | null;
  reviewedAt: ISODateTime | null;
  createdAt: ISODateTime;
};

export type ClientRecordCompleteness = {
  scorePct: number;
  missingSections: string[];
  configuredServiceTypes: number;
  hasBudgetSettings: boolean;
  hasPortalSettings: boolean;
};

export const CLIENT_SERVICE_TYPE_LABELS: Record<ClientServiceTypeKey, string> = {
  alltagsbegleitung: 'Alltagsbegleitung',
  betreuung: 'Betreuung',
  begleitung: 'Begleitung',
  ambulante_pflege: 'Ambulante Pflege',
  stationaere_pflege: 'Stationäre Pflege',
  beratung: 'Beratung',
};

export const SERVICE_TYPE_TO_CARE_CONTEXT: Record<ClientServiceTypeKey, string> = {
  alltagsbegleitung: 'daily_assistance',
  betreuung: 'support_care',
  begleitung: 'companionship',
  ambulante_pflege: 'ambulatory_care',
  stationaere_pflege: 'stationary_care',
  beratung: 'consulting',
};

export const CARE_CONTEXT_TO_SERVICE_TYPE: Record<string, ClientServiceTypeKey> = {
  daily_assistance: 'alltagsbegleitung',
  support_care: 'betreuung',
  companionship: 'begleitung',
  ambulatory_care: 'ambulante_pflege',
  stationary_care: 'stationaere_pflege',
  consulting: 'beratung',
};
