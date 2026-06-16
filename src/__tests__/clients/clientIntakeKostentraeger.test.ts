import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { resolveIntakeBillingProfileType } from '@/lib/clients/clientIntakeBilling';
import { validateIntakeStep } from '@/lib/clients/clientIntakeService';
import { searchSystemCostCarrierTemplates } from '@/lib/catalogs/systemCostCarrierSearchService';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';

const srcRoot = path.join(__dirname, '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(srcRoot, relativePath), 'utf8');
}

describe('Client intake step 5 — Kostenträger / Abrechnung', () => {
  it('Wizard nutzt Mehrfachauswahl für Abrechnungsart und Kostenträgertyp', () => {
    const screen = readSrc('screens/business/office/ClientIntakeWizardScreen.tsx');
    expect(screen).toContain('CareMultiCatalogSelect');
    expect(screen).toContain('values={form.billingTypes}');
    expect(screen).toContain('values={form.costBearerTypes}');
    expect(screen).not.toContain('value={form.billingType}');
  });

  it('Wizard nutzt Systemvorlagen-Suche für Pflegekasse und Krankenkasse', () => {
    const screen = readSrc('screens/business/office/ClientIntakeWizardScreen.tsx');
    expect(screen).toContain('CareCostCarrierTemplateSearch');
    expect(screen).toContain('carrierType="pflegekasse"');
    expect(screen).toContain('carrierType="krankenkasse"');
  });

  it('validiert mindestens eine Abrechnungsart', () => {
    const errors = validateIntakeStep('kostentraeger', {
      ...EMPTY_CLIENT_INTAKE_FORM,
      careContexts: ['ambulatory_care'],
      billingTypes: [],
    });
    expect(errors.billingTypes).toBeTruthy();
  });

  it('findet Knappschaft in Systemvorlagen inkl. Adresse', () => {
    const results = searchSystemCostCarrierTemplates('Knappschaft', 'krankenkasse');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.street).toBeTruthy();
    expect(results[0]?.zip).toBeTruthy();
    expect(results[0]?.city).toBeTruthy();
  });

  it('leitet Kombi-Abrechnung aus Mehrfachauswahl ab', () => {
    expect(resolveIntakeBillingProfileType(['pflegekasse', 'selbstzahler'])).toBe('kombi');
    expect(resolveIntakeBillingProfileType(['kombination'])).toBe('kombi');
    expect(resolveIntakeBillingProfileType(['pflegekasse'])).toBe('pflegekasse');
  });
});
