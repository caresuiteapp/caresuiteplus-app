import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarEventTemplate, CalendarModuleKey } from '@/types/calendar';
import type { RoleKey } from '@/types';

const f = vi.hoisted(() => ({ client: {} as object | null, resolve: vi.fn(), calls: [] as { table: string; operations: [string, unknown[]][] }[] }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => f.client }));
vi.mock('@/lib/supabase/errors', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/supabase/errors')>(),
  toGermanSupabaseError: (error: { message?: string }) => error.message ?? 'Vorlagen konnten nicht geladen werden.',
}));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => {
  const call = { table, operations: [] as [string, unknown[]][] }; f.calls.push(call);
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'is', 'order']) chain[method] = (...args: unknown[]) => { call.operations.push([method, args]); return chain; };
  chain.then = (resolve: (result: unknown) => void, reject: (error: unknown) => void) => Promise.resolve().then(() => f.resolve(call)).then(resolve, reject);
  return chain;
} }));

import { getDefaultCalendarPlanningTemplates, listCalendarPlanningTemplates } from '@/lib/calendar/calendarPlanningTemplates.web';

const dbTemplate = (overrides: Record<string, unknown> = {}) => ({
  id: 'db-template', tenant_id: null, module_key: 'assist', template_key: 'assist_einsatz',
  label: 'Einsatz', description: 'Assist-Einsatz / Hausbesuch', source_type: 'assist_visit', event_type: 'einsatz',
  default_duration_minutes: 60, all_day: false, is_system: true, is_active: true, role_keys: [], field_schema: [], ...overrides,
});
const custom = (overrides: Record<string, unknown> = {}) => dbTemplate({
  id: 'custom-template', tenant_id: 'tenant-a', template_key: 'assist_custom', label: 'Eigene Besprechung',
  source_type: 'custom_event', event_type: 'besprechung', is_system: false, default_duration_minutes: 90, ...overrides,
});
const setRows = (system: Record<string, unknown>[], tenant: Record<string, unknown>[] = []) => f.resolve.mockImplementation((call: typeof f.calls[number]) => ({
  data: call.operations.some(([method, args]) => method === 'eq' && args[0] === 'is_system' && args[1] === true) ? system : tenant,
  error: null,
}));
const list = async (module: CalendarModuleKey = 'assist', tenant: string | null = 'tenant-a', role: RoleKey | null = 'business_admin') => {
  const result = await listCalendarPlanningTemplates(module, tenant, role);
  expect(result.ok).toBe(true);
  return result.ok ? result.data : [] as CalendarEventTemplate[];
};
beforeEach(() => { vi.clearAllMocks(); f.client = {}; f.calls = []; setRows([]); });

