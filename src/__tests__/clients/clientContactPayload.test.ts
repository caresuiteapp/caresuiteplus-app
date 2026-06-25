import { describe, expect, it } from 'vitest';
import {
  buildClientContactWritePayload,
  resolveClientContactDisplayName,
  resolveClientContactIsEmergency,
  resolveClientContactType,
} from '@/lib/clients/clientContactPayload';

describe('clientContactPayload', () => {
  it('mappt Live-Spalten für Notfallkontakt', () => {
    expect(
      buildClientContactWritePayload({
        tenantId: 'tenant-1',
        clientId: 'client-1',
        name: 'Maria Reinhardt',
        phone: '0170123456',
        relationship: 'notfallkontakt',
        contactType: 'emergency_contact',
      }),
    ).toEqual({
      tenant_id: 'tenant-1',
      client_id: 'client-1',
      first_name: 'Maria',
      last_name: 'Reinhardt',
      relationship: 'notfallkontakt',
      phone: '0170123456',
      email: null,
      is_emergency_contact: true,
      contact_type: 'emergency_contact',
    });
    expect(
      buildClientContactWritePayload({
        tenantId: 'tenant-1',
        clientId: 'client-1',
        name: 'Maria Reinhardt',
        phone: '0170123456',
        relationship: 'notfallkontakt',
        contactType: 'emergency' as import('@/types/modules/client').ClientContactType,
      }),
    ).not.toHaveProperty('full_name');
  });

  it('liest full_name und is_emergency_contact aus Live-Zeilen', () => {
    expect(
      resolveClientContactDisplayName({
        full_name: 'Heinz-Peter Reinhardt',
        first_name: 'Heinz-Peter',
        last_name: 'Reinhardt',
      }),
    ).toBe('Heinz-Peter Reinhardt');
    expect(
      resolveClientContactIsEmergency({
        is_emergency_contact: true,
        contact_type: 'emergency_contact',
      }),
    ).toBe(true);
  });

  it('leitet contact_type aus Legacy-Zeilen ab', () => {
    expect(resolveClientContactType({ contact_type: 'care_service' })).toBe('care_service');
    expect(resolveClientContactType({ relationship: 'arzt' })).toBe('doctor');
    expect(resolveClientContactType({ is_emergency_contact: true })).toBe('emergency_contact');
  });
});
