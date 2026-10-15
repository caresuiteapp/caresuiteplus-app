import { describe, expect, it } from 'vitest';
import {
  activeCompanyCatalog,
  companyDate,
  companyIdentity,
  companySections,
  companySuggestions,
  companyWebsite,
  filterCompanySections,
  maskedCompanyIban,
} from '@/lib/tenant/companyWorkspaceModel.web';
import {
  DEFAULT_TENANT_MODULES,
  EMPTY_TENANT_BRANDING,
  EMPTY_TENANT_COMPANY,
  EMPTY_TENANT_LEGAL,
  EMPTY_TENANT_PAYMENT,
  EMPTY_TENANT_REGISTER,
  EMPTY_TENANT_TAX,
  type TenantCenterSnapshot,
  type TenantServiceCatalogItem,
} from '@/types/tenant/tenantCenter';

function catalogItem(overrides: Partial<TenantServiceCatalogItem> = {}): TenantServiceCatalogItem {
  return {
    id: 'service-standard', moduleKey: 'assist', serviceKey: 'assist.standard',
    name: 'Alltagsbegleitung', description: 'Begleitung im Alltag', unit: 'hour',
    category: 'service', isActive: true, sortOrder: 0, defaultPriceNet: 38,
    defaultTaxMode: 'exempt_4_16', ...overrides,
  };
}

/** Independent, complete fixture; no service, seeded store or live data is involved. */
function snapshot(): TenantCenterSnapshot {
  return {
    tenantId: 'tenant-company-model', updatedAt: '2026-10-15T10:30:00Z',
    company: {
      ...EMPTY_TENANT_COMPANY, name: 'Nordlicht Betreuung', legalName: 'Nordlicht Betreuung GmbH',
      legalForm: 'GmbH', industry: 'Alltagsbegleitung', street: 'Hafenstraße', houseNumber: '12 a',
      zip: '24103', city: 'Kiel', email: 'zentrale@example.com', phone: '0431123456',
      website: 'www.example.com',
    },
    legal: { ...EMPTY_TENANT_LEGAL, liabilityInsurer: 'Nordversicherung' },
    tax: { ...EMPTY_TENANT_TAX, taxNumber: '20/123/45678', taxOffice: 'Finanzamt Kiel' },
    register: { ...EMPTY_TENANT_REGISTER, registerCourt: 'Amtsgericht Kiel', registerNumber: 'HRB 123' },
    contact: {
      billingEmail: 'rechnung@example.com', supportEmail: 'support@example.com', supportPhone: '0431654321',
      contactPersons: [{
        id: 'contact-1', firstName: 'Mara', lastName: 'Beispiel', role: 'Buchhaltung',
        email: 'mara@example.com', phone: '0431222', isPrimary: true,
      }],
    },
    representatives: [{
      id: 'representative-1', salutation: 'Frau', firstName: 'Lena', lastName: 'Muster',
      position: 'Geschäftsführung', email: 'lena@example.com', phone: '0431333',
      isPrimary: true, sortOrder: 0,
    }],
    bankAccounts: [{
      id: 'bank-1', label: 'Geschäftskonto', accountHolder: 'Nordlicht Betreuung GmbH',
      bankName: 'Förde Testbank', iban: 'DE89 3704 0044 0532 0130 00', bic: 'COBADEFFXXX',
      isPrimary: true, sortOrder: 0,
    }],
    payment: { ...EMPTY_TENANT_PAYMENT, invoicePrefix: 'NORD', invoiceFooterText: 'Vielen Dank.' },
    branding: { ...EMPTY_TENANT_BRANDING, logoUrl: 'https://example.com/logo.png' },
    modules: { ...DEFAULT_TENANT_MODULES }, catalogSummary: 'Eine Leistung',
    catalogItems: [catalogItem()],
    customFields: [{
      id: 'field-1', groupId: null, fieldKey: 'kundennummer', label: 'Kundennummer',
      dataType: 'text', moduleKey: 'assist', functionKey: 'documents',
      visibility: { office: true }, validation: { required: false }, isActive: true, sortOrder: 0,
    }],
    auditLogs: [{
      id: 'audit-1', action: 'UPDATE', title: 'Unternehmensdaten geändert', description: null,
      tableName: 'tenants', createdAt: '2026-10-15T10:30:00Z',
    }],
    sections: [], assistDefaultHourlyRate: '38,00',
  };
}

