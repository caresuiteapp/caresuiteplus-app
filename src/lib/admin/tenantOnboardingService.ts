import type { ProductKey } from '@/types/core/tenant';
import type {
  OnboardingOverallStatus,
  OnboardingProgressSummary,
  OnboardingStepKey,
  OnboardingStepStatus,
  StartReadinessCheckKey,
  StartReadinessCheckResult,
  TenantCompanyProfile,
  TenantOnboardingAuditEvent,
  TenantStartReadinessReport,
} from '@/types/admin/tenantOnboarding';
import {
  ONBOARDING_STEP_LABELS,
  ONBOARDING_STEP_ORDER,
} from '@/types/admin/tenantOnboarding';
import {
  saveTenantProfileFromOnboarding,
  validateTenantMasterDataForTenant,
} from './dataQualityService';
import {
  appendOnboardingAuditEvent,
  buildOnboardingProgressSummary,
  getTenantOnboardingStoreSnapshot,
  listOnboardingAuditEvents,
  patchOnboardingSession,
  readCompanyProfile,
  readOnboardingSession,
  readStartReadinessReport,
  saveStartReadinessReport,
  updateOnboardingStep,
  writeCompanyProfile,
  writeModuleSetup,
} from './tenantOnboardingStore';

export const TENANT_ONBOARDING_PREPARED_MESSAGE =
  'Mandanten-Onboarding ist vorbereitet — Persistenz über Migration 0050, noch nicht produktiv.';

export function isTenantOnboardingLiveReady(): boolean {
  return false;
}

