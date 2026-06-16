import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Office Detail Heroes (Sprint 85)', () => {
  it('ClientDetailHero nutzt PremiumListHeroFrame mit Kontext-KPIs', () => {
    const hero = readSrc('src/components/office/ClientDetailHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('OFFICE · KLIENT:INNEN-AKTE');
    expect(hero).toContain('buildClientDetailKpis');
    expect(hero).toContain('PremiumKpiCard');
  });

  it('InvoiceDetailHero nutzt PremiumListHeroFrame mit Buchhaltung preparedOnly', () => {
    const hero = readSrc('src/components/office/InvoiceDetailHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('OFFICE · RECHNUNG');
    expect(hero).toContain('buildInvoiceDetailKpis');
    expect(hero).toContain('Buchhaltung preparedOnly');
    expect(hero).toContain('INVOICE_ACCOUNTING_STATUS_LABELS');
  });

  it('BudgetDetailHero nutzt PremiumListHeroFrame mit Auslastungs-KPIs', () => {
    const hero = readSrc('src/components/office/BudgetDetailHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('OFFICE · BUDGET');
    expect(hero).toContain('buildBudgetDetailKpis');
    expect(hero).toContain('Limit nahe');
  });

  it('ClientDetailScreen ersetzt flaches PremiumCard durch ClientDetailHero', () => {
    const screen = readSrc('src/screens/office/ClientDetailScreen.tsx');
    expect(screen).toContain('ClientDetailHero');
    expect(screen).not.toContain('headerCard');
  });

  it('InvoiceDetailScreen nutzt InvoiceAccountingPanel', () => {
    const screen = readSrc('src/screens/office/InvoiceDetailScreen.tsx');
    expect(screen).toContain('InvoiceAccountingPanel');
    expect(screen).not.toContain('DATEV-Export (Outbox)');
  });

  it('BudgetDetailScreen nutzt BudgetDetailHero statt PremiumCard', () => {
    const screen = readSrc('src/screens/office/BudgetDetailScreen.tsx');
    expect(screen).toContain('BudgetDetailHero');
    expect(screen).not.toContain('usagePercent} % ausgeschöpft');
  });

  it('buildClientDetailKpis liefert Dokumente, Termine, Rechnungen, Einsätze', () => {
    const stats = readSrc('src/lib/office/clientDetailStats.ts');
    expect(stats).toContain('buildClientDetailKpis');
    expect(stats).toContain('Dokumente');
    expect(stats).toContain('Einsätze');
  });
});
