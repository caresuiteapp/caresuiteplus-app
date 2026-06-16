import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const srcRoot = path.join(__dirname, '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(srcRoot, relativePath), 'utf8');
}

describe('Client intake step 3 — Adresse & Kontakt', () => {
  it('Wizard nutzt Adresssuche mit editierbaren Einzelfeldern', () => {
    const screen = readSrc('screens/business/office/ClientIntakeWizardScreen.tsx');
    expect(screen).toContain('CareAddressSearch');
    expect(screen).toContain("updateField('street', address.street)");
    expect(screen).toContain("updateField('houseNumber', address.houseNumber)");
    expect(screen).toContain("updateField('zip', address.zip)");
    expect(screen).toContain("updateField('city', address.city)");
  });

  it('Adresssuche nutzt Photon-Geocoder-Service', () => {
    const service = readSrc('lib/geo/addressAutocompleteService.ts');
    expect(service).toContain('photon.komoot.io');
    expect(service).toContain('EXPO_PUBLIC_GOOGLE_PLACES_API_KEY');
  });

  it('CareAddressSearch debounced Suche und deutsche Statusmeldungen', () => {
    const component = readSrc('components/inputs/CareAddressSearch.tsx');
    expect(component).toContain('searchGermanAddresses');
    expect(component).toContain('Suche …');
    expect(component).toContain('Keine Treffer');
  });
});
