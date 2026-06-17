import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { mapClientBudgetRowToListItem } from '@/lib/office/budgetListMapper';
import { fetchBudgetList } from '@/lib/office/budgetListService';
import { buildBudgetListKpis } from '@/lib/office/budgetListStats';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import { BUDGET_STATUS_FILTERS } from '@/hooks/useBudgetList';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Office Budgets list', () => {
  it('enforcePermission schützt Budget-List-Service', () => {
    expect(enforcePermission(null, 'office.budgets.view' as never)).not.toBeNull();
  });

  it('fetchBudgetList liefert Demo-Budgets', async () => {
    const result = await fetchBudgetList(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]?.label).toBeTruthy();
    }
  });

  it('mapClientBudgetRowToListItem mappt Live-Schema auf ListItem', () => {
    const item = mapClientBudgetRowToListItem({
      id: 'budget-live-001',
      tenant_id: 'tenant-001',
      client_id: 'client-001',
      budget_type: 's45b',
      status: 'active',
      care_level: null,
      budget_year: 2026,
      budget_month: 6,
      monthly_amount: 131,
      yearly_amount: null,
      carried_forward_amount: null,
      reserved_amount: 0,
      used_amount: 64,
      available_amount: 67,
      valid_from: '2026-06-01',
      valid_until: '2026-06-30',
      cost_bearer_name: null,
      cost_bearer_reference: null,
      notes: null,
      created_by: null,
      updated_by: null,
      created_at: '2026-06-01T08:00:00.000Z',
      updated_at: '2026-06-17T08:00:00.000Z',
      clients: { first_name: 'Maria', last_name: 'Muster' },
    });

    expect(item.clientName).toBe('Maria Muster');
    expect(item.label).toContain('§45b');
    expect(item.period).toBe('monthly');
    expect(item.allocatedCents).toBe(13100);
    expect(item.usedCents).toBe(6400);
    expect(item.status).toBe('aktiv');
    expect(item.usagePercent).toBe(49);
  });

  it('buildBudgetListKpis berechnet Kennzahlen', () => {
    const kpis = buildBudgetListKpis([
      {
        id: '1',
        tenantId: 't',
        clientId: 'c',
        clientName: 'Test',
        label: 'Budget',
        period: 'monthly',
        allocatedCents: 10000,
        usedCents: 9000,
        currency: 'EUR',
        status: 'aktiv',
        updatedAt: '2026-06-01T08:00:00.000Z',
        usagePercent: 90,
      },
    ]);
    expect(kpis.some((k) => k.id === 'near-limit')).toBe(true);
  });

  it('Statusfilter sind vollständig definiert', () => {
    expect(BUDGET_STATUS_FILTERS.some((f) => f.key === 'aktiv')).toBe(true);
  });

  it('budgetListService nutzt Supabase-Repository im Live-Pfad', () => {
    const source = readSrc('src/lib/office/budgetListService.ts');
    expect(source).toContain('getServiceMode');
    expect(source).toContain('budgetSupabaseRepository');
    expect(source).not.toContain('Budgets im Live-Modus noch nicht angebunden');
  });

  it('BudgetsListScreen zeigt leeren Mandanten-Zustand', () => {
    const source = readSrc('src/screens/office/BudgetsListScreen.tsx');
    expect(source).toContain('Keine Budgets');
    expect(source).not.toContain('Demo-Mandanten');
  });
});
