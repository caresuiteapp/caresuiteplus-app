import type { ProductKey } from '@/types/core/tenant';
import type {
  OnboardingProgressSummary,
  OnboardingStepKey,
  OnboardingStepStatus,
  TenantCompanyProfile,
  TenantModuleSetup,
  TenantOnboardingAuditEvent,
  TenantOnboardingCheckResult,
  TenantOnboardingSession,
  TenantOnboardingStep,
  TenantStartReadinessReport,
} from '@/types/admin/tenantOnboarding';
import { ONBOARDING_STEP_ORDER } from '@/types/admin/tenantOnboarding';

type TenantOnboardingStore = {
  session: TenantOnboardingSession;
  steps: TenantOnboardingStep[];
  companyProfile: TenantCompanyProfile | null;
  moduleSetup: TenantModuleSetup | null;
  checkResults: TenantOnboardingCheckResult[];
  auditEvents: TenantOnboardingAuditEvent[];
  lastReadinessReport: TenantStartReadinessReport | null;
  employeeCount: number;
  clientCount: number;
  rolesConfigured: boolean;
  servicesConfigured: boolean;
  connectConfigured: boolean;
  portalPrivacyChecked: boolean;
};

const stores = new Map<string, TenantOnboardingStore>();

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function createDefaultSteps(sessionId: string, tenantId: string): TenantOnboardingStep[] {
  const now = new Date().toISOString();
  return ONBOARDING_STEP_ORDER.map((stepKey) => ({
    id: nextId('obs'),
    sessionId,
    tenantId,
    stepKey,
    status: 'pending' as OnboardingStepStatus,
    completedAt: null,
    notes: null,
    updatedAt: now,
  }));
}

