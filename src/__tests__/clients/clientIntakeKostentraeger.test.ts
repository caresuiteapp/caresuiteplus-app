import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  clearCostBearerTypeFields,
  clearDeselectedCostBearerTypes,
  getCostBearerFieldValues,
  MANUAL_COST_BEARER_TYPES,
  TEMPLATE_COST_BEARER_TYPES,
} from '@/lib/clients/clientIntakeCostBearerConfig';
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

  it('Wizard rendert Kostenträgerfelder dynamisch je nach Auswahl', () => {
    const screen = readSrc('screens/business/office/ClientIntakeWizardScreen.tsx');
    expect(screen).toContain('CareCostBearerTypeFields');
    expect(screen).toContain('orderedSelectedCostBearerTypes');
    expect(screen).toContain('updateCostBearerTypes');
    expect(screen).not.toContain('label="Pflegekasse"');
    expect(screen).not.toContain('label="Krankenkasse"');
  });

  it('Template-Suche nur für vorlagenbasierte Kostenträgertypen', () => {
    const fields = readSrc('components/inputs/CareCostBearerTypeFields.tsx');
    const config = readSrc('lib/clients/clientIntakeCostBearerConfig.ts');

    expect(fields).toContain('CareCostCarrierTemplateSearch');
    expect(fields).toContain('CareCostBearerManualFields');
    expect(fields).toContain('config.manualOnly');

    for (const type of TEMPLATE_COST_BEARER_TYPES) {
      expect(config).toContain(`templateType: '${type}'`);
    }
    for (const type of MANUAL_COST_BEARER_TYPES) {
      expect(config).toContain(`${type}: {`);
      expect(config).toMatch(new RegExp(`${type}:[\\s\\S]*?manualOnly: true`));
    }
  });

  it('validiert mindestens eine Abrechnungsart', () => {
    const errors = validateIntakeStep('kostentraeger', {
      ...EMPTY_CLIENT_INTAKE_FORM,
      careContexts: ['ambulatory_care'],
      billingTypes: [],
    });
    expect(errors.billingTypes).toBeTruthy();
  });

  it('validiert Pflegekasse nur wenn als Kostenträgertyp ausgewählt', () => {
    const base = {
      ...EMPTY_CLIENT_INTAKE_FORM,
      careContexts: ['ambulatory_care'] as const,
      billingTypes: ['pflegekasse'],
      careFundName: '',
    };

    expect(validateIntakeStep('kostentraeger', {
      ...base,
      costBearerTypes: ['pflegekasse'],
    }).careFundName).toBeTruthy();

    expect(validateIntakeStep('kostentraeger', {
      ...base,
      costBearerTypes: ['selbstzahler'],
    }).careFundName).toBeFalsy();
  });

  it('validiert Versichertennummer nur bei GKV-Kostenträgern', () => {
    const base = {
      ...EMPTY_CLIENT_INTAKE_FORM,
      careContexts: ['ambulatory_care'] as const,
      billingTypes: ['pflegekasse'],
      insuranceNumber: '',
    };

    expect(validateIntakeStep('kostentraeger', {
      ...base,
      costBearerTypes: ['pflegekasse'],
    }).insuranceNumber).toBeTruthy();

    expect(validateIntakeStep('kostentraeger', {
      ...base,
      costBearerTypes: ['selbstzahler'],
    }).insuranceNumber).toBeFalsy();
  });

  it('findet Knappschaft in Systemvorlagen inkl. Adresse', () => {
    const results = searchSystemCostCarrierTemplates('Knappschaft', 'krankenkasse');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.street).toBeTruthy();
    expect(results[0]?.zip).toBeTruthy();
    expect(results[0]?.city).toBeTruthy();
  });

  it('filtert Systemvorlagen nach Kostenträgerkategorie', () => {
    const pv = searchSystemCostCarrierTemplates('Allianz', 'privatversicherung');
    expect(pv.every((entry) => entry.type === 'privatversicherung')).toBe(true);

    const bg = searchSystemCostCarrierTemplates('BGW', 'berufsgenossenschaft');
    expect(bg.length).toBeGreaterThan(0);
    expect(bg[0]?.type).toBe('berufsgenossenschaft');
  });

  it('leert Felder beim Abwählen eines Kostenträgertyps', () => {
    const filled = {
      ...EMPTY_CLIENT_INTAKE_FORM,
      costBearerTypes: ['pflegekasse', 'selbstzahler'],
      careFundName: 'AOK Nordost',
      careFundStreet: 'Reinhardtstraße 28',
      selbstzahlerName: 'Max Mustermann',
    };

    const cleared = clearDeselectedCostBearerTypes(filled, ['selbstzahler']);
    expect(cleared.careFundName).toBe('');
    expect(cleared.careFundStreet).toBe('');
    expect(cleared.selbstzahlerName).toBe('Max Mustermann');

    const clearedSelbstzahler = clearCostBearerTypeFields(filled, 'selbstzahler');
    expect(getCostBearerFieldValues(clearedSelbstzahler, 'selbstzahler').name).toBe('');
  });

  it('leitet Kombi-Abrechnung aus Mehrfachauswahl ab', () => {
    expect(resolveIntakeBillingProfileType(['pflegekasse', 'selbstzahler'])).toBe('kombi');
    expect(resolveIntakeBillingProfileType(['kombination'])).toBe('kombi');
    expect(resolveIntakeBillingProfileType(['pflegekasse'])).toBe('pflegekasse');
  });
});
