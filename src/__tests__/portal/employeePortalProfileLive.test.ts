import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Employee portal profile live wiring', () => {
  it('profile hook resolves employeeId from portal actor', () => {
    const hook = readSrc('src/hooks/useEmployeePortalProfile.ts');
    expect(hook).toContain('usePortalActor');
    expect(hook).toContain('employeeId');
    expect(hook).not.toContain('useAuth');
  });

  it('profile service loads live Supabase data when employeeId is present', () => {
    const service = readSrc('src/lib/portal/employeeProfileService.ts');
    expect(service).toContain('fetchLiveEmployeePortalProfile');
    expect(service).toContain("getServiceMode() === 'supabase'");
    const live = readSrc('src/lib/portal/employeeProfileLiveService.ts');
    expect(live).toContain("fromUnknownTable(supabase, 'employees')");
    expect(live).not.toContain('getDemoEmployeeProfile');
  });

  it('execution service delegates to live Supabase in supabase mode', () => {
    const service = readSrc('src/lib/portal/employeePortalExecutionService.ts');
    expect(service).toContain('fetchLiveEmployeePortalAssignmentDetail');
    expect(service).toContain('transitionLiveEmployeePortalAssignment');
    const live = readSrc('src/lib/portal/employeePortalExecutionLiveService.ts');
    expect(live).toContain('assignmentSupabaseRepository');
    expect(live).not.toContain('guardLiveDemoFeature');
  });

  it('profile hero defines iconSize before useMemo styles', () => {
    const hero = readSrc('src/components/portal/PortalEmployeeProfileHero.tsx');
    const iconIdx = hero.indexOf('const iconSize');
    const useMemoIdx = hero.indexOf('useMemo(');
    expect(iconIdx).toBeGreaterThan(-1);
    expect(useMemoIdx).toBeGreaterThan(iconIdx);
  });

  it('migration 0189 adds employee portal self-select RLS', () => {
    const sql = readSrc('supabase/migrations/0189_employee_portal_live_rls.sql');
    expect(sql).toContain('employees_portal_self_select');
    expect(sql).toContain('assignments_portal_employee_select');
    expect(sql).toContain('resolve_current_employee_id()');
  });
});

describe('Employee portal appointment detail live wiring', () => {
  it('appointment detail hook passes portal actor context', () => {
    const hook = readSrc('src/hooks/usePortalAppointmentDetail.ts');
    expect(hook).toContain('usePortalActor');
    expect(hook).toContain('tenantId');
    expect(hook).toContain('employeeId');
  });

  it('appointment service loads live employee assignment detail', () => {
    const service = readSrc('src/lib/portal/appointmentService.ts');
    expect(service).toContain('fetchLiveEmployeePortalAssignmentDetail');
  });
});