function emptyStore(tenantId: string): TenantOnboardingStore {
  const now = new Date().toISOString();
  const sessionId = nextId('onb');
  const session: TenantOnboardingSession = {
    id: sessionId,
    tenantId,
    overallStatus: 'not_started',
    currentStepKey: 'company_data',
    startedAt: null,
    completedAt: null,
    lastSavedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  return {
    session,
    steps: createDefaultSteps(sessionId, tenantId),
    companyProfile: null,
    moduleSetup: null,
    checkResults: [],
    auditEvents: [],
    lastReadinessReport: null,
    employeeCount: 0,
    clientCount: 0,
    rolesConfigured: false,
    servicesConfigured: false,
    connectConfigured: false,
    portalPrivacyChecked: false,
  };
}

function getStore(tenantId: string): TenantOnboardingStore {
  let store = stores.get(tenantId);
  if (!store) {
    store = emptyStore(tenantId);
    stores.set(tenantId, store);
  }
  return store;
}

export function resetTenantOnboardingStore(tenantId?: string): void {
  if (tenantId) {
    stores.delete(tenantId);
    return;
  }
  stores.clear();
}

export function getTenantOnboardingStoreSnapshot(tenantId: string): Readonly<TenantOnboardingStore> {
  return getStore(tenantId);
}

export function readOnboardingSession(tenantId: string): TenantOnboardingSession {
  return getStore(tenantId).session;
}

export function readOnboardingSteps(tenantId: string): TenantOnboardingStep[] {
  return [...getStore(tenantId).steps];
}

export function readCompanyProfile(tenantId: string): TenantCompanyProfile | null {
  return getStore(tenantId).companyProfile;
}

export function writeCompanyProfile(
  tenantId: string,
  profile: Partial<TenantCompanyProfile>,
): TenantCompanyProfile {
  const store = getStore(tenantId);
  const now = new Date().toISOString();
  store.companyProfile = {
    tenantId,
    name: profile.name ?? store.companyProfile?.name ?? '',
    legalForm: profile.legalForm ?? store.companyProfile?.legalForm ?? null,
    industry: profile.industry ?? store.companyProfile?.industry ?? null,
    street: profile.street ?? store.companyProfile?.street ?? null,
    zip: profile.zip ?? store.companyProfile?.zip ?? null,
    city: profile.city ?? store.companyProfile?.city ?? null,
    phone: profile.phone ?? store.companyProfile?.phone ?? null,
    email: profile.email ?? store.companyProfile?.email ?? null,
    managementName: profile.managementName ?? store.companyProfile?.managementName ?? null,
    registerNumber: profile.registerNumber ?? store.companyProfile?.registerNumber ?? null,
    taxId: profile.taxId ?? store.companyProfile?.taxId ?? null,
    vatId: profile.vatId ?? store.companyProfile?.vatId ?? null,
    ikNumber: profile.ikNumber ?? store.companyProfile?.ikNumber ?? null,
    bankName: profile.bankName ?? store.companyProfile?.bankName ?? null,
    iban: profile.iban ?? store.companyProfile?.iban ?? null,
    paymentTermsDays: profile.paymentTermsDays ?? store.companyProfile?.paymentTermsDays ?? null,
    taxStatus: profile.taxStatus ?? store.companyProfile?.taxStatus ?? null,
    statutoryBillingActive:
      profile.statutoryBillingActive ?? store.companyProfile?.statutoryBillingActive ?? false,
    updatedAt: now,
  };
  return store.companyProfile;
}

export function writeModuleSetup(tenantId: string, activeModules: ProductKey[]): TenantModuleSetup {
  const store = getStore(tenantId);
  store.moduleSetup = {
    tenantId,
    activeModules,
    updatedAt: new Date().toISOString(),
  };
  return store.moduleSetup;
}

export function updateOnboardingCounters(
  tenantId: string,
  counters: Partial<{
    employeeCount: number;
    clientCount: number;
    rolesConfigured: boolean;
    servicesConfigured: boolean;
    connectConfigured: boolean;
    portalPrivacyChecked: boolean;
  }>,
): void {
  Object.assign(getStore(tenantId), counters);
}

export function updateOnboardingStep(
  tenantId: string,
  stepKey: OnboardingStepKey,
  status: OnboardingStepStatus,
  notes?: string | null,
): TenantOnboardingStep {
  const store = getStore(tenantId);
  const step = store.steps.find((s) => s.stepKey === stepKey);
  if (!step) throw new Error(`Onboarding step not found: ${stepKey}`);
  step.status = status;
  step.notes = notes ?? step.notes;
  step.updatedAt = new Date().toISOString();
  if (status === 'completed') {
    step.completedAt = new Date().toISOString();
  }
  return step;
}

export function patchOnboardingSession(
  tenantId: string,
  patch: Partial<TenantOnboardingSession>,
): TenantOnboardingSession {
  const store = getStore(tenantId);
  store.session = {
    ...store.session,
    ...patch,
    updatedAt: new Date().toISOString(),
    lastSavedAt: new Date().toISOString(),
  };
  return store.session;
}

export function appendOnboardingAuditEvent(
  tenantId: string,
  event: Omit<TenantOnboardingAuditEvent, 'id' | 'tenantId' | 'createdAt'>,
): TenantOnboardingAuditEvent {
  const entry: TenantOnboardingAuditEvent = {
    id: nextId('onba'),
    tenantId,
    createdAt: new Date().toISOString(),
    ...event,
  };
  getStore(tenantId).auditEvents.push(entry);
  return entry;
}

export function saveStartReadinessReport(
  tenantId: string,
  report: TenantStartReadinessReport,
): void {
  const store = getStore(tenantId);
  store.lastReadinessReport = report;
  store.checkResults = report.checks.map((check) => ({
    id: nextId('onbc'),
    sessionId: report.sessionId,
    tenantId,
    checkKey: check.checkKey,
    status: check.status,
    message: check.message,
    evaluatedAt: report.evaluatedAt,
  }));
}

export function readStartReadinessReport(tenantId: string): TenantStartReadinessReport | null {
  return getStore(tenantId).lastReadinessReport;
}

export function listOnboardingAuditEvents(tenantId: string): TenantOnboardingAuditEvent[] {
  return [...getStore(tenantId).auditEvents];
}

export function buildOnboardingProgressSummary(tenantId: string): OnboardingProgressSummary {
  const store = getStore(tenantId);
  const completedStepCount = store.steps.filter((s) => s.status === 'completed').length;
  const totalStepCount = store.steps.length;
  return {
    session: store.session,
    steps: [...store.steps],
    companyProfile: store.companyProfile,
    moduleSetup: store.moduleSetup,
    completedStepCount,
    totalStepCount,
    progressPercent: Math.round((completedStepCount / totalStepCount) * 100),
  };
}