const START_CHECK_LABELS: Record<StartReadinessCheckKey, string> = {
  company_profile: 'Firmenprofil vollständig',
  modules_active: 'Module aktiviert',
  roles_configured: 'Rollen konfiguriert',
  employees_present: 'Mitarbeitende angelegt',
  clients_present: 'Klient:innen angelegt',
  services_priced: 'Leistungen & Preise hinterlegt',
  billing_ready: 'Abrechnung bereit',
  documents_templates: 'Dokumente & Vorlagen',
  portals_privacy: 'Portale & Datenschutz',
  connect_configured: 'Connect konfiguriert',
  data_quality: 'Stammdatenqualität',
  minimum_data: 'Mindestdaten für Start',
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function isCompanyProfileComplete(profile: TenantCompanyProfile | null): boolean {
  if (!profile) return false;
  return (
    hasText(profile.name) &&
    hasText(profile.legalForm) &&
    hasText(profile.street) &&
    hasText(profile.zip) &&
    hasText(profile.city) &&
    hasText(profile.email)
  );
}

export function startOnboardingSession(tenantId: string): OnboardingProgressSummary {
  const now = new Date().toISOString();
  patchOnboardingSession(tenantId, {
    overallStatus: 'in_progress',
    currentStepKey: 'company_data',
    startedAt: now,
  });
  appendOnboardingAuditEvent(tenantId, {
    sessionId: readOnboardingSession(tenantId).id,
    action: 'session_started',
    detail: 'Onboarding-Session gestartet',
  });
  return buildOnboardingProgressSummary(tenantId);
}

export function saveOnboardingCompanyStep(
  tenantId: string,
  profile: Partial<TenantCompanyProfile>,
): OnboardingProgressSummary {
  writeCompanyProfile(tenantId, profile);
  saveTenantProfileFromOnboarding(tenantId, {
    tenantId,
    name: profile.name,
    legalForm: profile.legalForm,
    street: profile.street,
    zip: profile.zip,
    city: profile.city,
    phone: profile.phone,
    email: profile.email,
    managementName: profile.managementName,
    registerNumber: profile.registerNumber,
    taxId: profile.taxId,
    vatId: profile.vatId,
    ikNumber: profile.ikNumber,
    bankName: profile.bankName,
    iban: profile.iban,
    paymentTermsDays: profile.paymentTermsDays,
    taxStatus: profile.taxStatus,
    statutoryBillingActive: profile.statutoryBillingActive,
    invoicesEnabled: true,
  });

  const complete = isCompanyProfileComplete(readCompanyProfile(tenantId));
  updateOnboardingStep(
    tenantId,
    'company_data',
    complete ? 'completed' : 'blocked',
    complete ? null : 'Pflichtfelder im Firmenprofil fehlen',
  );
  updateOnboardingStep(
    tenantId,
    'business_area',
    hasText(profile.industry) ? 'completed' : 'pending',
  );

  patchOnboardingSession(tenantId, {
    overallStatus: complete ? 'in_progress' : 'blocked',
    currentStepKey: 'modules',
  });

  appendOnboardingAuditEvent(tenantId, {
    sessionId: readOnboardingSession(tenantId).id,
    action: 'step_updated',
    stepKey: 'company_data',
    detail: complete ? 'Firmendaten gespeichert' : 'Firmendaten unvollständig',
  });

  return buildOnboardingProgressSummary(tenantId);
}

export function saveOnboardingModulesStep(
  tenantId: string,
  activeModules: ProductKey[],
): OnboardingProgressSummary {
  writeModuleSetup(tenantId, activeModules);
  updateOnboardingStep(
    tenantId,
    'modules',
    activeModules.length > 0 ? 'completed' : 'blocked',
  );
  patchOnboardingSession(tenantId, { currentStepKey: 'roles' });
  appendOnboardingAuditEvent(tenantId, {
    sessionId: readOnboardingSession(tenantId).id,
    action: 'session_saved',
    stepKey: 'modules',
    detail: `${activeModules.length} Module ausgewählt`,
  });
  return buildOnboardingProgressSummary(tenantId);
}

export function markOnboardingStep(
  tenantId: string,
  stepKey: OnboardingStepKey,
  status: OnboardingStepStatus,
  notes?: string,
): OnboardingProgressSummary {
  updateOnboardingStep(tenantId, stepKey, status, notes ?? null);
  appendOnboardingAuditEvent(tenantId, {
    sessionId: readOnboardingSession(tenantId).id,
    action: 'step_updated',
    stepKey,
    detail: `Schritt ${ONBOARDING_STEP_LABELS[stepKey]} → ${status}`,
  });
  return buildOnboardingProgressSummary(tenantId);
}

export function resumeOnboardingSession(tenantId: string): OnboardingProgressSummary {
  const session = readOnboardingSession(tenantId);
  if (session.overallStatus === 'not_started') {
    return startOnboardingSession(tenantId);
  }
  appendOnboardingAuditEvent(tenantId, {
    sessionId: session.id,
    action: 'session_saved',
    detail: 'Onboarding fortgesetzt',
  });
  return buildOnboardingProgressSummary(tenantId);
}

function evaluateStartReadinessChecks(tenantId: string): StartReadinessCheckResult[] {
  const store = buildOnboardingProgressSummary(tenantId);
  const profile = store.companyProfile;
  const checks: StartReadinessCheckResult[] = [];

  const companyComplete = isCompanyProfileComplete(profile);
  checks.push({
    checkKey: 'company_profile',
    label: START_CHECK_LABELS.company_profile,
    status: companyComplete ? 'passed' : 'failed',
    message: companyComplete ? 'Firmenprofil vollständig.' : 'Firmenprofil unvollständig.',
  });

  const modulesOk = (store.moduleSetup?.activeModules.length ?? 0) > 0;
  checks.push({
    checkKey: 'modules_active',
    label: START_CHECK_LABELS.modules_active,
    status: modulesOk ? 'passed' : 'failed',
    message: modulesOk ? 'Mindestens ein Modul aktiv.' : 'Keine Module ausgewählt.',
  });

  const snapshot = buildOnboardingProgressSummary(tenantId);
  const counters = getTenantOnboardingStoreCounters(tenantId);

  checks.push({
    checkKey: 'roles_configured',
    label: START_CHECK_LABELS.roles_configured,
    status: counters.rolesConfigured ? 'passed' : 'failed',
    message: counters.rolesConfigured ? 'Rollen konfiguriert.' : 'Rollen noch nicht konfiguriert.',
  });

  checks.push({
    checkKey: 'employees_present',
    label: START_CHECK_LABELS.employees_present,
    status: counters.employeeCount > 0 ? 'passed' : 'warning',
    message:
      counters.employeeCount > 0
        ? `${counters.employeeCount} Mitarbeitende angelegt.`
        : 'Noch keine Mitarbeitenden — empfohlen vor Pilot.',
  });

  checks.push({
    checkKey: 'clients_present',
    label: START_CHECK_LABELS.clients_present,
    status: counters.clientCount > 0 ? 'passed' : 'warning',
    message:
      counters.clientCount > 0
        ? `${counters.clientCount} Klient:innen angelegt.`
        : 'Noch keine Klient:innen — empfohlen vor Pilot.',
  });

  checks.push({
    checkKey: 'services_priced',
    label: START_CHECK_LABELS.services_priced,
    status: counters.servicesConfigured ? 'passed' : 'warning',
    message: counters.servicesConfigured
      ? 'Leistungen und Preise hinterlegt.'
      : 'Leistungen/Preise noch offen.',
  });

  const billingBlocked =
    profile?.statutoryBillingActive &&
    (!hasText(profile.ikNumber) || !hasText(profile.bankName) || !hasText(profile.iban));
  checks.push({
    checkKey: 'billing_ready',
    label: START_CHECK_LABELS.billing_ready,
    status: billingBlocked ? 'failed' : profile?.statutoryBillingActive ? 'passed' : 'warning',
    message: billingBlocked
      ? 'Gesetzliche Abrechnung aktiv — IK/Bank fehlt.'
      : profile?.statutoryBillingActive
        ? 'Abrechnungsprofil bereit.'
        : 'Abrechnung nicht aktiv — optional.',
  });

  const docsStep = snapshot.steps.find((s) => s.stepKey === 'documents_templates');
  checks.push({
    checkKey: 'documents_templates',
    label: START_CHECK_LABELS.documents_templates,
    status: docsStep?.status === 'completed' ? 'passed' : 'warning',
    message:
      docsStep?.status === 'completed'
        ? 'Dokumentvorlagen geprüft.'
        : 'Dokumentvorlagen noch nicht abgeschlossen.',
  });

  checks.push({
    checkKey: 'portals_privacy',
    label: START_CHECK_LABELS.portals_privacy,
    status: counters.portalPrivacyChecked ? 'passed' : 'warning',
    message: counters.portalPrivacyChecked
      ? 'Datenschutzprüfung für Portale durchgeführt.'
      : 'Datenschutz-/Freigabeprüfung für Portale ausstehend.',
  });

  checks.push({
    checkKey: 'connect_configured',
    label: START_CHECK_LABELS.connect_configured,
    status: counters.connectConfigured ? 'passed' : 'warning',
    message: counters.connectConfigured
      ? 'Connect-Anbieter konfiguriert.'
      : 'Connect noch nicht konfiguriert — optional.',
  });

  const dqResult = validateTenantMasterDataForTenant(tenantId, {
    tenantId,
    name: profile?.name,
    legalForm: profile?.legalForm,
    street: profile?.street,
    zip: profile?.zip,
    city: profile?.city,
    phone: profile?.phone,
    email: profile?.email,
    managementName: profile?.managementName,
    registerNumber: profile?.registerNumber,
    taxId: profile?.taxId,
    vatId: profile?.vatId,
    ikNumber: profile?.ikNumber,
    bankName: profile?.bankName,
    iban: profile?.iban,
    paymentTermsDays: profile?.paymentTermsDays,
    taxStatus: profile?.taxStatus,
    statutoryBillingActive: profile?.statutoryBillingActive,
    invoicesEnabled: true,
  });

  checks.push({
    checkKey: 'data_quality',
    label: START_CHECK_LABELS.data_quality,
    status:
      dqResult.blockingIssues.length > 0
        ? 'failed'
        : dqResult.warnings.length > 0
          ? 'warning'
          : 'passed',
    message:
      dqResult.blockingIssues.length > 0
        ? `${dqResult.blockingIssues.length} Blocker in Stammdatenqualität.`
        : dqResult.warnings.length > 0
          ? `${dqResult.warnings.length} Warnungen in Stammdatenqualität.`
          : 'Stammdatenqualität ohne Blocker.',
    dataQualityStatus: dqResult.status,
  });

  const minimumOk = companyComplete && modulesOk && !billingBlocked;
  checks.push({
    checkKey: 'minimum_data',
    label: START_CHECK_LABELS.minimum_data,
    status: minimumOk ? 'passed' : 'failed',
    message: minimumOk
      ? 'Mindestanforderungen für internen Test erfüllt.'
      : 'Mindestanforderungen nicht erfüllt — produktiver Start blockiert.',
  });

  return checks;
}

function getTenantOnboardingStoreCounters(tenantId: string) {
  const snap = getTenantOnboardingStoreSnapshot(tenantId);
  return {
    employeeCount: snap.employeeCount,
    clientCount: snap.clientCount,
    rolesConfigured: snap.rolesConfigured,
    servicesConfigured: snap.servicesConfigured,
    connectConfigured: snap.connectConfigured,
    portalPrivacyChecked: snap.portalPrivacyChecked,
  };
}

function deriveOverallStatus(checks: StartReadinessCheckResult[]): OnboardingOverallStatus {
  const failed = checks.filter((c) => c.status === 'failed');
  const warnings = checks.filter((c) => c.status === 'warning');
  const minimum = checks.find((c) => c.checkKey === 'minimum_data');

  if (minimum?.status === 'failed') return 'blocked';
  if (failed.length > 0) return 'blocked';
  if (warnings.length > 2) return 'ready_for_internal_test';
  if (warnings.length > 0) return 'ready_for_pilot';
  return 'completed';
}

export function runStartReadinessCheck(tenantId: string): TenantStartReadinessReport {
  const session = readOnboardingSession(tenantId);
  const checks = evaluateStartReadinessChecks(tenantId);
  const overallReady = checks.every((c) => c.status !== 'failed');
  const recommendedStatus = deriveOverallStatus(checks);

  const report: TenantStartReadinessReport = {
    tenantId,
    sessionId: session.id,
    overallReady,
    checks,
    recommendedStatus,
    evaluatedAt: new Date().toISOString(),
  };

  saveStartReadinessReport(tenantId, report);
  updateOnboardingStep(
    tenantId,
    'start_check',
    overallReady ? 'completed' : 'blocked',
    overallReady ? 'Startprüfung bestanden' : 'Blocker in Startprüfung',
  );
  patchOnboardingSession(tenantId, {
    overallStatus: recommendedStatus,
    currentStepKey: 'start_check',
    completedAt: recommendedStatus === 'completed' ? new Date().toISOString() : null,
  });

  appendOnboardingAuditEvent(tenantId, {
    sessionId: session.id,
    action: 'start_check_run',
    stepKey: 'start_check',
    detail: overallReady ? 'Startprüfung bestanden' : 'Startprüfung mit Blockern',
  });

  return report;
}

export function fetchOnboardingProgress(tenantId: string): OnboardingProgressSummary {
  return buildOnboardingProgressSummary(tenantId);
}

export function fetchStartReadinessReport(tenantId: string): TenantStartReadinessReport {
  return readStartReadinessReport(tenantId) ?? runStartReadinessCheck(tenantId);
}

export function canStartProductiveOperation(tenantId: string): boolean {
  const report = fetchStartReadinessReport(tenantId);
  return report.overallReady && report.recommendedStatus !== 'blocked';
}

export function listOnboardingAuditTrail(tenantId: string): TenantOnboardingAuditEvent[] {
  return listOnboardingAuditEvents(tenantId);
}

export {
  resetTenantOnboardingStore,
  updateOnboardingCounters,
  readCompanyProfile,
} from './tenantOnboardingStore';

export { ONBOARDING_STEP_ORDER, ONBOARDING_STEP_LABELS, START_CHECK_LABELS };
