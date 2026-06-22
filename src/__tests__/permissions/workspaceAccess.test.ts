import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { fetchAssignmentList } from '@/lib/assist/assignmentListService';
import {
  assertWorkspaceAccess,
  buildWorkspaceAccessContext,
  canAccessAdminArea,
  canAccessClientPortal,
  canAccessEmployeePortal,
  canCancelVisitRequest,
  canDirectEmployeeClientChat,
  canRequestReschedule,
  canViewAssignment,
  canViewAuditLog,
  canViewClientRecord,
  canViewDocument,
  checkWorkspaceAreaAccess,
  resetWorkspaceAuditStore,
} from '@/lib/permissions';
import { checkRoleAccess } from '@/lib/navigation';
import { guardServiceTenant, guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';

const TENANT = DEMO_TENANT_ID;
const OTHER_TENANT = '00000000-0000-4000-8000-000000000099';

const ASSIGNMENT = {
  tenantId: TENANT,
  employeeId: 'employee-001',
  clientId: 'client-001',
};

function ctx(overrides: Parameters<typeof buildWorkspaceAccessContext>[0] = {}) {
  return buildWorkspaceAccessContext({
    userId: 'user-1',
    tenantId: TENANT,
    ...overrides,
  });
}

describe('workspace access model', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetWorkspaceAuditStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetWorkspaceAuditStore();
  });

  it('1. Verwaltung sieht alle eigenen Mandantendaten', () => {
    const decision = canAccessAdminArea(ctx({ roleKey: 'business_admin' }));
    expect(decision.allowed).toBe(true);

    const assignment = canViewAssignment(ctx({ roleKey: 'dispatch' }), ASSIGNMENT);
    expect(assignment.allowed).toBe(true);
  });

  it('2. Mitarbeiter sieht nur eigene Einsätze', async () => {
    const list = await fetchAssignmentList(TENANT, 'nurse', {
      userId: 'nurse-1',
      employeeId: 'employee-001',
    });
    expect(list.ok).toBe(true);
    if (list.ok) {
      expect(list.data.every((a) => a.employeeId === 'employee-001')).toBe(true);
      expect(list.data.length).toBeGreaterThan(0);
    }
  });

  it('3. Mitarbeiter sieht keine fremden Klient:innen', () => {
    const record = canViewClientRecord(
      ctx({ roleKey: 'employee_portal', employeeId: 'employee-001', clientId: 'client-001' }),
      { tenantId: TENANT, clientId: 'client-002', visibility: 'assignment' },
    );
    expect(record.allowed).toBe(false);
  });

  it('4. Klient sieht nur eigene Daten', () => {
    const own = canViewAssignment(
      ctx({ roleKey: 'client_portal', clientId: 'client-001' }),
      ASSIGNMENT,
    );
    expect(own.allowed).toBe(true);

    const foreign = canViewAssignment(
      ctx({ roleKey: 'client_portal', clientId: 'client-999' }),
      ASSIGNMENT,
    );
    expect(foreign.allowed).toBe(false);
  });

  it('5. Vertreter sieht nur freigegebene Klientendaten', () => {
    const shared = canViewClientRecord(
      ctx({ roleKey: 'family_portal', clientId: 'client-001', sharedClientIds: ['client-001'] }),
      { tenantId: TENANT, clientId: 'client-001', visibility: 'shared' },
    );
    expect(shared.allowed).toBe(true);

    const blocked = canViewClientRecord(
      ctx({ roleKey: 'family_portal', clientId: 'client-001', sharedClientIds: ['client-001'] }),
      { tenantId: TENANT, clientId: 'client-002', visibility: 'shared' },
    );
    expect(blocked.allowed).toBe(false);
  });

  it('6. Direkt-Route ohne Berechtigung wird blockiert', () => {
    const decision = checkRoleAccess('/portal/employee', 'client_portal', {
      tenantId: TENANT,
      userId: 'c1',
    });
    expect(decision.shouldRedirect).toBe(true);
  });

  it('7. Cross-Tenant-Zugriff wird blockiert', () => {
    const decision = canViewAssignment(
      ctx({ roleKey: 'business_admin', tenantId: TENANT }),
      { ...ASSIGNMENT, tenantId: OTHER_TENANT },
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe('tenant_mismatch');
  });

  it('8. Production Mode nutzt keinen Demo-Fallback', () => {
    const decision = canAccessAdminArea(
      ctx({
        roleKey: 'business_admin',
        environment: 'production',
        isDemoMode: true,
        usesDemoFallback: true,
      }),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe('production_demo_blocked');
  });

  it('Portal-Bereiche werden getrennt geprüft', () => {
    expect(canAccessEmployeePortal(ctx({ roleKey: 'employee_portal' })).allowed).toBe(true);
    expect(canAccessClientPortal(ctx({ roleKey: 'client_portal' })).allowed).toBe(true);
    expect(canAccessAdminArea(ctx({ roleKey: 'employee_portal' })).allowed).toBe(false);
    expect(checkWorkspaceAreaAccess('/business/office/clients', ctx({ roleKey: 'client_portal' })).allowed).toBe(false);
  });

  it('Dokumente: Rechnungen nur Verwaltung', () => {
    const admin = canViewDocument(ctx({ roleKey: 'business_admin' }), {
      tenantId: TENANT,
      visibility: 'office',
      documentType: 'invoice',
    });
    expect(admin.allowed).toBe(true);

    const client = canViewDocument(ctx({ roleKey: 'client_portal', clientId: 'client-001' }), {
      tenantId: TENANT,
      clientId: 'client-001',
      visibility: 'shared',
      documentType: 'invoice',
    });
    expect(client.allowed).toBe(false);
  });

  it('Verschiebung/Absage nur Klient oder Verwaltung', () => {
    expect(canRequestReschedule(ctx({ roleKey: 'client_portal' })).allowed).toBe(true);
    expect(canCancelVisitRequest(ctx({ roleKey: 'employee_portal' })).allowed).toBe(false);
  });

  it('Direkter Mitarbeitende-Klient:innen-Chat blockiert', () => {
    expect(canDirectEmployeeClientChat(ctx({ roleKey: 'nurse' })).allowed).toBe(false);
  });

  it('Audit nur Verwaltung', () => {
    expect(canViewAuditLog(ctx({ roleKey: 'business_admin' })).allowed).toBe(true);
    expect(canViewAuditLog(ctx({ roleKey: 'client_portal' })).allowed).toBe(false);
  });

  it('Audit Events entstehen bei assertWorkspaceAccess', () => {
    assertWorkspaceAccess(
      'view_assignment',
      ctx({ roleKey: 'dispatch' }),
      () => canViewAssignment(ctx({ roleKey: 'dispatch' }), ASSIGNMENT),
      { type: 'assignment', id: 'assign-001' },
    );
    const trail = assertWorkspaceAccess(
      'view_assignment_denied',
      ctx({ roleKey: 'employee_portal', employeeId: 'employee-999' }),
      () => canViewAssignment(ctx({ roleKey: 'employee_portal', employeeId: 'employee-999' }), ASSIGNMENT),
      { type: 'assignment', id: 'assign-001' },
    );
    expect(trail.allowed).toBe(false);
  });

  it('Production blockiert Demo-Fallback in guardLiveDemoFeature', () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-key');
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');

    const block = guardLiveDemoFeature(TENANT, 'Einsatzliste');
    expect(block).not.toBeNull();
    if (block) expect(block.ok).toBe(false);
  });
});
