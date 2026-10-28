import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCompanyBudgetSettings, fetchCompanyServiceSettings, parseCompanyAmount, saveCompanyBillingRate, saveCompanyBudgetDefault, saveCompanyServiceType } from '@/lib/tenant/companyClientSettings.web';
const TENANT = '11111111-1111-4111-8111-111111111111';
const h = vi.hoisted(() => ({ calls: [] as { table: string; operation: string; value?: unknown }[], response: {} as Record<string, { data: unknown; error: unknown }> }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ from: (table: string) => {
  h.calls.push({ table, operation: 'from' });
  const query = {
    select: (value: string) => { h.calls.push({ table, operation: 'select', value }); return query; },
    eq: (column: string, value: unknown) => { h.calls.push({ table, operation: `eq:${column}`, value }); return query; },
    order: () => query,
    update: (value: unknown) => { h.calls.push({ table, operation: 'update', value }); return query; },
    maybeSingle: () => Promise.resolve(h.response[table] ?? { data: null, error: null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(h.response[table] ?? { data: [], error: null }).then(resolve),
  }; return query;
} }) }));
// Keep the real tenant guard active while every database operation remains mocked.
beforeEach(() => {
  vi.stubEnv('APP_ENV', 'production');
  vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
  vi.stubEnv('EXPO_PUBLIC_ENVIRONMENT_MODE', 'production');
  h.calls = []; h.response = {};
});

describe('company client settings web services', () => {
  it('loads existing service and budget settings without seeds or writes', async () => {
    expect((await fetchCompanyServiceSettings(TENANT, 'business_admin')).ok).toBe(true);
    expect((await fetchCompanyBudgetSettings(TENANT, 'business_admin')).ok).toBe(true);
    expect(h.calls.filter(call => call.operation === 'from')).toHaveLength(5);
    expect(h.calls.filter(call => call.operation === 'eq:tenant_id')).toHaveLength(5);
    expect(h.calls.some(call => call.operation === 'update')).toBe(false);
  });
  it('blocks insufficient permissions and missing tenant context before querying', async () => {
    expect((await fetchCompanyBudgetSettings(TENANT, 'employee_portal')).ok).toBe(false);
    expect((await saveCompanyBillingRate('', 'business_admin', 'rule-b', '12')).ok).toBe(false);
    expect((await saveCompanyServiceType(TENANT, 'employee_portal', 'type-a', { name: 'Name', description: '' })).ok).toBe(false);
    expect(h.calls).toEqual([]);
  });
  it('updates only the selected rule within the tenant and preserves zero prices', async () => {
    h.response.tenant_service_type_billing_rules = { error: null, data: { id: 'rule-b', service_type_id: 'type-b', default_rate_amount: 0, default_unit: 'hour', is_active: true } };
    const result = await saveCompanyBillingRate(TENANT, 'business_admin', 'rule-b', '0');
    expect(result).toMatchObject({ ok: true, data: { id: 'rule-b', rate: 0 } });
    expect(h.calls).toContainEqual({ table: 'tenant_service_type_billing_rules', operation: 'update', value: { default_rate_amount: 0 } });
    expect(h.calls).toContainEqual({ table: 'tenant_service_type_billing_rules', operation: 'eq:id', value: 'rule-b' });
    expect(h.calls).toContainEqual({ table: 'tenant_service_type_billing_rules', operation: 'eq:tenant_id', value: TENANT });
  });
  it('rejects invalid financial values before any database call', async () => {
    for (const value of ['-1', '2,555', 'NaN', 'Infinity', '1.2.3']) expect((await saveCompanyBillingRate(TENANT, 'business_admin', 'rule-a', value)).ok).toBe(false);
    expect((await saveCompanyBudgetDefault(TENANT, 'business_admin', 'budget-a', { amount: '1', monthly: '', yearly: '', conversion: '101', notes: '' })).ok).toBe(false);
    expect(h.calls).toEqual([]);
    expect(parseCompanyAmount('2,50')).toEqual({ ok: true, data: 2.5 });
    expect(parseCompanyAmount('')).toEqual({ ok: true, data: null });
  });
  it('keeps optional budget limits empty and converts exact decimal values into cents', async () => {
    h.response.tenant_budget_defaults = { error: null, data: { id: 'budget-a', tenant_id: TENANT, budget_year_id: 'year-a', budget_type_id: 'type-a', amount_cents: 2345, monthly_amount_cents: null, yearly_amount_cents: 0, conversion_rate_pct: 0 } };
    const result = await saveCompanyBudgetDefault(TENANT, 'business_admin', 'budget-a', { amount: '23,45', monthly: '', yearly: '0', conversion: '0', notes: ' Notiz ' });
    expect(result).toMatchObject({ ok: true, data: { amountCents: 2345, monthlyAmountCents: null, yearlyAmountCents: 0, conversionRatePct: 0 } });
    expect(h.calls).toContainEqual({ table: 'tenant_budget_defaults', operation: 'update', value: { amount_cents: 2345, monthly_amount_cents: null, yearly_amount_cents: 0, conversion_rate_pct: 0, notes: 'Notiz' } });
  });
  it('reports failed or zero-row writes as errors rather than saved', async () => {
    h.response.tenant_client_service_types = { data: null, error: null };
    const missing = await saveCompanyServiceType(TENANT, 'business_admin', 'gone', { name: 'Test', description: '' });
    expect(missing.ok).toBe(false);
    h.response.tenant_service_type_billing_rules = { data: null, error: { message: 'Permission denied', code: '42501' } };
    expect((await saveCompanyBillingRate(TENANT, 'business_admin', 'rule-a', '2')).ok).toBe(false);
  });
});
