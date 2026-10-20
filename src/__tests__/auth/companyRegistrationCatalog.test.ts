import { describe, expect, it } from 'vitest';
import {
  COMPANY_REGISTRATION_CATALOG,
  canonicalCompanyCatalogValue,
  compareCompanyCatalogValues,
  normalizeCompanyCatalogText,
  normalizeCompanyRegistrationSelection,
  validateCompanyRegistrationSelection,
} from '@/lib/catalogs/companyRegistrationCatalog';
import { getCatalogOptions } from '@/lib/catalogs/systemCatalogService';

describe('company registration catalog', () => {
  it('maps established aliases to one stable category without confusing legal forms', () => {
    expect(compareCompanyCatalogValues('legal_form', ' UG ', 'Unternehmergesellschaft (haftungsbeschränkt)')).toBe(true);
    expect(compareCompanyCatalogValues('legal_form', 'gUG', 'UG')).toBe(false);
    expect(compareCompanyCatalogValues('legal_form', 'gGmbH', 'GmbH')).toBe(false);
    expect(compareCompanyCatalogValues('legal_form', 'eGbR', 'GbR')).toBe(false);
    expect(compareCompanyCatalogValues('industry', ' Alltagsbegleitung ', 'alltagsbegleitung')).toBe(true);
    expect(compareCompanyCatalogValues('industry', 'Pflege', 'Pflegedienst')).toBe(false);
  });
  it('does not infer a category from partial names or compare unclassified/other entries as matches', () => {
    expect(compareCompanyCatalogValues('industry', 'Pflege und Freizeit Spezial', 'Pflegedienst')).toBeNull();
    expect(compareCompanyCatalogValues('industry', 'Sonstige: Einrichtung A', 'Sonstige: Einrichtung B')).toBeNull();
    expect(compareCompanyCatalogValues('legal_form', '', '')).toBeNull();
  });
  it('has unambiguous aliases and exposes the same keys throughout the system catalog', () => {
    for (const kind of ['legal_form', 'industry'] as const) {
      const index = new Map<string, string>();
      for (const row of COMPANY_REGISTRATION_CATALOG[kind]) {
        for (const alias of [row.key, row.label, ...row.aliases]) {
          const normalized = normalizeCompanyCatalogText(alias);
          expect(index.get(normalized) ?? row.key).toBe(row.key);
          index.set(normalized, row.key);
        }
      }
      expect(getCatalogOptions(kind === 'legal_form' ? 'company_legal_form' : 'company_industry').map(row => row.value)).toEqual(COMPANY_REGISTRATION_CATALOG[kind].map(row => row.key));
    }
  });
  it('requires explicit selections and an explanation for other entries', () => {
    const valid = { legalForm: 'ug', industry: 'alltagsbegleitung' };
    expect(validateCompanyRegistrationSelection(valid)).toBeNull();
    for (const legalForm of ['', 'erfundene_rechtsform', 'sonstige', 'Sonstige: ', 'Sonstige: A']) {
      expect(validateCompanyRegistrationSelection({ ...valid, legalForm })).not.toBeNull();
    }
    expect(validateCompanyRegistrationSelection({ ...valid, industry: 'Sonstige: Familienunterstützung' })).toBeNull();
    expect(canonicalCompanyCatalogValue('industry', 'Sonstige:   Familienunterstützung  ')).toBe('Sonstige: Familienunterstützung');
  });
  it('preserves account data and produces canonical names with separate comparison keys', () => {
    expect(normalizeCompanyRegistrationSelection({ legalForm: 'UG', industry: 'Alltagsbegleitung', companyName: 'Testbetrieb' })).toEqual({
      legalForm: 'UG (haftungsbeschränkt)', legalFormKey: 'ug',
      industry: 'Ambulante Alltagsbegleitung', industryKey: 'alltagsbegleitung',
      registrationCatalogVersion: '2026-09-12', companyName: 'Testbetrieb',
    });
  });
});
