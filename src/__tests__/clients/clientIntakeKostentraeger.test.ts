import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  clearCostBearerTypeFields,
  COST_BEARER_TYPE_CONFIG,
  getCostBearerFieldValues,
  MANUAL_COST_BEARER_TYPES,
  TEMPLATE_COST_BEARER_TYPES,
} from '@/lib/clients/clientIntakeCostBearerConfig';
import { resolveIntakeBillingProfileType } from '@/lib/clients/clientIntakeBilling';
import { validateIntakeStep } from '@/lib/clients/clientIntakeService';
import { searchSystemCostCarrierTemplates } from '@/lib/catalogs/systemCostCarrierSearchService';
import {
  mapUiCostBearerTypeToDbCarrierType,
  UI_TO_DB_CARRIER_TYPE,
  DB_CARRIER_TYPE_COUNTS,
} from '@/features/costCarriers/costCarrierTypes';
import {
  usesSystemTemplateSearch,
  validateCostBearerEntry,
  validateCostBearerIk,
} from '@/features/costCarriers/costCarrierService';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';
import type { ClientCareContext } from '@/lib/clients/clientIntakeFieldRules';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';

const srcRoot = path.join(__dirname, '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(srcRoot, relativePath), 'utf8');
}

describe('Client intake step 5 — Kostenträger / Abrechnung', () => {
  it('Wizard nutzt sequentiellen Kostenträger-Panel statt Mehrfach-Feldblöcke', () => {
    const screen = readSrc('screens/business/office/ClientIntakeWizardScreen.tsx');
    expect(screen).toContain('CareCostBearerStepPanel');
    expect(screen).toContain('CareMultiCatalogSelect');
    expect(screen).toContain('values={form.billingTypes}');
    expect(screen).not.toContain('values={form.costBearerTypes}');
    expect(screen).not.toContain('selectedCostBearerTypes.map');
    expect(screen).not.toContain('label="Pflegekasse"');
    expect(screen).not.toContain('label="Krankenkasse"');
  });

  it('zeigt nur den aktiven Kostenträgertyp als Eingabefeld', () => {
    const panel = readSrc('components/inputs/CareCostBearerStepPanel.tsx');
    const screen = readSrc('screens/business/office/ClientIntakeWizardScreen.tsx');
    expect(panel).toContain('CareCatalogSelect');
    expect(panel).toContain('activeCostBearerType');
    expect(panel).toContain('activeType ?');
    expect(panel).toMatch(/<CareCostBearerTypeFields[\s\S]*?type=\{activeType\}/);
    expect(screen).not.toContain('selectedCostBearerTypes.map');
  });

  it('mappt UI-Kostenträgertypen auf DB carrier_type', () => {
    expect(mapUiCostBearerTypeToDbCarrierType('pflegekasse')).toBe('care_insurance');
    expect(mapUiCostBearerTypeToDbCarrierType('krankenkasse')).toBe('health_insurance');
    expect(mapUiCostBearerTypeToDbCarrierType('privatversicherung')).toBe('private_insurance');
    expect(mapUiCostBearerTypeToDbCarrierType('sozialamt')).toBe('social_welfare_office');
    expect(mapUiCostBearerTypeToDbCarrierType('berufsgenossenschaft')).toBe('employers_liability_insurance');
    expect(mapUiCostBearerTypeToDbCarrierType('unfallversicherung')).toBe('accident_insurance');
    expect(Object.keys(UI_TO_DB_CARRIER_TYPE)).toHaveLength(6);
  });

  it('Template-Suche nur für vorlagenbasierte Kostenträgertypen', () => {
    const fields = readSrc('components/inputs/CareCostBearerTypeFields.tsx');
    const search = readSrc('components/inputs/CareCostCarrierTemplateSearch.tsx');
    const repository = readSrc('features/costCarriers/costCarrierRepository.ts');

    expect(fields).toContain('CareCostCarrierTemplateSearch');
    expect(fields).toContain('CareCostBearerManualFields');
    expect(fields).toContain('config.manualOnly');
    expect(search).toContain('searchCostCarrierTemplates');
    expect(repository).toContain('search_cost_carrier_system_templates');

    for (const type of TEMPLATE_COST_BEARER_TYPES) {
      expect(usesSystemTemplateSearch(type)).toBe(true);
      expect(COST_BEARER_TYPE_CONFIG[type].manualOnly).toBe(false);
    }
    for (const type of MANUAL_COST_BEARER_TYPES) {
      expect(usesSystemTemplateSearch(type)).toBe(false);
      expect(COST_BEARER_TYPE_CONFIG[type].manualOnly).toBe(true);
    }
  });

  it('keine System-Suche für Beihilfe, Selbstzahler und Sonstiger', () => {
    for (const type of MANUAL_COST_BEARER_TYPES) {
      expect(usesSystemTemplateSearch(type)).toBe(false);
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

  it('validiert Pflegekasse nur wenn als Kostenträger übernommen', () => {
    const base: ClientIntakeFormData = {
      ...EMPTY_CLIENT_INTAKE_FORM,
      careContexts: ['ambulatory_care'] as ClientCareContext[],
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
    const base: ClientIntakeFormData = {
      ...EMPTY_CLIENT_INTAKE_FORM,
      careContexts: ['ambulatory_care'] as ClientCareContext[],
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

  it('IK optional, aber bei Angabe genau 9 Ziffern', () => {
    expect(validateCostBearerIk('')).toBeNull();
    expect(validateCostBearerIk('123456789')).toBeNull();
    expect(validateCostBearerIk('123')).toContain('9 Ziffern');
    expect(validateCostBearerIk('1234567890')).toContain('9 Ziffern');
  });

  it('validiert Pflichtnamen für Beihilfe, Sonstiger und Selbstzahler', () => {
    expect(validateCostBearerEntry('beihilfe', { name: '', street: '', zip: '', city: '', ikNumber: '' }))
      .toContain('Name');
    expect(validateCostBearerEntry('sonstiger', { name: '', street: '', zip: '', city: '', ikNumber: '' }))
      .toContain('Name');
    expect(validateCostBearerEntry('selbstzahler', { name: '', street: '', zip: '', city: '', ikNumber: '' }))
      .toContain('Rechnungsempfänger');
  });

  it('findet Knappschaft in Demo-Systemvorlagen inkl. Adresse', () => {
    const results = searchSystemCostCarrierTemplates('Knappschaft', 'krankenkasse');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.street).toBeTruthy();
    expect(results[0]?.zip).toBeTruthy();
    expect(results[0]?.city).toBeTruthy();
  });

  it('filtert Demo-Systemvorlagen nach Kostenträgerkategorie', () => {
    const pv = searchSystemCostCarrierTemplates('Allianz', 'privatversicherung');
    expect(pv.every((entry) => entry.type === 'privatversicherung')).toBe(true);

    const bg = searchSystemCostCarrierTemplates('BGW', 'berufsgenossenschaft');
    expect(bg.length).toBeGreaterThan(0);
    expect(bg[0]?.type).toBe('berufsgenossenschaft');
  });

  it('übernimmt Systemvorlage-Felder in Formularwerte', () => {
    const form = {
      ...EMPTY_CLIENT_INTAKE_FORM,
      activeCostBearerType: 'pflegekasse',
      careFundName: 'AOK Nordost',
      careFundStreet: 'Reinhardtstraße 28',
      careFundZip: '10117',
      careFundCity: 'Berlin',
      costBearerIk: '109519005',
      costBearerTemplateIds: { pflegekasse: 'template-uuid' },
      costBearerDbTypes: { pflegekasse: 'care_insurance' },
    };

    const values = getCostBearerFieldValues(form, 'pflegekasse');
    expect(values.name).toBe('AOK Nordost');
    expect(values.street).toContain('Reinhardt');
    expect(form.costBearerTemplateIds.pflegekasse).toBe('template-uuid');
    expect(form.costBearerDbTypes.pflegekasse).toBe('care_insurance');
  });

  it('leert Felder und Metadaten beim Entfernen eines Kostenträgertyps', () => {
    const filled = {
      ...EMPTY_CLIENT_INTAKE_FORM,
      costBearerTypes: ['pflegekasse', 'selbstzahler'],
      activeCostBearerType: 'pflegekasse',
      careFundName: 'AOK Nordost',
      careFundStreet: 'Reinhardtstraße 28',
      costBearerTemplateIds: { pflegekasse: 'template-uuid' },
      costBearerDbTypes: { pflegekasse: 'care_insurance' },
      selbstzahlerName: 'Max Mustermann',
    };

    const cleared = clearCostBearerTypeFields(filled, 'pflegekasse');
    expect(cleared.careFundName).toBe('');
    expect(cleared.careFundStreet).toBe('');
    expect(cleared.costBearerTemplateIds.pflegekasse).toBeUndefined();
    expect(cleared.costBearerDbTypes.pflegekasse).toBeUndefined();
    expect(cleared.costBearerTypes).not.toContain('pflegekasse');
    expect(cleared.selbstzahlerName).toBe('Max Mustermann');
  });

  it('leitet Kombi-Abrechnung aus Mehrfachauswahl ab', () => {
    expect(resolveIntakeBillingProfileType(['pflegekasse', 'selbstzahler'])).toBe('kombi');
    expect(resolveIntakeBillingProfileType(['kombination'])).toBe('kombi');
    expect(resolveIntakeBillingProfileType(['pflegekasse'])).toBe('pflegekasse');
  });

  it('persistiert Mandanten-Override statt globale Systemvorlage zu überschreiben', () => {
    const service = readSrc('features/costCarriers/costCarrierService.ts');
    expect(service).toContain('insertTenantCostCarrierOverride');
    expect(service).not.toContain("from('cost_carrier_system_templates').update");
    expect(service).toContain('tenant_override_id');
  });

  it('kennt die verifizierten Supabase-Stammdaten-Zählwerte', () => {
    expect(DB_CARRIER_TYPE_COUNTS.care_insurance).toBe(93);
    expect(DB_CARRIER_TYPE_COUNTS.health_insurance).toBe(93);
    expect(DB_CARRIER_TYPE_COUNTS.social_welfare_office).toBe(401);
    expect(
      Object.values(DB_CARRIER_TYPE_COUNTS).reduce((sum, count) => sum + count, 0),
    ).toBe(672);
  });
});