describe('company workspace model', () => {
  it('uses the primary representative and trims identity, contact and address values', () => {
    const value = snapshot();
    value.company.name = '  Nordlicht Betreuung  ';
    value.company.street = ' Hafenstraße ';
    value.company.email = ' zentrale@example.com ';
    value.representatives.unshift({
      ...value.representatives[0], id: 'secondary', firstName: 'Andere', isPrimary: false,
    });
    value.representatives[1].firstName = ' Lena ';

    expect(companyIdentity(value)).toEqual({
      name: 'Nordlicht Betreuung', legalName: 'Nordlicht Betreuung GmbH',
      representative: 'Frau Lena Muster', address: 'Hafenstraße 12 a · 24103 Kiel · Deutschland',
      email: 'zentrale@example.com', phone: '0431123456', initials: 'NB',
    });
  });

  it('treats a legacy Vertreten-durch value as a representative instead of a company name', () => {
    const value = snapshot();
    value.company.name = '';
    value.company.legalName = '  VERTRETEN durch   Max Beispiel  ';
    value.representatives = [];
    expect(companyIdentity(value)).toMatchObject({
      name: 'Ihr Unternehmen', legalName: '', representative: 'Max Beispiel',
    });

    value.representatives = snapshot().representatives;
    expect(companyIdentity(value).representative).toBe('Frau Lena Muster');
  });

  it('falls back to legal name, first representative and support contacts when needed', () => {
    const value = snapshot();
    value.company.name = ' ';
    value.company.email = '';
    value.company.phone = ' ';
    value.representatives[0].isPrimary = false;
    expect(companyIdentity(value)).toMatchObject({
      name: 'Nordlicht Betreuung GmbH', legalName: '', representative: 'Frau Lena Muster',
      email: 'support@example.com', phone: '0431654321',
    });
    value.company.legalName = '';
    value.representatives = [];
    expect(companyIdentity(value)).toMatchObject({ name: 'Ihr Unternehmen', representative: '' });
    value.company = { ...EMPTY_TENANT_COMPANY };
    expect(companyIdentity(value).address).toBe('');
    expect(companySections(value, ['Office']).find(section => section.key === 'company')?.populated).toBe(false);
  });

  it('normalizes a bare website and preserves explicit HTTP(S) addresses', () => {
    expect(companyWebsite('  www.example.com/kontakt?q=team#adresse  '))
      .toBe('https://www.example.com/kontakt?q=team#adresse');
    expect(companyWebsite('https://example.com')).toBe('https://example.com/');
    expect(companyWebsite('http://example.com/team')).toBe('http://example.com/team');
  });

  it('rejects unsafe protocols, credentials, malformed websites and empty values', () => {
    for (const value of [
      '', ' ', 'javascript:alert(1)', 'data:text/html,test', 'file:///etc/passwd',
      'ftp://example.com', 'mailto:office@example.com', 'https://user:password@example.com',
      'https://user@example.com', 'https://', 'https://not a host.example',
    ]) {
      expect(companyWebsite(value), value).toBeNull();
    }
  });

  it('masks the middle of an IBAN regardless of spacing and handles absent values', () => {
    const masked = maskedCompanyIban(' DE89 3704\t0044 0532 0130 00 ');
    expect(masked).toBe('DE •••• •••• 3000');
    expect(masked).not.toContain('3704');
    expect(maskedCompanyIban('DE89370400440532013000')).toBe(masked);
    expect(maskedCompanyIban(' \t')).toBe('');
  });

  it('formats dates in Berlin time and distinguishes missing from invalid dates', () => {
    expect(companyDate('')).toBe('Datum nicht hinterlegt');
    expect(companyDate('not-a-date')).toBe('Datum nicht verfügbar');
    expect(companyDate('2026-01-01T23:30:00Z')).toBe('02.01.2026');
    expect(companyDate('2026-01-01T23:30:00Z', true)).toContain('00:30');
    expect(companyDate('2026-07-01T23:30:00Z', true)).toContain('02.07.2026');
    expect(companyDate('2026-07-01T23:30:00Z', true)).toContain('01:30');
  });

  it('finds sections by actual values, labels and descriptions without changing the input', () => {
    const value = snapshot();
    value.representatives.push({
      ...value.representatives[0], id: 'secondary', firstName: 'Jonas', lastName: 'Nebenrolle',
      position: 'Qualitätsleitung', isPrimary: false,
    });
    const sections = companySections(value, ['Office', 'Assist']);
    const before = structuredClone(sections);
    expect(filterCompanySections(sections, ' FÖRDE TESTBANK ').map(section => section.key)).toEqual(['bank']);
    expect(filterCompanySections(sections, 'HRB 123').map(section => section.key)).toEqual(['register']);
    expect(filterCompanySections(sections, 'Steuernummer').map(section => section.key)).toEqual(['tax']);
    expect(filterCompanySections(sections, 'CSV-Dateien').map(section => section.key)).toEqual(['dataManagement']);
    expect(filterCompanySections(sections, 'MARA@EXAMPLE.COM').map(section => section.key)).toEqual(['contact']);
    expect(filterCompanySections(sections, 'Jonas Nebenrolle').map(section => section.key)).toEqual(['representatives']);
    expect(filterCompanySections(sections, 'Qualitätsleitung').map(section => section.key)).toEqual(['representatives']);
    expect(filterCompanySections(sections, 'Kundennummer').map(section => section.key)).toEqual(['customFields']);
    expect(filterCompanySections(sections, 'unauffindbarer-begriff')).toEqual([]);
    expect(filterCompanySections(sections, '  ')).toEqual(sections);
    expect(sections).toEqual(before);
  });

  it('does not turn absent optional data into mandatory completion suggestions', () => {
    const value = snapshot();
    value.branding = { ...EMPTY_TENANT_BRANDING };
    value.legal = { ...EMPTY_TENANT_LEGAL };
    value.tax = { ...EMPTY_TENANT_TAX };
    value.register = { ...EMPTY_TENANT_REGISTER };
    value.representatives = [];
    value.bankAccounts = [];
    value.customFields = [];
    value.catalogItems = [];
    expect(companySuggestions(value)).toEqual([]);
    const sections = companySections(value, ['Office']);
    expect(sections.find(section => section.key === 'branding')).toMatchObject({ optional: true, populated: false });
    expect(sections.find(section => section.key === 'register')).toMatchObject({ optional: true, populated: false });
  });

  it('suggests missing identity and contact details plus unresolved primary selections', () => {
    const value = snapshot();
    value.company.name = ' ';
    value.company.houseNumber = '';
    value.company.email = '';
    value.company.phone = '';
    value.contact.supportEmail = '';
    value.contact.supportPhone = '';
    value.bankAccounts[0].isPrimary = false;
    value.representatives[0].isPrimary = false;
    value.representatives.push({ ...value.representatives[0], id: 'second-person', firstName: 'Max' });
    expect(companySuggestions(value).map(suggestion => suggestion.id).sort()).toEqual([
      'address', 'contact', 'name', 'primary-bank', 'primary-representative',
    ]);
    value.contact.supportPhone = '04319999';
    expect(companySuggestions(value).some(suggestion => suggestion.id === 'contact')).toBe(false);
  });

  it('counts zero as a configured price and only suggests missing prices on active positions', () => {
    const value = snapshot();
    value.catalogItems = [
      catalogItem({ id: 'free', defaultPriceNet: 0 }),
      catalogItem({ id: 'inactive', defaultPriceNet: null, isActive: false }),
    ];
    expect(companySuggestions(value).some(suggestion => suggestion.id === 'prices')).toBe(false);
    expect(companySections(value, ['Assist']).find(section => section.key === 'catalog')?.rows)
      .toEqual([['Aktive Positionen', '1'], ['Mit Preis', '1']]);
    value.catalogItems.push(catalogItem({ id: 'unpriced', defaultPriceNet: null }));
    expect(companySuggestions(value).filter(suggestion => suggestion.id === 'prices')).toHaveLength(1);
    expect(companySections(value, ['Assist']).find(section => section.key === 'catalog')?.rows)
      .toEqual([['Aktive Positionen', '2'], ['Mit Preis', '1']]);
  });

  it('excludes unreleased catalog modules from counts and missing-price suggestions', () => {
    const value = snapshot();
    value.catalogItems = [catalogItem({ defaultPriceNet: 0 })];
    for (const moduleKey of ['pflege', 'stationaer', 'beratung'] as const) {
      value.catalogItems.push(catalogItem({ id: moduleKey, moduleKey, defaultPriceNet: null, category: 'travel' }));
    }
    value.catalogItems.push(catalogItem({ id: 'inactive-assist', isActive: false, defaultPriceNet: null }));
    expect(activeCompanyCatalog(value).map(item => item.id)).toEqual(['service-standard']);
    expect(companySuggestions(value).some(suggestion => suggestion.id === 'prices')).toBe(false);
    const sections = companySections(value, ['Office', 'Assist']);
    expect(sections.find(section => section.key === 'catalog')?.rows)
      .toEqual([['Aktive Positionen', '1'], ['Mit Preis', '1']]);
    expect(sections.find(section => section.key === 'travelSurcharges')?.rows)
      .toEqual([['Fahrtkosten', '0 Positionen'], ['Zuschläge', '0 Positionen']]);
  });
});
