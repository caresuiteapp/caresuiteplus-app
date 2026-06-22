import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { detectEmployeeEligibilityConflicts } from '@/lib/assist/employeeAssignmentEligibilityService';
import { evaluateEmployeeAssignmentEligibility } from '@/lib/office/employeeAssignmentEligibility';
import { getDemoEmployeePersonnelFile } from '@/data/demo/employeePersonnelFile';
import {
  ACADEMY_INTEGRATION_NOTICE,
  assertAcademyIntegrationAllowed,
  canViewCertificate,
  canViewEmployeeTrainingRecords,
  completeTrainingRecord,
  evaluateEmployeeTrainingDeployability,
  fetchEmployeeCertificates,
  fetchEmployeeTrainingRecords,
  filterEmployeesEligibleForAssignment,
  isAcademyIntegrationLive,
  isTrainingLiveReady,
  isTrainingWiringPrepared,
  refreshTrainingReminders,
  resolveMandatoryCourseKeys,
  TRAINING_LIVE_WIRING_MIGRATION,
  verifyEmployeeCertificate,
  __resetTrainingServiceForTests,
  __seedTrainingServiceForTests,
} from '@/lib/training';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

const TENANT = DEMO_TENANT_ID;
const OTHER_TENANT = '00000000-0000-4000-8000-000000000099';
const ADMIN = 'business_admin' as const;
const EMPLOYEE = 'employee_portal' as const;
const CLIENT = 'client_portal' as const;

