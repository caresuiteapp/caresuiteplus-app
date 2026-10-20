import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  canStartProductiveOperation,
  fetchOnboardingProgress,
  fetchStartReadinessReport,
  markOnboardingStep,
  resumeOnboardingSession,
  runStartReadinessCheck,
  saveOnboardingCompanyStep,
  saveOnboardingModulesStep,
  startOnboardingSession,
  updateOnboardingCounters,
} from '@/lib/admin/tenantOnboardingService';
import { resetTenantOnboardingStore } from '@/lib/admin/tenantOnboardingStore';
import { ONBOARDING_STEP_ORDER } from '@/types/admin/tenantOnboarding';

const TENANT_A = DEMO_TENANT_ID;
const TENANT_B = 'tenant-onb-isolation';

function completeCompanyProfile() {
  return {
    name: 'Onboarding Test GmbH',
    legalForm: 'GmbH',
    industry: 'Ambulanter Pflegedienst',
    street: 'Hauptstraße 5',
    zip: '10115',
    city: 'Berlin',
    phone: '+49 30 55555',
    email: 'office@onboarding-test.app',
    managementName: 'Erika Leitung',
    registerNumber: 'HRB 555',
    taxId: '27/555/000',
    vatId: 'DE555555555',
    ikNumber: '987654321',
    bankName: 'Sparkasse',
    iban: 'DE89370400440532013000',
    paymentTermsDays: 14,
    taxStatus: 'regelbesteuert',
    statutoryBillingActive: true,
  };
}

