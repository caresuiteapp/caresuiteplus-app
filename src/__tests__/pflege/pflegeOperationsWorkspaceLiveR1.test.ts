import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { liquidWorkAreas } from '@/liquid-command/navigation/moduleCatalog';
import { inferLiquidArea } from '@/liquid-command/navigation/routeContext';
import { getLiquidPrimaryWorkflowRoute } from '@/liquid-command/navigation/workflowRoutes';

const source = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('Pflege Operations Workspace Live R1', () => {
  it('exposes the complete isolated operational workspace in Pflege', () => {
    const ids = liquidWorkAreas.pflege.map((area) => area.id);
    for (const id of ['home', 'clients', 'staff', 'tour-planning', 'duty-roster', 'fleet', 'inventory']) {
      expect(ids).toContain(id);
    }
  });

  it('keeps every operational route inside the Pflege namespace', () => {
    const operations = liquidWorkAreas.pflege.filter((area) =>
      ['home', 'clients', 'staff', 'tour-planning', 'duty-roster', 'fleet', 'inventory'].includes(area.id),
    );
    expect(operations.every((area) => area.route === '/pflege' || area.route.startsWith('/pflege/'))).toBe(true);
    expect(source('src/lib/pflege/pflegeCrossModuleLinks.ts')).not.toContain("href: '/assist/");
    expect(source('src/lib/pflege/pflegeCrossModuleLinks.ts')).not.toContain("href: '/stationaer/");
  });

  it('maps the new routes to their active Pflege tabs', () => {
    expect(inferLiquidArea('/pflege', 'pflege')).toBe('home');
    expect(inferLiquidArea('/pflege/klienten?client=x', 'pflege')).toBe('clients');
    expect(inferLiquidArea('/pflege/personal?employee=x', 'pflege')).toBe('staff');
    expect(inferLiquidArea('/pflege/tourenplanung', 'pflege')).toBe('tour-planning');
    expect(inferLiquidArea('/pflege/dienstplaene/new', 'pflege')).toBe('duty-roster');
    expect(inferLiquidArea('/pflege/fuhrpark', 'pflege')).toBe('fleet');
    expect(inferLiquidArea('/pflege/inventar/items', 'pflege')).toBe('inventory');
  });

  it('opens productive records and create workflows', () => {
    expect(getLiquidPrimaryWorkflowRoute('pflege', 'clients')).toBe('/pflege/klienten?create=1');
    expect(getLiquidPrimaryWorkflowRoute('pflege', 'staff')).toBe('/pflege/personal?create=1');
    expect(getLiquidPrimaryWorkflowRoute('pflege', 'duty-roster')).toBe('/pflege/dienstplaene/new');
    expect(source('app/pflege/index.tsx')).toContain('PflegeIndexScreen');
  });

  it('persists the Pflege duty roster with tenant RLS', () => {
    const migration = source('supabase/migrations/20260812210000_pfleger_operations_workspace_live_r1.sql');
    const service = source('src/lib/pflege/shiftScheduleService.ts');
    expect(migration).toContain('public.care_staff_shifts');
    expect(migration).toContain('public.care_tours');
    expect(migration).toContain('public.care_tour_stops');
    expect(migration).toContain('tenant_id = public.current_tenant_id()');
    expect(migration).toContain('created_by = auth.uid()');
    expect(service).toContain("'care_staff_shifts'");
    expect(service).toContain("getServiceMode() === 'supabase'");
    expect(source('src/lib/pflege/careTourPlanningService.ts')).toContain("'care_tour_stops'");
  });

  it('provides dedicated Pflege records, fleet and inventory routes', () => {
    expect(source('app/pflege/klienten.tsx')).toContain('ClientsListScreen');
    expect(source('app/pflege/personal.tsx')).toContain('EmployeesListScreen');
    expect(source('app/pflege/tourenplanung.tsx')).toContain('CareTourPlanningScreen');
    expect(source('app/pflege/fuhrpark.tsx')).toContain('categoryGroupFilter="vehicles"');
    expect(source('app/pflege/inventar/index.tsx')).toContain('baseRoute="/pflege/inventar"');
  });
});
