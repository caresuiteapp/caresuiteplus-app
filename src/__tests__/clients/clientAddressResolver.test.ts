import { describe, expect, it } from 'vitest';
import {
  buildFallbackPrimaryAddress,
  formatClientAddressLine,
  mergeClientAddresses,
  resolveClientPhone,
  resolveClientStreetLine,
} from '@/lib/clients/clientAddressResolver';
import { mapClientFullDetail } from '@/lib/supabase/mappers/clientExtendedMapper';

describe('clientAddressResolver', () => {
  it('combines street and house number', () => {
    expect(
      resolveClientStreetLine({
        id: 'c1',
        tenant_id: 't1',
        street: 'Hauptstraße',
        house_number: '12',
      }),
    ).toBe('Hauptstraße 12');
  });

  it('prefers phone then mobile then primary contact', () => {
    expect(resolveClientPhone({ phone: '111', mobile: '222', primary_contact_phone: '333' })).toBe('111');
    expect(resolveClientPhone({ mobile: '222', primary_contact_phone: '333' })).toBe('222');
    expect(resolveClientPhone({ primary_contact_phone: '333' })).toBe('333');
  });

  it('builds fallback address from clients row', () => {
    const address = buildFallbackPrimaryAddress({
      id: 'c1',
      tenant_id: 't1',
      street: 'Hauptstraße',
      house_number: '1',
      postal_code: '44623',
      city: 'Herne',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-06-01T00:00:00Z',
    });

    expect(address?.street).toBe('Hauptstraße 1');
    expect(address?.zip).toBe('44623');
    expect(address?.city).toBe('Herne');
    expect(address?.isPrimary).toBe(true);
  });

  it('mergeClientAddresses uses fallback when client_addresses is empty', () => {
    const merged = mergeClientAddresses([], {
      id: 'c1',
      tenant_id: 't1',
      street: 'Parkweg',
      postal_code: '10115',
      city: 'Berlin',
    });

    expect(merged).toHaveLength(1);
    expect(merged[0]?.street).toBe('Parkweg');
  });

  it('formatClientAddressLine joins street and city parts', () => {
    expect(formatClientAddressLine('Hauptstraße 1', '44623', 'Herne')).toBe('Hauptstraße 1, 44623 Herne');
  });
});

describe('mapClientFullDetail address fallback', () => {
  it('fills addresses from clients row when client_addresses is empty', () => {
    const detail = mapClientFullDetail({
      client: {
        id: 'c1',
        tenant_id: 't1',
        first_name: 'Heinz-Peter',
        last_name: 'Reinhardt',
        date_of_birth: '1945-03-12',
        lifecycle_status: 'aktiv',
        status: 'aktiv',
        care_level: '3',
        primary_contact_phone: null,
        city: 'Herne',
        zip: null,
        postal_code: '44623',
        street: 'Hauptstraße',
        house_number: '5',
        phone: '02323 12345',
        mobile: null,
        email: 'heinz@example.de',
        sensitivity: 'standard',
        visibility: 'team',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-06-01T00:00:00Z',
      },
      contacts: [],
      consents: [],
      audit: [],
      history: [],
      addresses: [],
      careLevels: [],
      budgets: [],
      billingProfiles: [],
      contracts: [],
      documents: [],
      notes: [],
      risks: [],
      portalAccess: [],
      tasks: [],
      timeline: [],
    });

    expect(detail.addresses).toHaveLength(1);
    expect(detail.addresses[0]?.street).toBe('Hauptstraße 5');
    expect(detail.addresses[0]?.city).toBe('Herne');
    expect(detail.phone).toBe('02323 12345');
    expect(detail.street).toBe('Hauptstraße 5');
  });
});
