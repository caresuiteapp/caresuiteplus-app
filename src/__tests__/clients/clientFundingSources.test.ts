import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CLIENT_FUNDING_SOURCE_KEYS,
  fundingSourceForCatalogKey,
  isCatalogKeySelected,
  normalizeClientFundingSources,
} from '@/types/clients/clientFundingSource';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';
import { validateIntakeStep } from '@/lib/clients/clientIntakeService';

describe('verbindliche Klienten-Finanzierungsarten', () => {
  it('kennt genau die vier unabhängig kombinierbaren Finanzierungsarten', () => {
    expect(CLIENT_FUNDING_SOURCE_KEYS).toEqual([
      'entlastungsleistung',
      'umwandlung',
      'verhinderungspflege',
      'selbstzahler',
    ]);
    expect(normalizeClientFundingSources([
      'selbstzahler',
      'entlastungsleistung',
      'selbstzahler',
      'ungueltig',
    ])).toEqual(['entlastungsleistung', 'selbstzahler']);
  });

  it('ordnet Budgetkataloge eindeutig der Klientenauswahl zu', () => {
    expect(fundingSourceForCatalogKey('paragraph_45b')).toBe('entlastungsleistung');
    expect(fundingSourceForCatalogKey('umwandlung_pg3')).toBe('umwandlung');
    expect(fundingSourceForCatalogKey('verhinderungspflege')).toBe('verhinderungspflege');
    expect(fundingSourceForCatalogKey('selbstzahler')).toBe('selbstzahler');
    expect(isCatalogKeySelected('umwandlung_pg3', ['entlastungsleistung'])).toBe(false);
    expect(isCatalogKeySelected('umwandlung_pg3', ['umwandlung'])).toBe(true);
  });

  it('blockiert Aufnahme und Profiländerung ohne Auswahl', () => {
    const errors = validateIntakeStep('kostentraeger', {
      ...EMPTY_CLIENT_INTAKE_FORM,
      careContexts: ['daily_assistance'],
      billingTypes: ['pflegekasse'],
      careLevel: 'pg2',
    });
    expect(errors.fundingSources).toContain('Mindestens eine Finanzierungsart');
  });

  it('bindet dieselbe Auswahl an Aufnahme, Profil, Budgets und Migration an', () => {
    const intake = readFileSync('src/components/office/clientintakewizardform.tsx', 'utf8');
    const profile = readFileSync('src/components/office/ClientCareGradeBudgetsPanel.tsx', 'utf8');
    const persistence = readFileSync('src/lib/clients/clientIntakePersistence.ts', 'utf8');
    const budgetProfile = readFileSync('src/lib/assist/clientAssistBillingProfileService.ts', 'utf8');
    const migration = readFileSync('supabase/migrations/0271_client_funding_selections.sql', 'utf8');

    expect(intake).toContain('ClientFundingSourceSelector');
    expect(profile).toContain('Finanzierungsarten speichern');
    expect(persistence).toContain('setClientFundingSources');
    expect(budgetProfile).toContain('isCatalogKeySelected');
    expect(migration).toContain('set_client_funding_sources');
    expect(migration).toContain('Finanzierungsart nicht ausgewählt');
  });
});
