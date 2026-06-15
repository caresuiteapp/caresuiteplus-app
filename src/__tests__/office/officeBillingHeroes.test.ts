import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildBillingDashboardKpis } from '@/lib/office/billingStats';
import { buildBudgetListKpis } from '@/lib/office/budgetListStats';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Office Billing Heroes (Sprint 90)', () => {
  it('OfficeBillingHero nutzt PremiumListHeroFrame', () => {
    const hero = readSrc('src/components/office/OfficeBillingHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Abrechnung');
    expect(hero).toContain('buildBillingDashboardKpis');
  });

  it('BudgetsListHero nutzt CareLightListHeroFrame mit preparedOnly', () => {
    const hero = readSrc('src/components/office/BudgetsListHero.tsx');
    expect(hero).toContain('CareLightListHeroFrame');
    expect(hero).toContain('Budgets');
    expect(hero).toContain('Demo / preparedOnly');
  });

  it('OfficeBillingScreen und BudgetsListScreen nutzen Heroes', () => {
    expect(readSrc('src/screens/office/OfficeBillingScreen.tsx')).toContain('OfficeBillingHero');
    expect(readSrc('src/screens/office/BudgetsListScreen.tsx')).toContain('BudgetsListHero');
  });

  it('buildBillingDashboardKpis formatiert Rechnungen', () => {
    const kpis = buildBillingDashboardKpis({
      openInvoicesCount: 3,
      openInvoicesCents: 15000,
      overdueCount: 1,
      activeBudgetsCount: 5,
      budgetsNearLimitCount: 2,
    });
    expect(kpis[0]?.value).toBe('3');
    expect(kpis[2]?.value).toBe('5');
  });

  it('buildBudgetListKpis berechnet Auslastung', () => {
    const kpis = buildBudgetListKpis([
      {
        id: '1',
        tenantId: 't1',
        clientId: 'c1',
        clientName: 'A',
        label: 'Budget A',
        period: 'monthly',
        allocatedCents: 10000,
        usedCents: 9000,
        currency: 'EUR',
        status: 'aktiv',
        updatedAt: '2026-01-01',
        usagePercent: 90,
      },
    ]);
    expect(kpis[0]?.value).toBe('1');
    expect(kpis[1]?.value).toBe('1');
  });
});
