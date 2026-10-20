import { expect, it } from 'vitest';
import { canonicalCompanyContactFunction, COMPANY_CONTACT_FUNCTIONS, resolveCompanyContactFunction, validateCompanyContactFunction } from '@/lib/catalogs/companyContactFunctionCatalog';
import { SYSTEM_CATALOGS } from '@/lib/catalogs/systemCatalogs';

it('uses the same stable choices in the registration and system catalog', () => {
  expect(SYSTEM_CATALOGS.company_contact_function.entries.map(({key,label}) => ({key,label}))).toEqual(COMPANY_CONTACT_FUNCTIONS.map(({key,label}) => ({key,label})));
  expect(new Set(COMPANY_CONTACT_FUNCTIONS.map(row => row.key)).size).toBe(COMPANY_CONTACT_FUNCTIONS.length);
});
it('normalizes old labels without mixing management and deputy functions', () => {
  expect(canonicalCompanyContactFunction(' Geschäftsführerin ')).toBe('Geschäftsführung');
  expect(canonicalCompanyContactFunction('PDL')).toBe('Pflegedienstleitung (PDL)');
  expect(resolveCompanyContactFunction('Stellv. PDL')?.key).toBe('stellv_pflegedienstleitung');
  expect(resolveCompanyContactFunction('Unbekannte Funktion')).toBeNull();
});
it('requires a catalog decision and a meaningful description for other', () => {
  expect(validateCompanyContactFunction('')).toBeTruthy();
  expect(validateCompanyContactFunction('Unbekannte Funktion')).toBeTruthy();
  expect(validateCompanyContactFunction('Sonstige Funktion')).toContain('genauer beschreiben');
  expect(validateCompanyContactFunction('Sonstige:  ')).toBeTruthy();
  expect(validateCompanyContactFunction('Sonstige: '+ 'a'.repeat(181))).toBeTruthy();
  expect(canonicalCompanyContactFunction('Sonstige: Qualitätsmanagement ')).toBe('Sonstige: Qualitätsmanagement');
  expect(validateCompanyContactFunction('Geschäftsführung')).toBeNull();
});
