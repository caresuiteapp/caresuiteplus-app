import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n');

describe('PFLEGE LIVE CORE R1', () => {
  const migration = source('supabase/migrations/20260812043000_pfleger_live_core_r1.sql');

  it('persists plans, measures, diagnoses, orders, versions and audit data', () => {
    for (const marker of [
      'public.care_plans', 'public.care_plan_items', 'public.care_diagnoses',
      'public.care_medical_orders', 'public.care_plan_versions', 'public.care_audit_events',
    ]) expect(migration).toContain(marker);
  });

  it('uses active Pflege cases and atomic plan persistence', () => {
    expect(migration).toContain('public.is_active_pfleger_client(p_client_id)');
    expect(migration).toContain('save_live_care_plan');
    expect(migration).toContain('Pflegeplan gesperrt: kein aktiver Pflegefall.');
    expect(migration).toContain("'items', COALESCE");
  });

  it('enforces tenant-scoped RLS and high-risk permissions', () => {
    expect(migration).toContain('public.current_tenant_id()');
    expect(migration).toContain('public.can_view_pfleger_core()');
    expect(migration).toContain('public.can_manage_pfleger_core()');
    expect(migration).toContain("('pflege.plans.manage'");
    expect(migration).toContain("('pflege.diagnoses.manage'");
    expect(migration).toContain("('pflege.orders.manage'");
  });

  it('removes demo persistence from plan create, detail and edit paths', () => {
    const list = source('src/lib/pflege/carePlanListService.ts');
    const detail = source('src/lib/pflege/carePlanDetailService.ts');
    const create = source('src/screens/pflege/CarePlanCreateScreen.tsx');
    const edit = source('src/screens/pflege/CarePlanEditScreen.tsx');
    for (const value of [list, detail, create, edit]) {
      expect(value).not.toContain('getDemoCarePlan');
      expect(value).not.toContain('createDemoCarePlan');
      expect(value).not.toContain('updateDemoCarePlan');
    }
    expect(list).toContain('carePlanLiveRepository');
    expect(create).toContain('Live speichern und prüfen');
    expect(edit).toContain('Neue Version live speichern');
  });

  it('performs readback after plan, diagnosis and order writes', () => {
    const plans = source('src/lib/pflege/carePlanRepository.supabase.ts');
    const clinical = source('src/lib/pflege/careClinicalCoreService.ts');
    expect(plans).toContain('const readback = await this.get(tenantId, id)');
    expect(clinical).toContain('Diagnose wurde nicht zurückgelesen.');
    expect(clinical).toContain('Verordnung wurde nicht zurückgelesen.');
  });

  it('separates diagnoses and orders in the Pflege navigation', () => {
    const catalog = source('src/liquid-command/navigation/moduleCatalog.ts');
    expect(catalog).toContain("route: '/pflege/diagnosen'");
    expect(catalog).toContain("route: '/pflege/verordnungen'");
    expect(source('app/pflege/diagnosen.tsx')).toContain('CareDiagnosesScreen');
    expect(source('app/pflege/verordnungen.tsx')).toContain('CareOrdersScreen');
    expect(source('src/lib/navigation/routes.ts')).toContain("path: '/pflege/diagnosen'");
    expect(source('src/lib/navigation/routes.ts')).toContain("path: '/pflege/verordnungen'");
    expect(source('src/liquid-command/navigation/workflowRoutes.ts')).toContain("diagnoses: '/pflege/diagnosen'");
  });

  it('uses database-compatible measure states and dedicated application permissions', () => {
    expect(migration).toContain("DEFAULT 'active'");
    expect(migration).not.toContain("'planned'");
    const permissions = source('src/types/permissions/index.ts');
    expect(permissions).toContain("'pflege.plans.manage'");
    expect(permissions).toContain("'pflege.diagnoses.manage'");
    expect(permissions).toContain("'pflege.orders.manage'");
  });

  it('preserves the central 120 second query timeout from current main', () => {
    expect(source('src/lib/services/queryTimeout.ts')).toContain('120_000');
  });
});
