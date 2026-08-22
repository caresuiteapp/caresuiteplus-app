import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Personal R3 — Offboarding live persistence repair', () => {
  const service = read('src/lib/office/offboarding/employeeOffboardingService.ts');
  const repository = read(
    'src/lib/office/offboarding/employeeOffboardingRepository.supabase.ts',
  );
  const store = read('src/lib/office/offboarding/employeeOffboardingStore.ts');
  const migration = read(
    'supabase/migrations/20260822103000_employee_offboarding_live_r3.sql',
  );

  it('hydrates before operations and persists every resulting progress state', () => {
    expect(service).toContain('hydrateLiveOffboarding');
    expect(service).toContain('persistLiveOffboarding');
    expect(service).toContain('persistEmployeeOffboardingSnapshot');
    expect(service).toContain('schemaErrorMessage: OFFBOARDING_SCHEMA_ERROR');
    expect(store).toContain('replaceOffboardingStoreSnapshot');
    expect(store).toContain('return true;');
  });

  it('covers all durable offboarding tables and seeds the 20-step workflow', () => {
    for (const table of [
      'employee_offboarding_sessions',
      'employee_offboarding_steps',
      'employee_offboarding_checks',
      'employee_access_revocations',
      'employee_final_clearance',
      'offboarding_audit_events',
    ]) {
      expect(repository).toContain(`'${table}'`);
      expect(migration).toContain(`public.${table}`);
    }
    expect(repository).toContain('OFFBOARDING_STEP_ORDER.map');
    expect(repository).toContain("event.id.startsWith('offb-audit-')");
  });

  it('applies tenant RLS, authenticated grants and the missing exit date safely', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS exit_date DATE');
    expect(migration.match(/ENABLE ROW LEVEL SECURITY/g)).toHaveLength(6);
    expect(migration).toContain('tenant_id = public.current_tenant_id()');
    expect(migration).toContain('TO authenticated;');
    expect(migration).toContain("NOTIFY pgrst, 'reload schema'");
    expect(migration).not.toMatch(/DROP\s+TABLE|TRUNCATE|DELETE\s+FROM\s+public\.employees/i);
  });

  it('shows a contextual repair message instead of the unrelated service-type error', () => {
    expect(repository).toContain(
      'Datenbankschema für das Mitarbeitenden-Offboarding ist unvollständig.',
    );
    expect(repository).not.toContain('Leistungsarten konnten nicht gespeichert werden');
  });
});
