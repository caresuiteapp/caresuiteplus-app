import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { resetDemoEmployeePersonnelFileCache } from '@/data/demo/employeePersonnelFile';
import { detectAssignmentConflicts } from '@/lib/assist/assignmentConflictService';
import { detectEmployeeEligibilityConflicts } from '@/lib/assist/employeeAssignmentEligibilityService';
import {
  createAssignmentWorkflow,
  resetAssignmentWorkflowStore,
} from '@/lib/assist/assignmentWorkflowService';
import { canViewBackgroundCheckDocument } from '@/lib/office/employeeBackgroundCheckService';
import { evaluateEmployeeDeployability } from '@/lib/office/employeeDeployabilityService';
import { validateEmployeeMasterData } from '@/lib/office/employeeMasterDataValidation';
import {
  auditEmployeeMasterDataChange,
  getEmployeeAuditEvents,
  resetEmployeePersonnelAuditStore,
} from '@/lib/office/employeePersonnelAuditService';
import {
  buildPersonnelAccessContext,
  canViewEmployeePersonnelFile,
  canViewSensitivePersonnelDocument,
  filterPersonnelFileForPortal,
} from '@/lib/office/employeePersonnelAccess';
import {
  computeQualificationStatus,
  resolveQualificationOverview,
} from '@/lib/office/employeeQualificationService';
import {
  fetchEmployeePersonnelFile,
  getEmployeePersonnelFileForAssignmentCheck,
  updateEmployeeMasterData,
} from '@/lib/office/employeePersonnelFileService';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';
import { getDemoEmployeePersonnelFile } from '@/data/demo/employeePersonnelFile';

const TENANT = DEMO_TENANT_ID;
const OTHER_TENANT = '00000000-0000-4000-8000-000000000099';
const ADMIN = 'business_admin' as const;

