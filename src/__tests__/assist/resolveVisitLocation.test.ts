import { describe, expect, it } from 'vitest';
import { resolveVisitLocation } from '@/lib/assist/resolveVisitLocation';

describe('resolveVisitLocation', () => {
  it('prefers address snapshot over client address', () => {
    expect(
      resolveVisitLocation({
        addressSnapshot: 'Einsatzort A',
        client: { street: 'Hauptstraße', house_number: '1', postal_code: '44623', city: 'Herne' },
      }),
    ).toBe('Einsatzort A');
  });

  it('falls back to client address when snapshot is empty', () => {
    expect(
      resolveVisitLocation({
        addressSnapshot: '',
        client: {
          street: 'Hauptstraße',
          house_number: '12',
          postal_code: '44623',
          city: 'Herne',
        },
      }),
    ).toBe('Hauptstraße 12, 44623 Herne');
  });

  it('uses location notes before client address', () => {
    expect(
      resolveVisitLocation({
        locationNotes: 'Pflegewohnung 2. OG',
        client: { street: 'Nebenstraße', postal_code: '12345', city: 'Berlin' },
      }),
    ).toBe('Pflegewohnung 2. OG');
  });

  it('returns em dash when no location source exists', () => {
    expect(resolveVisitLocation({})).toBe('—');
  });
});
