import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  archiveApplicantRecord,
  convertApplicantToEmployee,
  createApplicant,
  fetchRecruitingDashboard,
  getApplicantDetail,
  getApplicantPrivacyInfo,
  getApplicantStatusAuditTrail,
  listApplicants,
  prepareApplicantCommunication,
  prepareApplicantPrivacyExport,
  recordApplicantRejection,
  recordOfferAccepted,
  recordOfferSent,
  resetRecruitingStore,
  scheduleInterview,
  verifyApplicantNotAssignable,
} from '@/lib/recruiting/applicantService';
import {
  fetchEmployeeOnboardingProgress,
  listEmployeeOnboardingSessions,
  runOnboardingDeployabilityCheck,
} from '@/lib/recruiting/employeeOnboardingService';
import { grantExtendedStorageConsent } from '@/lib/recruiting/applicantPrivacyService';
import { getApplicantById } from '@/lib/recruiting/recruitingStore';
import { canViewApplicantList } from '@/lib/recruiting/applicantAccess';

const TENANT = DEMO_TENANT_ID;
const TENANT_B = 'tenant-recruiting-isolation';
const ADMIN = 'business_admin' as const;
const DISPATCH = 'dispatch' as const;
const CLIENT = 'client_portal' as const;

const BASE_APPLICANT = {
  tenantId: TENANT,
  firstName: 'Anna',
  lastName: 'Bewerber',
  email: 'anna.bewerber@example.app',
  appliedRole: 'Pflegefachkraft',
  source: 'Website',
};