describe('Personalakte Prompt 71', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetDemoEmployeePersonnelFileCache();
    resetEmployeePersonnelAuditStore();
    resetAssignmentWorkflowStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('1 — Keine Mitarbeitenden ohne tenant_id', () => {
    const errors = validateEmployeeMasterData(
      {
        firstName: 'Max',
        lastName: 'Mustermann',
        dateOfBirth: null,
        employeeNumber: null,
        street: null,
        houseNumber: null,
        postalCode: null,
        city: null,
        country: 'DE',
        phone: null,
        mobile: null,
        email: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        entryDate: null,
        exitDate: null,
        status: 'aktiv',
        roleTitle: null,
        employmentType: null,
        weeklyHours: null,
        costCenter: null,
      },
      '',
    );
    expect(errors.firstName).toContain('tenant_id');
  });

  it('2 — Keine Zuweisung an inaktive Mitarbeitende', () => {
    const conflicts = detectEmployeeEligibilityConflicts({
      tenantId: TENANT,
      employeeId: 'employee-006',
    });
    expect(conflicts.some((c) => c.code === 'employee_inactive' || c.code === 'employee_blocked')).toBe(true);
  });

  it('3 — Keine Pflegeeinsätze ohne passende Qualifikation', () => {
    const file = getDemoEmployeePersonnelFile('employee-006')!;
    const deployability = evaluateEmployeeDeployability({
      employment: file.employment,
      portalAccess: file.portalAccess,
      qualifications: file.qualifications,
      backgroundCheck: file.backgroundCheck,
      documents: file.documents,
      roleTitle: file.masterData.roleTitle,
      blocked: true,
    });
    expect(deployability.qualificationOk).toBe(false);
    expect(deployability.blockers.some((b) => b.code === 'qualification_missing')).toBe(true);
  });

  it('4 — Sensible Personalakten-Dokumente nur für autorisierte Rollen', () => {
    const ctx = buildPersonnelAccessContext({
      tenantId: TENANT,
      roleKey: 'dispatch',
      targetEmployeeId: 'employee-001',
    });
    expect(
      canViewSensitivePersonnelDocument(ctx, { category: 'background_check', sensitive: true }),
    ).toBe(false);
    const adminCtx = buildPersonnelAccessContext({
      tenantId: TENANT,
      roleKey: ADMIN,
      targetEmployeeId: 'employee-001',
    });
    expect(
      canViewSensitivePersonnelDocument(adminCtx, { category: 'background_check', sensitive: true }),
    ).toBe(true);
  });

  it('5 — Kein mandantenübergreifender Personalakten-Zugriff', async () => {
    const crossTenant = getEmployeePersonnelFileForAssignmentCheck(OTHER_TENANT, 'employee-001');
    expect(crossTenant).toBeNull();

    const wrongTenantFetch = await fetchEmployeePersonnelFile(OTHER_TENANT, 'employee-001', ADMIN);
    expect(wrongTenantFetch.ok).toBe(false);
  });

  it('6 — Personalakten nicht für Klient:innenportale sichtbar', () => {
    const ctx = buildPersonnelAccessContext({
      tenantId: TENANT,
      roleKey: 'client_portal',
      targetEmployeeId: 'employee-001',
    });
    const access = canViewEmployeePersonnelFile(ctx);
    expect(access.allowed).toBe(false);
  });

  it('7 — Mitarbeitende sehen nur eigene freigegebene Daten', async () => {
    const own = await fetchEmployeePersonnelFile(TENANT, 'employee-001', 'employee_portal', {
      employeeId: 'employee-001',
    });
    expect(own.ok).toBe(true);

    const foreign = await fetchEmployeePersonnelFile(TENANT, 'employee-002', 'employee_portal', {
      employeeId: 'employee-001',
    });
    expect(foreign.ok).toBe(false);
  });

  it('8 — Führungszeugnis-Status sichtbar, Dokument nur für Admin', async () => {
    const file = getDemoEmployeePersonnelFile('employee-001')!;
    expect(file.backgroundCheck.status).toBeTruthy();

    const dispatchCtx = buildPersonnelAccessContext({
      tenantId: TENANT,
      roleKey: 'dispatch',
      targetEmployeeId: 'employee-001',
    });
    const filtered = filterPersonnelFileForPortal(file, dispatchCtx);
    expect(filtered.backgroundCheck.status).toBe('verified');
    expect(filtered.backgroundCheck.documentId).toBeNull();
    expect(canViewBackgroundCheckDocument('dispatch')).toBe(false);
    expect(canViewBackgroundCheckDocument('business_admin')).toBe(true);
  });

  it('9 — Qualifikationen prüfbar und Ablauf überwacht', () => {
    const status = computeQualificationStatus(
      { validUntil: '2026-07-01', verifiedAt: '2024-01-01', status: 'valid' },
      new Date('2026-06-16'),
    );
    expect(status).toBe('expires_soon');

    const file = getDemoEmployeePersonnelFile('employee-002')!;
    expect(resolveQualificationOverview(file.qualifications)).not.toBe('missing');
  });

  it('10 — Stammdatenänderungen auditierbar', async () => {
    const file = getDemoEmployeePersonnelFile('employee-001')!;
    auditEmployeeMasterDataChange({
      tenantId: TENANT,
      employeeId: 'employee-001',
      actorId: 'admin-1',
      actorRole: ADMIN,
      before: file.masterData,
      after: { ...file.masterData, phone: '+49 30 1111111' },
    });
    const events = getEmployeeAuditEvents('employee-001');
    expect(events.some((e) => e.action === 'master_data_updated')).toBe(true);

    const update = await updateEmployeeMasterData(
      TENANT,
      'employee-001',
      { mobile: '+49 170 8888888' },
      ADMIN,
      'admin-1',
    );
    expect(update.ok).toBe(true);
  });

  it('11 — Kein Demo-Fallback im Production-Modus', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    const blocked = guardLiveDemoFeature(TENANT, 'Personalakte');
    expect(blocked?.ok).toBe(false);
  });

  it('12 — Einsatzfähigkeit liefert assignable, warning oder blocked', () => {
    const active = getDemoEmployeePersonnelFile('employee-001')!;
    const activeResult = evaluateEmployeeDeployability({
      employment: active.employment,
      portalAccess: active.portalAccess,
      qualifications: active.qualifications,
      backgroundCheck: active.backgroundCheck,
      documents: active.documents,
      roleTitle: active.masterData.roleTitle,
    });
    expect(['assignable', 'warning', 'blocked']).toContain(activeResult.result);

    const blocked = getDemoEmployeePersonnelFile('employee-006')!;
    const blockedResult = evaluateEmployeeDeployability({
      employment: blocked.employment,
      portalAccess: blocked.portalAccess,
      qualifications: blocked.qualifications,
      backgroundCheck: blocked.backgroundCheck,
      documents: blocked.documents,
      roleTitle: blocked.masterData.roleTitle,
      blocked: true,
    });
    expect(blockedResult.result).toBe('blocked');
  });

  it('13 — Einsatzplanung prüft Einsatzfähigkeit bei Zuweisung', () => {
    const create = createAssignmentWorkflow(
      {
        tenantId: TENANT,
        clientId: 'client-001',
        employeeId: 'employee-006',
        serviceType: 'Alltagsbegleitung',
        plannedStartAt: '2026-07-01T09:00:00.000Z',
        plannedEndAt: '2026-07-01T11:00:00.000Z',
        locationAddress: 'Musterstraße 1, Berlin',
        title: 'Gesperrter MA',
        tasks: [{ title: 'Begleitung' }],
      },
      ADMIN,
    );
    expect(create.ok).toBe(false);

    const file = getEmployeePersonnelFileForAssignmentCheck(TENANT, 'employee-001');
    expect(file?.tenantId).toBe(TENANT);

    const conflicts = detectAssignmentConflicts({
      assignment: {
        id: 'new-1',
        tenantId: TENANT,
        clientId: 'client-001',
        employeeId: 'employee-003',
        plannedStartAt: '2026-07-01T09:00:00.000Z',
        plannedEndAt: '2026-07-01T11:00:00.000Z',
        locationAddress: 'Test 1',
        serviceType: 'Betreuung',
        tasks: [{ title: 'A' } as never],
      },
      existing: [],
      actorRoleKey: ADMIN,
    });
    expect(conflicts.some((c) => c.code === 'background_check_missing')).toBe(true);
  });
});
