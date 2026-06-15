import { describe, expect, it } from 'vitest';
import {
  createClientContact,
  deleteClientContact,
  fetchClientContacts,
  updateClientContact,
} from '@/lib/clients';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';

describe('ClientContacts', () => {
  it('lädt Kontakte für Demo-Klient:in', async () => {
    const result = await fetchClientContacts(DEMO_TENANT_ID, 'client-001');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(result.data[0].portalPermissions).toBeDefined();
  });

  it('erstellt und aktualisiert Kontakt', async () => {
    const created = await createClientContact(DEMO_TENANT_ID, 'client-001', {
      firstName: 'Test',
      lastName: 'Kontakt',
      relationship: 'nachbar',
      relationshipLabel: 'Nachbar',
      phone: '+49 170 0000000',
      email: 'test@demo.app',
      isEmergency: false,
      isPortalUser: false,
      portalPermissions: {
        canViewAppointments: false,
        canViewDocuments: false,
        canViewCarePlan: false,
        canSendMessages: false,
        canViewBilling: false,
      },
      notes: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = await updateClientContact(DEMO_TENANT_ID, 'client-001', created.data.id, {
      isEmergency: true,
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.data.isEmergency).toBe(true);

    const deleted = await deleteClientContact(DEMO_TENANT_ID, 'client-001', created.data.id);
    expect(deleted.ok).toBe(true);
  });
});
