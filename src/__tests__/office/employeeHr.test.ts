import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoleKey } from '@/types';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { resetLifecycleDocumentStore } from '@/lib/documents/documentLifecycleService';
import { resetPdfRenderJobs } from '@/lib/documents/pdfRenderJobService';
import {
  attemptEditHrCase,
  blockHrDataForClientPortal,
  confirmHrCasePreview,
  createHrCase,
  createHrCaseCorrection,
  finalizeHrCase,
  getHrAuditTrail,
  getHrCase,
  listEmployeePortalHrDocuments,
  listHrCases,
  patchHrCaseForTest,
  releaseHrCaseToEmployeePortal,
  resetEmployeeHrStore,
  validateHrCaseForFinalization,
} from '@/lib/office/employeeHrService';

const TENANT = DEMO_TENANT_ID;
const OTHER_TENANT = 'tenant-other-999';
const EMPLOYEE = 'employee-003';
const OTHER_EMPLOYEE = 'employee-001';
const ADMIN = 'business_admin' as const;
const PORTAL = 'employee_portal' as const;
const CLIENT = 'client_portal' as RoleKey;

describe('employee HR module (Personalvorgänge)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetEmployeeHrStore();
    resetLifecycleDocumentStore();
    resetPdfRenderJobs();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetEmployeeHrStore();
    resetLifecycleDocumentStore();
    resetPdfRenderJobs();
  });

  it('1 — HR case kann angelegt werden', () => {
    const result = createHrCase(
      {
        tenantId: TENANT,
        employeeId: EMPLOYEE,
        areaKey: 'mitarbeitergespraech',
        conversation: {
          scheduledAt: '2026-06-20T10:00:00.000Z',
          participants: [{ name: 'Anna Weber', role: 'Vorgesetzte' }],
          topics: 'Jahresgespräch',
          summary: 'Gutes Jahr',
        },
      },
      ADMIN,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe('draft');
      expect(result.data.areaKey).toBe('mitarbeitergespraech');
      expect(getHrAuditTrail(TENANT, result.data.id).some((e) => e.eventType === 'hr_case_created')).toBe(true);
    }
  });

  it('2 — Abmahnung ohne Vorfallbeschreibung blockiert Finalisierung', () => {
    const created = createHrCase(
      {
        tenantId: TENANT,
        employeeId: EMPLOYEE,
        areaKey: 'abmahnung',
        warning: {
          incidentDate: '2026-06-10',
          incidentDescription: '',
          breachedDuties: 'Pünktlichkeit',
          expectedBehavior: 'Pünktliches Erscheinen',
          consequencesNotice: 'Weitere Abmahnung',
          deliveryMethod: 'personal',
        },
      },
      ADMIN,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    patchHrCaseForTest({ ...created.data, previewConfirmed: true, caseNumber: 'PV-2026-0001' });

    const validation = validateHrCaseForFinalization(TENANT, created.data.id);
    expect(validation.ok).toBe(true);
    if (validation.ok) {
      expect(validation.data.validation.status).toBe('error');
      expect(validation.data.validation.issues.some((i) => i.code === 'incident_description_missing')).toBe(true);
    }
  });

  it('3 — Kündigung ohne Wirksamkeitsdatum blockiert Finalisierung', () => {
    const created = createHrCase(
      {
        tenantId: TENANT,
        employeeId: EMPLOYEE,
        areaKey: 'kuendigung',
        termination: {
          terminationDate: '2026-06-15',
          effectiveDate: null,
          reasonInternal: 'Betriebsbedingt',
          noticePeriod: '4 Wochen',
        },
      },
      ADMIN,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    patchHrCaseForTest({ ...created.data, previewConfirmed: true, caseNumber: 'PV-2026-0002' });

    const validation = validateHrCaseForFinalization(TENANT, created.data.id);
    expect(validation.ok).toBe(true);
    if (validation.ok) {
      expect(validation.data.validation.issues.some((i) => i.code === 'effective_date_missing')).toBe(true);
    }
  });

  it('4 — Arbeitszeugnis kann vorbereitet werden', () => {
    const created = createHrCase(
      {
        tenantId: TENANT,
        employeeId: EMPLOYEE,
        areaKey: 'arbeitszeugnis',
        reference: {
          referenceType: 'simple',
          employmentPeriod: '01.2024 – 06.2026',
          roleDescription: 'Pflegefachkraft ambulant',
          tasks: 'Grundpflege, Medikamentengabe',
          performanceAssessment: 'Stets zu unserer vollsten Zufriedenheit',
          conductAssessment: 'Verhalten war stets einwandfrei',
          closingFormula: 'Wir bedauern das Ausscheiden.',
        },
      },
      ADMIN,
    );

    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.data.reference?.employmentPeriod).toContain('2024');
      const validation = validateHrCaseForFinalization(TENANT, created.data.id);
      expect(validation.ok).toBe(true);
      if (validation.ok) expect(validation.data.validation.status).toBe('valid');
    }
  });

  it('5 — Finalisierter HR-Vorgang ist gesperrt', async () => {
    const created = createHrCase(
      {
        tenantId: TENANT,
        employeeId: EMPLOYEE,
        areaKey: 'abmahnung',
        warning: {
          incidentDate: '2026-06-10',
          incidentDescription: 'Unentschuldigtes Fehlen',
          breachedDuties: 'Arbeitspflicht',
          expectedBehavior: 'Termine einhalten',
          consequencesNotice: 'Kündigungsandrohung',
          deliveryMethod: 'personal',
        },
      },
      ADMIN,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await confirmHrCasePreview(TENANT, created.data.id, ADMIN);
    const finalized = await finalizeHrCase(TENANT, created.data.id, ADMIN);
    expect(finalized.ok).toBe(true);

    const editAttempt = await attemptEditHrCase(TENANT, created.data.id, ADMIN);
    expect(editAttempt.ok).toBe(false);
    if (!editAttempt.ok) {
      expect(editAttempt.error).toContain('gesperrt');
    }
  });

  it('6 — Mitarbeitende sehen nur eigene freigegebene Dokumente', async () => {
    const own = createHrCase(
      {
        tenantId: TENANT,
        employeeId: EMPLOYEE,
        areaKey: 'arbeitszeugnis',
        reference: {
          employmentPeriod: '2024–2026',
          roleDescription: 'Pflege',
          tasks: 'Pflege',
          performanceAssessment: 'Gut',
          conductAssessment: 'Gut',
          closingFormula: 'Danke.',
        },
      },
      ADMIN,
    );
    const other = createHrCase(
      {
        tenantId: TENANT,
        employeeId: OTHER_EMPLOYEE,
        areaKey: 'arbeitszeugnis',
        reference: {
          employmentPeriod: '2023–2025',
          roleDescription: 'Assistenz',
          tasks: 'Assistenz',
          performanceAssessment: 'Gut',
          conductAssessment: 'Gut',
          closingFormula: 'Danke.',
        },
      },
      ADMIN,
    );
    expect(own.ok && other.ok).toBe(true);
    if (!own.ok || !other.ok) return;

    await confirmHrCasePreview(TENANT, own.data.id, ADMIN);
    const finOwn = await finalizeHrCase(TENANT, own.data.id, ADMIN);
    expect(finOwn.ok, finOwn.ok ? '' : finOwn.error).toBe(true);
    releaseHrCaseToEmployeePortal(TENANT, own.data.id, ADMIN);

    await confirmHrCasePreview(TENANT, other.data.id, ADMIN);
    const finOther = await finalizeHrCase(TENANT, other.data.id, ADMIN);
    expect(finOther.ok, finOther.ok ? '' : finOther.error).toBe(true);
    releaseHrCaseToEmployeePortal(TENANT, other.data.id, ADMIN);

    const portalDocs = listEmployeePortalHrDocuments(TENANT, EMPLOYEE, PORTAL);
    expect(portalDocs.ok).toBe(true);
    if (portalDocs.ok) {
      expect(portalDocs.data).toHaveLength(1);
      expect(portalDocs.data[0]?.employeeId).toBe(EMPLOYEE);
    }
  });

  it('7 — Klient:innen sehen keine HR-Daten', () => {
    createHrCase({ tenantId: TENANT, employeeId: EMPLOYEE, areaKey: 'abmahnung' }, ADMIN);
    expect(blockHrDataForClientPortal()).toEqual([]);
    expect(listHrCases(TENANT, undefined, CLIENT).ok).toBe(false);
  });

  it('8 — Audit-Event bei Finalisierung', async () => {
    const created = createHrCase(
      {
        tenantId: TENANT,
        employeeId: EMPLOYEE,
        areaKey: 'ermahnung',
        warning: {
          incidentDate: '2026-06-01',
          incidentDescription: 'Verspätete Dokumentation',
          breachedDuties: 'Dokumentationspflicht',
          expectedBehavior: 'Fristgerechte Dokumentation',
          consequencesNotice: 'Abmahnung bei Wiederholung',
          deliveryMethod: 'email',
        },
      },
      ADMIN,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await confirmHrCasePreview(TENANT, created.data.id, ADMIN);
    await finalizeHrCase(TENANT, created.data.id, ADMIN);

    const trail = getHrAuditTrail(TENANT, created.data.id);
    expect(trail.some((e) => e.eventType === 'hr_case_finalized')).toBe(true);
    expect(trail.some((e) => e.eventType === 'hr_case_locked')).toBe(true);
  });

  it('9 — Cross-Tenant blockiert', () => {
    const created = createHrCase(
      { tenantId: TENANT, employeeId: EMPLOYEE, areaKey: 'mitarbeitergespraech' },
      ADMIN,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(getHrCase(OTHER_TENANT, created.data.id)).toBeUndefined();
    expect(listHrCases(OTHER_TENANT, undefined, ADMIN).ok).toBe(false);
  });

  it('10 — Produktionsmodus ohne Demo-HR-Daten', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

    const created = createHrCase(
      { tenantId: TENANT, employeeId: EMPLOYEE, areaKey: 'abmahnung' },
      ADMIN,
    );
    expect(created.ok).toBe(false);
    if (!created.ok) {
      expect(created.error).toMatch(/Live-Modus|Produktionsmodus/);
    }
  });

  it('Korrekturversion erzeugt neuen Entwurf', async () => {
    const created = createHrCase(
      {
        tenantId: TENANT,
        employeeId: EMPLOYEE,
        areaKey: 'abmahnung',
        warning: {
          incidentDate: '2026-06-10',
          incidentDescription: 'Fehler',
          breachedDuties: 'Pflicht',
          expectedBehavior: 'Verhalten',
          consequencesNotice: 'Folge',
          deliveryMethod: 'personal',
        },
      },
      ADMIN,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await confirmHrCasePreview(TENANT, created.data.id, ADMIN);
    await finalizeHrCase(TENANT, created.data.id, ADMIN);

    const correction = await createHrCaseCorrection(TENANT, created.data.id, ADMIN);
    expect(correction.ok).toBe(true);
    if (correction.ok) {
      expect(correction.data.correctedFromCaseId).toBe(created.data.id);
      expect(correction.data.status).toBe('corrected');
      expect(correction.data.lockedAt).toBeNull();
    }
  });
});