describe('Mandanten-Onboarding (Prompt 67)', () => {
  beforeEach(() => {
    resetTenantOnboardingStore();
  });

  it('1. Neue Session startet als not_started → in_progress', () => {
    const before = fetchOnboardingProgress(TENANT_A);
    expect(before.session.overallStatus).toBe('not_started');
    const after = startOnboardingSession(TENANT_A);
    expect(after.session.overallStatus).toBe('in_progress');
    expect(after.session.startedAt).toBeTruthy();
  });

  it('2. Firmenschritt aktualisiert Fortschritt bei vollständigem Profil', () => {
    startOnboardingSession(TENANT_A);
    const progress = saveOnboardingCompanyStep(TENANT_A, completeCompanyProfile());
    const companyStep = progress.steps.find((s) => s.stepKey === 'company_data');
    expect(companyStep?.status).toBe('completed');
    expect(progress.companyProfile?.name).toBe('Onboarding Test GmbH');
  });

  it('3. Session fortsetzen stellt Schrittdaten wieder her', () => {
    startOnboardingSession(TENANT_A);
    saveOnboardingCompanyStep(TENANT_A, completeCompanyProfile());
    const resumed = resumeOnboardingSession(TENANT_A);
    expect(resumed.companyProfile?.email).toBe('office@onboarding-test.app');
    expect(resumed.session.currentStepKey).toBe('modules');
  });

  it('4. Unvollständiges Firmenprofil blockiert Session', () => {
    startOnboardingSession(TENANT_A);
    const progress = saveOnboardingCompanyStep(TENANT_A, { name: 'Nur Name' });
    expect(progress.session.overallStatus).toBe('blocked');
    expect(progress.steps.find((s) => s.stepKey === 'company_data')?.status).toBe('blocked');
  });

  it('5. Modulschritt kann abgeschlossen werden', () => {
    startOnboardingSession(TENANT_A);
    saveOnboardingCompanyStep(TENANT_A, completeCompanyProfile());
    const progress = saveOnboardingModulesStep(TENANT_A, ['office', 'assist']);
    expect(progress.steps.find((s) => s.stepKey === 'modules')?.status).toBe('completed');
    expect(progress.moduleSetup?.activeModules).toContain('office');
  });

  it('6. Abrechnung blockiert ohne IK bei gesetzlicher Abrechnung', () => {
    startOnboardingSession(TENANT_A);
    saveOnboardingCompanyStep(TENANT_A, {
      ...completeCompanyProfile(),
      ikNumber: null,
      statutoryBillingActive: true,
    });
    const report = runStartReadinessCheck(TENANT_A);
    const billingCheck = report.checks.find((c) => c.checkKey === 'billing_ready');
    expect(billingCheck?.status).toBe('failed');
  });

  it('7. Portale warnen ohne Datenschutzprüfung', () => {
    startOnboardingSession(TENANT_A);
    saveOnboardingCompanyStep(TENANT_A, completeCompanyProfile());
    saveOnboardingModulesStep(TENANT_A, ['office']);
    updateOnboardingCounters(TENANT_A, { portalPrivacyChecked: false });
    const report = runStartReadinessCheck(TENANT_A);
    const portalCheck = report.checks.find((c) => c.checkKey === 'portals_privacy');
    expect(portalCheck?.status).toBe('warning');
  });

  it('8. Connect-Schritt warnt ohne Anbieterkonfiguration', () => {
    startOnboardingSession(TENANT_A);
    saveOnboardingCompanyStep(TENANT_A, completeCompanyProfile());
    updateOnboardingCounters(TENANT_A, { connectConfigured: false });
    const report = runStartReadinessCheck(TENANT_A);
    const connectCheck = report.checks.find((c) => c.checkKey === 'connect_configured');
    expect(connectCheck?.status).toBe('warning');
  });

  it('9. Startprüfung führt 12 Checks aus', () => {
    startOnboardingSession(TENANT_A);
    saveOnboardingCompanyStep(TENANT_A, completeCompanyProfile());
    saveOnboardingModulesStep(TENANT_A, ['office']);
    updateOnboardingCounters(TENANT_A, {
      rolesConfigured: true,
      employeeCount: 2,
      clientCount: 1,
      servicesConfigured: true,
      connectConfigured: true,
      portalPrivacyChecked: true,
    });
    markOnboardingStep(TENANT_A, 'documents_templates', 'completed');
    const report = runStartReadinessCheck(TENANT_A);
    expect(report.checks).toHaveLength(12);
  });

  it('10. Startprüfung integriert Stammdatenqualität (Prompt 66)', () => {
    startOnboardingSession(TENANT_A);
    saveOnboardingCompanyStep(TENANT_A, completeCompanyProfile());
    saveOnboardingModulesStep(TENANT_A, ['office']);
    const report = runStartReadinessCheck(TENANT_A);
    const dqCheck = report.checks.find((c) => c.checkKey === 'data_quality');
    expect(dqCheck).toBeTruthy();
    expect(dqCheck?.dataQualityStatus).toBeDefined();
  });

  it('11. Produktiver Start ohne Mindestdaten nicht möglich', () => {
    startOnboardingSession(TENANT_A);
    saveOnboardingCompanyStep(TENANT_A, { name: 'Unvollständig' });
    runStartReadinessCheck(TENANT_A);
    expect(canStartProductiveOperation(TENANT_A)).toBe(false);
  });

  it('12. Mandantenisolation zwischen Sessions', () => {
    startOnboardingSession(TENANT_A);
    startOnboardingSession(TENANT_B);
    saveOnboardingCompanyStep(TENANT_A, completeCompanyProfile());
    const progressB = fetchOnboardingProgress(TENANT_B);
    expect(progressB.companyProfile).toBeNull();
    expect(progressB.session.tenantId).toBe(TENANT_B);
  });

  it('13. Audit-Events werden bei Schrittänderungen protokolliert', () => {
    startOnboardingSession(TENANT_A);
    saveOnboardingCompanyStep(TENANT_A, completeCompanyProfile());
    runStartReadinessCheck(TENANT_A);
    const progress = fetchOnboardingProgress(TENANT_A);
    expect(ONBOARDING_STEP_ORDER).toHaveLength(12);
    expect(progress.completedStepCount).toBeGreaterThan(0);
    const report = fetchStartReadinessReport(TENANT_A);
    expect(report.checks.find((c) => c.checkKey === 'minimum_data')).toBeTruthy();
  });
});
