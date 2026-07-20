import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { selectCurrentBudgetAccounts } from '@/lib/assist/clientAssistBillingProfileService';
import { normalizeLegacyCareGradeValidFrom } from '@/lib/assist/clientCareEntitlementSyncService';

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('Office Klient:innen und Abrechnung – visuelle Regression', () => {
  it('verwendet das Geburtsdatum niemals als Pflegegrad-Beginn', () => {
    expect(normalizeLegacyCareGradeValidFrom('1992-01-19', '1992-01-19', '2026-07-20')).toBe('2026-07-20');
    expect(normalizeLegacyCareGradeValidFrom('2024-06-01', '1992-01-19', '2026-07-20')).toBe('2024-06-01');
  });

  it('zeigt je Katalog nur das Konto des aktuellen Zeitraums', () => {
    const accounts = [
      { id: 'june', catalogKey: 'paragraph_45b', periodStart: '2026-06-01', periodEnd: '2026-06-30', usedCents: 0, reservedCents: 0 },
      { id: 'july', catalogKey: 'paragraph_45b', periodStart: '2026-07-01', periodEnd: '2026-07-31', usedCents: 8188, reservedCents: 0 },
      { id: 'annual', catalogKey: 'verhinderungspflege', periodStart: '2026-01-01', periodEnd: '2026-12-31', usedCents: 0, reservedCents: 0 },
    ];
    expect(selectCurrentBudgetAccounts(accounts, '2026-07-20').map((account) => account.id)).toEqual([
      'july',
      'annual',
    ]);
  });

  it('lässt Tabellen die verfügbare Breite ausfüllen', () => {
    expect(read('src/components/ui/PremiumDataTable.tsx')).toContain("fluidTable: { width: '100%' }");
  });

  it('zeigt das Rechnungsformular kompakt und vollständig systemgeführt', () => {
    const create = read('src/screens/office/InvoiceCreateScreen.tsx');
    expect(create).toContain('compact');
    expect(create).toContain('CareEntitySelect');
    expect(create).toContain('label="Klient:in"');
    expect(create).toContain('label="Rechnungsart"');
    expect(create).toContain('label="Abrechnungsmonat"');
    expect(create).toContain('label="Zahlungsziel"');
    expect(create).toContain('Automatische Rechnungsdaten');
    expect(create).not.toContain('<PremiumInput');
    expect(create).not.toContain('<EmptyState title="Neue Rechnung"');
    expect(create).not.toContain('CatalogValueSelect');
    const service = read('src/lib/office/invoiceCreateService.ts');
    const repository = read('src/lib/services/repositories/invoiceRepository.supabase.ts');
    expect(service).toContain('input.clientId');
    expect(service).toContain('createFromServiceRecords');
    expect(service).toContain('input.clientId');
    expect(repository).toContain('client_id: input.clientId ?? null');
    expect(repository).toContain('due_date: input.dueDate ?? null');
    expect(repository).toContain("from('invoice_items').insert");
  });

  it('entfernt den überlagernden Dokumentenblock von der Abrechnungsübersicht', () => {
    const billing = read('src/screens/office/OfficeBillingScreen.tsx');
    expect(billing).toContain('OfficeBillingHero stats={stats} roleKey={roleKey} compact');
    expect(billing).not.toContain('ModuleDocumentsSection');
  });
});