describe('Bewerbermanagement & Onboarding (Prompt 76)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetRecruitingStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetRecruitingStore();
  });

  it('1. Bewerbung anlegen mit Pflichtfeldern', () => {
    const result = createApplicant(BASE_APPLICANT, ADMIN);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe('received');
      expect(result.data.tenantId).toBe(TENANT);
      expect(result.data.deletionDueAt).toBeTruthy();
    }
  });

  it('2. Mandantenisolation bei Bewerberliste', () => {
    createApplicant(BASE_APPLICANT, ADMIN);
    createApplicant({ ...BASE_APPLICANT, tenantId: TENANT_B, email: 'b@example.app' }, ADMIN);
    const listA = listApplicants(TENANT, ADMIN);
    expect(listA.ok).toBe(true);
    if (listA.ok) {
      expect(listA.data.every((a) => a.tenantId === TENANT)).toBe(true);
      expect(listA.data.length).toBe(1);
    }
  });

  it('3. Keine Berechtigung für Klient:innenportal', () => {
    expect(canViewApplicantList(CLIENT)).toBe(false);
    const list = listApplicants(TENANT, CLIENT);
    expect(list.ok).toBe(false);
  });

  it('4. Sensible Daten nur mit view_sensitive', () => {
    const created = createApplicant(BASE_APPLICANT, ADMIN);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const limited = getApplicantDetail(TENANT, created.data.id, DISPATCH);
    expect(limited.ok).toBe(true);
    if (limited.ok) {
      expect('email' in limited.data).toBe(false);
    }

    const full = getApplicantDetail(TENANT, created.data.id, ADMIN);
    expect(full.ok).toBe(true);
    if (full.ok) {
      expect('email' in full.data).toBe(true);
    }
  });

  it('5. Bewerber sind nicht einsatzplanbar', () => {
    const created = createApplicant(BASE_APPLICANT, ADMIN);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const check = verifyApplicantNotAssignable(TENANT, created.data.id);
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.data.assignable).toBe(false);
  });

  it('6. Angebot versenden ist auditierbar', () => {
    const created = createApplicant(BASE_APPLICANT, ADMIN);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const offer = recordOfferSent(TENANT, created.data.id, ADMIN);
    expect(offer.ok).toBe(true);
    const audit = getApplicantStatusAuditTrail(TENANT, created.data.id, ADMIN);
    expect(audit.ok).toBe(true);
    if (audit.ok) {
      expect(audit.data.some((e) => e.newStatus === 'offer_sent')).toBe(true);
    }
  });

  it('7. Absage ist auditierbar', () => {
    const created = createApplicant(BASE_APPLICANT, ADMIN);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const rejected = recordApplicantRejection(TENANT, created.data.id, 'Profil passt nicht', ADMIN);
    expect(rejected.ok).toBe(true);
    const audit = getApplicantStatusAuditTrail(TENANT, created.data.id, ADMIN);
    expect(audit.ok).toBe(true);
    if (audit.ok) {
      expect(audit.data.some((e) => e.newStatus === 'rejected')).toBe(true);
    }
  });

  it('8. Umwandlung nur bei offer_accepted', () => {
    const created = createApplicant(BASE_APPLICANT, ADMIN);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const tooEarly = convertApplicantToEmployee(
      {
        tenantId: TENANT,
        applicantId: created.data.id,
        roleTitle: 'Pflegefachkraft',
      },
      ADMIN,
    );
    expect(tooEarly.ok).toBe(false);

    recordOfferSent(TENANT, created.data.id, ADMIN);
    recordOfferAccepted(TENANT, created.data.id, ADMIN);
    const converted = convertApplicantToEmployee(
      {
        tenantId: TENANT,
        applicantId: created.data.id,
        roleTitle: 'Pflegefachkraft',
      },
      ADMIN,
    );
    expect(converted.ok).toBe(true);
    if (converted.ok) {
      expect(converted.data.employeeId).toMatch(/^employee-onb-/);
      expect(converted.data.applicant.status).toBe('converted');
      expect(converted.data.onboardingSession.overallStatus).toBe('in_progress');
    }
  });

  it('9. Onboarding-Session mit 13 Schritten', () => {
    const created = createApplicant(BASE_APPLICANT, ADMIN);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    recordOfferSent(TENANT, created.data.id, ADMIN);
    recordOfferAccepted(TENANT, created.data.id, ADMIN);
    const converted = convertApplicantToEmployee(
      {
        tenantId: TENANT,
        applicantId: created.data.id,
        roleTitle: 'Pflegefachkraft',
      },
      ADMIN,
    );
    expect(converted.ok).toBe(true);
    if (!converted.ok) return;

    const progress = fetchEmployeeOnboardingProgress(TENANT, converted.data.employeeId, ADMIN);
    expect(progress.ok).toBe(true);
    if (progress.ok) {
      expect(progress.data.steps.length).toBe(13);
      expect(progress.data.steps[0].stepKey).toBe('employee_record_created');
      expect(progress.data.steps[0].status).toBe('completed');
    }
  });

  it('10. Einsatzfähigkeit blockiert ohne Pflichtschulungen', () => {
    const created = createApplicant(BASE_APPLICANT, ADMIN);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    recordOfferSent(TENANT, created.data.id, ADMIN);
    recordOfferAccepted(TENANT, created.data.id, ADMIN);
    const converted = convertApplicantToEmployee(
      {
        tenantId: TENANT,
        applicantId: created.data.id,
        roleTitle: 'Pflegefachkraft',
      },
      ADMIN,
    );
    expect(converted.ok).toBe(true);
    if (!converted.ok) return;

    const deployCheck = runOnboardingDeployabilityCheck(
      TENANT,
      converted.data.employeeId,
      'Pflegefachkraft',
      ADMIN,
    );
    expect(deployCheck.ok).toBe(true);
    if (deployCheck.ok) {
      expect(['failed', 'warning']).toContain(deployCheck.data.status);
    }
  });

  it('11. Kommunikation nur als Entwurf/prepared', () => {
    const created = createApplicant(BASE_APPLICANT, ADMIN);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const comm = prepareApplicantCommunication(
      TENANT,
      created.data.id,
      'application_received',
      'Eingangsbestätigung',
      'Vielen Dank für Ihre Bewerbung.',
      ADMIN,
    );
    expect(comm.ok).toBe(true);
    if (comm.ok) {
      expect(comm.data.preparedOnly).toBe(true);
      expect(comm.data.status).toBe('draft');
    }
  });

  it('12. Gespräch terminieren aktualisiert Status', () => {
    const created = createApplicant(BASE_APPLICANT, ADMIN);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const interview = scheduleInterview(
      TENANT,
      created.data.id,
      {
        scheduledAt: '2026-07-15T10:00:00.000Z',
        format: 'video',
        interviewerNames: ['HR Leitung'],
      },
      ADMIN,
    );
    expect(interview.ok).toBe(true);
    const applicant = getApplicantById(TENANT, created.data.id);
    expect(applicant?.status).toBe('interview_scheduled');
  });

  it('13. Datenschutz: Archiv und Löschfrist', () => {
    const created = createApplicant(BASE_APPLICANT, ADMIN);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const privacy = getApplicantPrivacyInfo(TENANT, created.data.id, ADMIN);
    expect(privacy.ok).toBe(true);
    if (privacy.ok) expect(privacy.data.deletionDeadlineDays).toBe(180);

    const archived = archiveApplicantRecord(TENANT, created.data.id, ADMIN);
    expect(archived.ok).toBe(true);
    if (archived.ok) expect(archived.data.status).toBe('archived');
  });

  it('14. Betroffenenexport vorbereitet', () => {
    const created = createApplicant(BASE_APPLICANT, ADMIN);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const exported = prepareApplicantPrivacyExport(TENANT, created.data.id, ADMIN);
    expect(exported.ok).toBe(true);
    if (exported.ok) {
      expect(exported.data.exportPrepared).toBe(true);
      expect(exported.data.payload.preparedOnly).toBe(true);
    }
  });

  it('15. Dashboard-KPIs und Onboarding-Liste', () => {
    createApplicant(BASE_APPLICANT, ADMIN);
    const dashboard = fetchRecruitingDashboard(TENANT, ADMIN);
    expect(dashboard.ok).toBe(true);
    if (dashboard.ok) {
      expect(dashboard.data.totalApplicants).toBe(1);
      expect(dashboard.data.openApplicants).toBe(1);
    }

    const sessions = listEmployeeOnboardingSessions(TENANT, ADMIN);
    expect(sessions.ok).toBe(true);
    if (sessions.ok) expect(Array.isArray(sessions.data)).toBe(true);
  });
});

describe('Bewerber Datenschutz-Erweiterung', () => {
  beforeEach(() => {
    resetRecruitingStore();
  });

  it('verlängerte Speicherung verschiebt Löschfrist', () => {
    const created = createApplicant(BASE_APPLICANT, ADMIN);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const applicant = getApplicantById(TENANT, created.data.id);
    expect(applicant).toBeTruthy();
    if (!applicant) return;
    grantExtendedStorageConsent(applicant);
    expect(applicant.extendedStorageConsent).toBe(true);
    expect(applicant.deletionDueAt).toBeTruthy();
  });
});
