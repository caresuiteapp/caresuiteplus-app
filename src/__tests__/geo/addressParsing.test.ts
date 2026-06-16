import { describe, expect, it } from 'vitest';
import {
  dedupeAddressSuggestions,
  formatAddressSuggestionLabel,
  parseGoogleAddressComponents,
  parsePhotonFeature,
  splitStreetAndHouseNumber,
} from '@/lib/geo/addressParsing';

describe('splitStreetAndHouseNumber', () => {
  it('trennt Straße und Hausnummer', () => {
    expect(splitStreetAndHouseNumber('Musterstraße 12')).toEqual({
      street: 'Musterstraße',
      houseNumber: '12',
    });
  });

  it('erkennt Buchstaben-Zusatz in der Hausnummer', () => {
    expect(splitStreetAndHouseNumber('Hauptstr. 12a')).toEqual({
      street: 'Hauptstr.',
      houseNumber: '12a',
    });
  });

  it('lässt reine Straßennamen unverändert', () => {
    expect(splitStreetAndHouseNumber('Berliner Allee')).toEqual({
      street: 'Berliner Allee',
      houseNumber: '',
    });
  });
});

describe('parsePhotonFeature', () => {
  it('mappt vollständige Hausadresse', () => {
    const result = parsePhotonFeature({
      type: 'Feature',
      properties: {
        osm_id: 123,
        osm_type: 'W',
        street: 'Musterstraße',
        housenumber: '7',
        postcode: '10115',
        city: 'Berlin',
        countrycode: 'DE',
        type: 'house',
      },
    });

    expect(result).toEqual({
      id: 'photon-W-123-0',
      label: 'Musterstraße 7, 10115 Berlin',
      street: 'Musterstraße',
      houseNumber: '7',
      zip: '10115',
      city: 'Berlin',
    });
  });

  it('nutzt locality als Ort-Fallback', () => {
    const result = parsePhotonFeature({
      type: 'Feature',
      properties: {
        osm_id: 456,
        street: 'Dorfstraße',
        housenumber: '1',
        postcode: '82467',
        locality: 'Garmisch-Partenkirchen',
        countrycode: 'DE',
      },
    });

    expect(result?.city).toBe('Garmisch-Partenkirchen');
    expect(result?.street).toBe('Dorfstraße');
  });

  it('splittet kombinierten Straßennamen mit Hausnummer', () => {
    const result = parsePhotonFeature({
      type: 'Feature',
      properties: {
        osm_id: 789,
        name: 'Goethestraße 22',
        postcode: '60313',
        city: 'Frankfurt am Main',
        countrycode: 'DE',
      },
    });

    expect(result?.street).toBe('Goethestraße');
    expect(result?.houseNumber).toBe('22');
  });

  it('filtert Nicht-DE-Adressen', () => {
    const result = parsePhotonFeature({
      type: 'Feature',
      properties: {
        street: 'Rue de Paris',
        postcode: '75001',
        city: 'Paris',
        countrycode: 'FR',
      },
    });

    expect(result).toBeNull();
  });
});

describe('parseGoogleAddressComponents', () => {
  it('mappt Google-Komponenten auf deutsche Felder', () => {
    const fields = parseGoogleAddressComponents([
      { long_name: '7', short_name: '7', types: ['street_number'] },
      { long_name: 'Musterstraße', short_name: 'Musterstraße', types: ['route'] },
      { long_name: '10115', short_name: '10115', types: ['postal_code'] },
      { long_name: 'Berlin', short_name: 'Berlin', types: ['locality'] },
    ]);

    expect(fields).toEqual({
      street: 'Musterstraße',
      houseNumber: '7',
      zip: '10115',
      city: 'Berlin',
    });
  });
});

describe('formatAddressSuggestionLabel', () => {
  it('formatiert lesbare Vorschlagszeile', () => {
    expect(
      formatAddressSuggestionLabel({
        street: 'Musterstraße',
        houseNumber: '7',
        zip: '10115',
        city: 'Berlin',
      }),
    ).toBe('Musterstraße 7, 10115 Berlin');
  });
});

describe('dedupeAddressSuggestions', () => {
  it('entfernt doppelte Vorschläge', () => {
    const unique = dedupeAddressSuggestions([
      {
        id: 'a',
        label: 'Musterstraße 7, 10115 Berlin',
        street: 'Musterstraße',
        houseNumber: '7',
        zip: '10115',
        city: 'Berlin',
      },
      {
        id: 'b',
        label: 'Musterstraße 7, 10115 Berlin',
        street: 'Musterstraße',
        houseNumber: '7',
        zip: '10115',
        city: 'Berlin',
      },
    ]);

    expect(unique).toHaveLength(1);
  });
});