describe('Web calendar planning template catalog', () => {
  it('exposes the same generic standard catalog to picker counts without unsupported workflow entries', () => {
    const assist = getDefaultCalendarPlanningTemplates('assist');
    expect(assist).toHaveLength(4);
    const all = getDefaultCalendarPlanningTemplates();
    expect(all.filter(template => template.moduleKey === 'assist')).toEqual(assist);
    expect(all.every(template => template.sourceType !== 'assist_visit' && template.sourceType !== 'absence')).toBe(true);
  });

  it('shows ordinary Assist defaults when the database contains only the actual legacy Einsatz seed', async () => {
    setRows([dbTemplate()]);
    const templates = await list();
    expect(templates.map(template => [template.templateKey, template.label, template.eventType, template.defaultDurationMinutes, template.allDay])).toEqual([
      ['assist_besprechung', 'Besprechung', 'besprechung', 45, false],
      ['assist_erinnerung', 'Erinnerung', 'erinnerung', 1440, true],
      ['assist_rueckruf', 'Rückruf', 'termin', 15, false],
      ['assist_termin', 'Termin', 'termin', 60, false],
    ]);
    expect(templates.every(template => template.sourceType === 'custom_event' && template.isSystem && template.tenantId === null)).toBe(true);
  });

  it('replaces a single system key from the database while preserving every other standard template and tenant template', async () => {
    setRows([dbTemplate({ template_key: 'assist_termin', label: 'Persönliches Gespräch', source_type: 'custom_event', event_type: 'termin', default_duration_minutes: 75 })], [custom()]);
    const templates = await list();
    expect(templates).toHaveLength(5);
    expect(templates.find(template => template.templateKey === 'assist_termin')).toMatchObject({ id: 'db-template', label: 'Persönliches Gespräch', defaultDurationMinutes: 75 });
    expect(templates.find(template => template.templateKey === 'assist_custom')).toMatchObject({ id: 'custom-template', tenantId: 'tenant-a', isSystem: false, defaultDurationMinutes: 90 });
  });

  it('honors inactive and role-restricted system overrides instead of resurrecting their unrestricted defaults', async () => {
    setRows([
      dbTemplate({ template_key: 'assist_termin', source_type: 'custom_event', is_active: false }),
      dbTemplate({ template_key: 'assist_besprechung', source_type: 'custom_event', role_keys: ['dispatch'] }),
    ], [custom({ template_key: 'assist_termin' }), custom({ template_key: 'restricted-custom', role_keys: ['dispatch'] })]);
    expect((await list()).map(template => template.templateKey)).toEqual(['assist_erinnerung', 'assist_rueckruf']);
    const dispatch = await list('assist', 'tenant-a', 'dispatch');
    expect(dispatch.map(template => template.templateKey)).toContain('assist_besprechung');
    expect(dispatch.map(template => template.templateKey)).toContain('restricted-custom');
    expect(dispatch.map(template => template.templateKey)).not.toContain('assist_termin');
    expect((await list('assist', 'tenant-a', null)).map(template => template.templateKey)).toEqual(['assist_erinnerung', 'assist_rueckruf']);
  });

  it('keeps tenant and module boundaries in both the queries and returned rows', async () => {
    setRows([dbTemplate({ template_key: 'foreign-system', module_key: 'office' }), dbTemplate({ tenant_id: 'tenant-b', template_key: 'foreign-owner', source_type: 'custom_event' })], [
      custom(), custom({ id: 'foreign', tenant_id: 'tenant-b', template_key: 'foreign-tenant' }),
      custom({ module_key: 'office', template_key: 'foreign-module' }), custom({ is_system: true, template_key: 'invalid-system' }),
      custom({ is_active: false, template_key: 'inactive-custom' }),
    ]);
    const templates = await list();
    expect(templates.filter(template => !template.isSystem).map(template => template.templateKey)).toEqual(['assist_custom']);
    expect(templates.every(template => template.moduleKey === 'assist' && (template.tenantId === null || template.tenantId === 'tenant-a'))).toBe(true);
    expect(f.calls).toHaveLength(2);
    expect(f.calls[0].operations).toEqual(expect.arrayContaining([['eq', ['is_system', true]], ['is', ['tenant_id', null]], ['eq', ['module_key', 'assist']]]));
    expect(f.calls[0].operations).not.toContainEqual(['eq', ['is_active', true]]);
    expect(f.calls[1].operations).toEqual(expect.arrayContaining([['eq', ['tenant_id', 'tenant-a']], ['eq', ['is_system', false]], ['eq', ['is_active', true]], ['eq', ['module_key', 'assist']]]));
    expect(f.calls.every(call => call.table === 'calendar_event_templates' && call.operations.every(([method]) => ['select', 'eq', 'is', 'order'].includes(method)))).toBe(true);
  });

  it('identifies templates by module and key across the central calendar and does not fetch tenant rows without a tenant', async () => {
    setRows([dbTemplate({ template_key: 'office_termin', module_key: 'assist', label: 'Anderer Bereich', source_type: 'custom_event' })]);
    const templates = await list('all', null);
    expect(templates.filter(template => template.templateKey === 'office_termin')).toHaveLength(2);
    expect(templates.some(template => template.moduleKey === 'office' && template.templateKey === 'office_erinnerung')).toBe(true);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].operations.some(([method, args]) => method === 'eq' && args[0] === 'module_key')).toBe(false);
  });

  it('excludes genuine assignment and absence workflows, including tenant-provided variants', async () => {
    setRows([dbTemplate(), dbTemplate({ template_key: 'absence-db', source_type: 'absence' })], [custom({ source_type: 'assist_visit' }), custom({ template_key: 'custom-absence', source_type: 'absence' })]);
    expect((await list()).map(template => template.templateKey)).toEqual(['assist_besprechung', 'assist_erinnerung', 'assist_rueckruf', 'assist_termin']);
  });

  it.each(['PGRST205', '42P01'])('provides genuine built-in defaults when the templates table is unavailable (%s)', async code => {
    f.resolve.mockReturnValue({ data: null, error: { code, message: 'calendar_event_templates is missing' } });
    expect(await list()).toHaveLength(4);
    expect(f.calls).toHaveLength(1);
  });

  it('provides the same defaults without a configured connection and keeps role restrictions in other modules', async () => {
    f.client = null;
    expect(await list()).toHaveLength(4);
    expect(await list('beratung', null, 'business_admin')).toEqual([]);
    expect(await list('beratung', null, 'counselor')).toHaveLength(2);
    expect(f.calls).toEqual([]);
  });

  it.each(['42501', 'PGRST301', 'PGRST204', '08006'])('reports real query errors instead of bypassing them with defaults (%s)', async code => {
    f.resolve.mockReturnValue({ data: null, error: { code, message: 'Kalendervorlagen nicht verfügbar' } });
    expect(await listCalendarPlanningTemplates('assist', 'tenant-a', 'business_admin')).toEqual({ ok: false, error: 'Kalendervorlagen nicht verfügbar' });
    expect(f.calls).toHaveLength(1);
  });

  it('keeps tenant query failures and rejected requests visible', async () => {
    f.resolve.mockResolvedValueOnce({ data: [dbTemplate()], error: null }).mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'Mandantenvorlagen nicht freigegeben' } });
    expect(await listCalendarPlanningTemplates('assist', 'tenant-a', 'business_admin')).toEqual({ ok: false, error: 'Mandantenvorlagen nicht freigegeben' });
    f.resolve.mockRejectedValue(new Error('Verbindung unterbrochen'));
    expect(await listCalendarPlanningTemplates('assist', 'tenant-a', 'business_admin')).toEqual({ ok: false, error: 'Verbindung unterbrochen' });
  });
});
