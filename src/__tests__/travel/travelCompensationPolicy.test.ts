import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TRAVEL_COMPENSATION_POLICY,
  createTravelPolicyFromPreset,
  evaluateTravelCompensation,
  normalizeTravelCompensationPolicy,
} from '@/lib/travel/travelCompensationPolicy';

describe('Fahrtkosten- und Kilometerregeln', () => {
  it('zahlt ohne ausdrückliche Einrichtung keine Kilometer automatisch aus', () => {
    expect(DEFAULT_TRAVEL_COMPENSATION_POLICY.logbookRouteTypes).toContain('client_to_client');
    expect(DEFAULT_TRAVEL_COMPENSATION_POLICY.payrollRouteTypes).toEqual([]);
  });

  it('vergütet bei Büro-bis-Büro nur die vorgesehenen dienstlichen Strecken', () => {
    const policy = createTravelPolicyFromPreset('office_roundtrip');
    expect(evaluateTravelCompensation({ routeType: 'office_to_client', distanceKm: 10, mileageRateCents: 30, policy }))
      .toMatchObject({ logbookEligible: true, payrollEligible: true, mileageAmountCents: 300 });
    expect(evaluateTravelCompensation({ routeType: 'home_to_office', distanceKm: 10, mileageRateCents: 30, policy }))
      .toMatchObject({ payrollEligible: false, mileageAmountCents: 0 });
  });

  it('unterstützt die Sonderregel zu und mit Klient:innen', () => {
    const policy = createTravelPolicyFromPreset('to_and_with_clients');
    expect(policy.payrollRouteTypes).toEqual(expect.arrayContaining([
      'home_to_client', 'office_to_client', 'client_to_client', 'with_client',
    ]));
    expect(policy.payrollRouteTypes).not.toContain('client_to_home');
    expect(policy.payrollRouteTypes).not.toContain('office_to_home');
  });

  it('kann Fahrtenbuch, Vergütung, Arbeitszeit und Klientenabrechnung getrennt schalten', () => {
    const policy = normalizeTravelCompensationPolicy({
      preset: 'custom',
      logbookRouteTypes: ['home_to_client'],
      payrollRouteTypes: [],
      workTimeRouteTypes: ['home_to_client'],
      clientBillingRouteTypes: [],
    });
    expect(evaluateTravelCompensation({ routeType: 'home_to_client', distanceKm: 8.5, mileageRateCents: 35, policy }))
      .toEqual({
        logbookEligible: true,
        payrollEligible: false,
        workTimeEligible: true,
        clientBillingEligible: false,
        mileageAmountCents: 0,
      });
  });

  it('vergütet private Fahrten in keiner Standardvorlage', () => {
    for (const preset of ['all_business', 'office_roundtrip', 'home_roundtrip', 'between_clients_only', 'with_client_only', 'to_and_with_clients'] as const) {
      const policy = createTravelPolicyFromPreset(preset);
      expect(evaluateTravelCompensation({ routeType: 'private_non_business', distanceKm: 100, mileageRateCents: 30, policy }).mileageAmountCents).toBe(0);
    }
  });
});