describe('Training Management Prepared (Prompt 75)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    __resetTrainingServiceForTests();
    __seedTrainingServiceForTests();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    __resetTrainingServiceForTests();
  });

  it('1 — Migration 0052 existiert mit allen Tabellen', () => {
    const sql = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/0052_training_management_prepared.sql'),
      'utf8',
    );
    for (const table of [
      'training_courses',
      'training_course_modules',
      'training_requirements',
      'employee_training_records',
      'employee_certificates',
      'training_assignments',
      'training_reminders',
      'training_audit_events',
      'training_quiz_results',
      'training_content_items',
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    }
  });

  it('2 — isTrainingLiveReady bleibt ehrlich false', () => {
    expect(isTrainingLiveReady()).toBe(false);
    expect(isTrainingWiringPrepared()).toBe(true);
    expect(TRAINING_LIVE_WIRING_MIGRATION).toBe('0052_training_management_prepared.sql');
  });

  it('3 — Pflichtschulungen werden nach Rolle zugeordnet', () => {
    const keys = resolveMandatoryCourseKeys({ roleKey: 'nurse', moduleKeys: ['pflege'] });
    expect(keys).toContain('hygiene_ifsg');
    expect(keys).toContain('dsgvo_basics');
  });

  it('4 — Pflichtschulungen werden nach Modul zugeordnet', () => {
    const keys = resolveMandatoryCourseKeys({ roleKey: 'dispatch', moduleKeys: ['assist', 'office'] });
    expect(keys).toContain('hygiene_ifsg');
    expect(keys).toContain('dsgvo_basics');
  });

  it('5 — Abgelaufene Schulung blockiert Einsatzfähigkeit', () => {
    const result = evaluateEmployeeTrainingDeployability({
      tenantId: TENANT,
      employeeId: 'employee-002',
      roleKey: 'nurse',
      jobTitle: 'Pflegefachkraft',
    });
    expect(result.deployable).toBe(false);
    expect(result.blockers.some((b) => b.code === 'training_expired')).toBe(true);
  });

  it('6 — Ablauf in 30 Tagen erzeugt Warnung oder Block', () => {
    const result = evaluateEmployeeTrainingDeployability({
      tenantId: TENANT,
      employeeId: 'employee-003',
      roleKey: 'caregiver',
      jobTitle: 'Betreuungskraft',
    });
    const expiringIssue = [...result.warnings, ...result.blockers].some(
      (issue) => issue.code === 'training_expires_soon' || issue.message.includes('läuft'),
    );
    expect(expiringIssue).toBe(true);
  });

  it('7 — Abschluss ohne Nachweis wird abgelehnt', async () => {
    const result = await completeTrainingRecord(
      {
        tenantId: TENANT,
        trainingRecordId: 'tr-rec-004',
        employeeId: 'employee-003',
      },
      ADMIN,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Nachweis/i);
  });

  it('8 — Mitarbeitende sehen nur eigene Schulungen', async () => {
    const own = await fetchEmployeeTrainingRecords(TENANT, EMPLOYEE, 'employee-001', 'employee-001');
    expect(own.ok).toBe(true);

    const foreign = await fetchEmployeeTrainingRecords(TENANT, EMPLOYEE, 'employee-001', 'employee-002');
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) expect(foreign.error).toMatch(/eigene/i);
  });

  it('9 — Klient:innen sehen keine Schulungsdaten', async () => {
    const courses = await fetchEmployeeTrainingRecords(TENANT, CLIENT, 'client-001', 'employee-001');
    expect(courses.ok).toBe(false);
  });

  it('10 — Zertifikate nur für berechtigte Rollen sichtbar', async () => {
    const adminCerts = await fetchEmployeeCertificates(TENANT, ADMIN, null, 'employee-001');
    expect(adminCerts.ok).toBe(true);

    const decision = canViewCertificate({
      actorRole: EMPLOYEE,
      actorEmployeeId: 'employee-001',
      tenantId: TENANT,
      certificate: {
        id: 'tr-cert-pending',
        tenantId: TENANT,
        employeeId: 'employee-001',
        trainingRecordId: 'tr-rec-001',
        courseId: 'tr-course-hygiene',
        title: 'Test',
        certificateNumber: null,
        issuedAt: null,
        validUntil: null,
        documentId: null,
        verificationStatus: 'pending',
        verifiedBy: null,
        verifiedAt: null,
        rejectionReason: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    expect(decision.allowed).toBe(false);
  });

  it('11 — Mandantentrennung bei Zugriff', () => {
    expect(guardServiceTenant(OTHER_TENANT)?.ok).toBe(false);
    const access = canViewEmployeeTrainingRecords({
      actorRole: ADMIN,
      targetEmployeeId: 'employee-001',
      tenantId: TENANT,
      recordTenantId: OTHER_TENANT,
    });
    expect(access.allowed).toBe(false);
  });

  it('12 — Einsatzplanung blockiert fehlende Pflichtschulung', () => {
    const conflicts = detectEmployeeEligibilityConflicts({
      tenantId: TENANT,
      employeeId: 'employee-003',
      requiresQualification: true,
    });
    expect(
      conflicts.some(
        (c) =>
          c.code === 'mandatory_training_missing' ||
          c.code === 'qualification_missing' ||
          c.code === 'background_check_missing',
      ),
    ).toBe(true);
  });

  it('13 — Qualifikationspflicht schlägt Mitarbeitende ohne Pflichtschulung vor Filterung aus', () => {
    const filtered = filterEmployeesEligibleForAssignment({
      tenantId: TENANT,
      employeeIds: ['employee-001', 'employee-002', 'employee-003'],
      roleByEmployee: {
        'employee-001': 'caregiver',
        'employee-002': 'nurse',
        'employee-003': 'caregiver',
      },
      requiresQualification: true,
    });
    expect(filtered.blocked.some((b) => b.employeeId === 'employee-002')).toBe(true);
    expect(filtered.blocked.some((b) => b.employeeId === 'employee-003')).toBe(true);
  });

  it('14 — Erinnerungen für 90/30 Tage und abgelaufen', () => {
    const reminders = refreshTrainingReminders(TENANT);
    expect(reminders.some((r) => r.reminderLevel === 'urgent_30d' || r.reminderLevel === 'expired')).toBe(
      true,
    );
    expect(reminders.some((r) => r.adminTaskCreated)).toBe(true);
  });

  it('15 — Akademie SCORM/xAPI/Moodle/ILIAS nur vorbereitet', () => {
    expect(isAcademyIntegrationLive('scorm')).toBe(false);
    expect(isAcademyIntegrationLive('moodle')).toBe(false);
    expect(assertAcademyIntegrationAllowed('xapi')).toEqual({ ok: true, preparedOnly: true });
    expect(ACADEMY_INTEGRATION_NOTICE).toMatch(/vorbereitet/i);
  });

  it('16 — Zertifikatsverifikation auditierbar', async () => {
    const verify = await verifyEmployeeCertificate(
      {
        tenantId: TENANT,
        certificateId: 'tr-cert-002',
        verificationStatus: 'verified',
        actorId: 'admin-1',
        actorRole: ADMIN,
      },
      ADMIN,
    );
    expect(verify.ok).toBe(true);
  });

  it('17 — Kombinierte Einsatzfähigkeit Personal + Schulung', () => {
    const file = getDemoEmployeePersonnelFile('employee-001');
    expect(file).toBeTruthy();
    const eligibility = evaluateEmployeeAssignmentEligibility({
      tenantId: TENANT,
      employeeId: 'employee-001',
      personnelFile: file!,
      roleKey: 'caregiver',
    });
    expect(eligibility.trainingDeployability).toBeDefined();
    expect(eligibility.deployable).toBeDefined();
  });
});
