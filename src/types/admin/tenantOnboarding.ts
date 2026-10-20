import type { EntityId, ISODateTime } from '@/types/core/base';
import type { ProductKey } from '@/types/core/tenant';
import type { DataQualityStatus } from '@/types/admin/dataQuality';

export type OnboardingOverallStatus =
  | 'not_started'
  | 'in_progress'
  | 'blocked'
  | 'ready_for_internal_test'
  | 'ready_for_pilot'
  | 'completed'
  | 'reopened';

export type OnboardingStepStatus =
  | 'pending'
  | 'completed'
  | 'warning'
  | 'blocked'
  | 'skipped'
  | 'not_applicable';

export type OnboardingStepKey =
  | 'company_data'
  | 'business_area'
  | 'modules'
  | 'roles'
  | 'employees'
  | 'clients'
  | 'services_prices'
  | 'billing'
  | 'documents_templates'
  | 'portals'
  | 'connect'
  | 'start_check';

export const ONBOARDING_STEP_ORDER: OnboardingStepKey[] = [
  'company_data',
  'business_area',
  'modules',
  'roles',
  'employees',
  'clients',
  'services_prices',
  'billing',
  'documents_templates',
  'portals',
  'connect',
  'start_check',
];

export const ONBOARDING_STEP_LABELS: Record<OnboardingStepKey, string> = {
  company_data: 'Firmendaten',
  business_area: 'Geschäftsbereich',
  modules: 'Module',
  roles: 'Rollen & Rechte',
  employees: 'Mitarbeitende',
  clients: 'Klient:innen',
  services_prices: 'Leistungen & Preise',
  billing: 'Abrechnung',
  documents_templates: 'Dokumente & Vorlagen',
  portals: 'Portale',
  connect: 'CareSuite+ Connect',
  start_check: 'Startprüfung',
};

export type TenantCompanyProfile = {
  tenantId: EntityId;
  name: string;
  legalForm: string | null;
  industry: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  managementName: string | null;
  registerNumber: string | null;
  taxId: string | null;
  vatId: string | null;
  ikNumber: string | null;
  bankName: string | null;
  iban: string | null;
  paymentTermsDays: number | null;
  taxStatus: string | null;
  statutoryBillingActive: boolean;
  updatedAt: ISODateTime;
};

export type TenantModuleSetup = {
  tenantId: EntityId;
  activeModules: ProductKey[];
  updatedAt: ISODateTime;
};

export type TenantOnboardingStep = {
  id: EntityId;
  sessionId: EntityId;
  tenantId: EntityId;
  stepKey: OnboardingStepKey;
  status: OnboardingStepStatus;
  completedAt: ISODateTime | null;
  notes: string | null;
  updatedAt: ISODateTime;
};

export type TenantOnboardingSession = {
  id: EntityId;
  tenantId: EntityId;
  overallStatus: OnboardingOverallStatus;
  currentStepKey: OnboardingStepKey;
  startedAt: ISODateTime | null;
  completedAt: ISODateTime | null;
  lastSavedAt: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type StartReadinessCheckKey =
  | 'company_profile'
  | 'modules_active'
  | 'roles_configured'
  | 'employees_present'
  | 'clients_present'
  | 'services_priced'
  | 'billing_ready'
  | 'documents_templates'
  | 'portals_privacy'
  | 'connect_configured'
  | 'data_quality'
  | 'minimum_data';

export type StartReadinessCheckResult = {
  checkKey: StartReadinessCheckKey;
  label: string;
  status: 'passed' | 'warning' | 'failed';
  message: string;
  dataQualityStatus?: DataQualityStatus;
};

export type TenantStartReadinessReport = {
  tenantId: EntityId;
  sessionId: EntityId;
  overallReady: boolean;
  checks: StartReadinessCheckResult[];
  recommendedStatus: OnboardingOverallStatus;
  evaluatedAt: ISODateTime;
};

export type TenantOnboardingCheckResult = {
  id: EntityId;
  sessionId: EntityId;
  tenantId: EntityId;
  checkKey: StartReadinessCheckKey;
  status: 'passed' | 'warning' | 'failed';
  message: string;
  evaluatedAt: ISODateTime;
};

export type TenantOnboardingAuditEvent = {
  id: EntityId;
  tenantId: EntityId;
  sessionId: EntityId;
  action: 'session_started' | 'step_updated' | 'session_saved' | 'start_check_run' | 'status_changed';
  stepKey?: OnboardingStepKey;
  detail: string;
  createdAt: ISODateTime;
};

export type OnboardingProgressSummary = {
  session: TenantOnboardingSession;
  steps: TenantOnboardingStep[];
  companyProfile: TenantCompanyProfile | null;
  moduleSetup: TenantModuleSetup | null;
  completedStepCount: number;
  totalStepCount: number;
  progressPercent: number;
};
