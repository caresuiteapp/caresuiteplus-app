import { describe, expect, it } from 'vitest';
import { findContactByType, listOtherContacts } from '@/lib/clients/clientContactGroups';
import type { ClientContactRecord } from '@/types/modules/client';

function contact(
  id: string,
  contactType: ClientContactRecord['contactType'],
): ClientContactRecord {
  return {
    id,
    tenantId: 't1',
    clientId: 'c1',
    firstName: 'Test',
    lastName: id,
    contactType,
    relationship: 'sonstige',
    relationshipLabel: null,
    phone: null,
    email: null,
    isEmergency: contactType === 'emergency_contact',
    isPortalUser: false,
    portalPermissions: {
      canViewAppointments: false,
      canViewDocuments: false,
      canViewCarePlan: false,
      canSendMessages: false,
      canViewBilling: false,
    },
    notes: null,
    createdAt: '',
    updatedAt: '',
  };
}

describe('clientContactGroups', () => {
  it('findet feste Kontakttypen', () => {
    const contacts = [
      contact('e1', 'emergency_contact'),
      contact('r1', 'relative'),
      contact('d1', 'doctor'),
    ];
    expect(findContactByType(contacts, 'emergency_contact')?.id).toBe('e1');
    expect(findContactByType(contacts, 'doctor')?.id).toBe('d1');
    expect(findContactByType(contacts, 'care_service')).toBeNull();
  });

  it('listet nur sonstige Kontakte', () => {
    const contacts = [
      contact('e1', 'emergency_contact'),
      contact('o1', 'other'),
      contact('o2', 'other'),
    ];
    expect(listOtherContacts(contacts).map((c) => c.id)).toEqual(['o1', 'o2']);
  });
});
