import { describe, expect, it } from 'vitest';
import { fetchClientFullDetail } from '@/lib/clients';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';

describe('ClientFullDetail', () => {
  it('lädt vollständige Akte für Helga Schneider', async () => {
    const result = await fetchClientFullDetail(DEMO_TENANT_ID, 'client-001');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.firstName).toBe('Helga');
    expect(result.data.addresses.length).toBeGreaterThan(0);
    expect(result.data.contacts.length).toBeGreaterThan(0);
    expect(result.data.budgets.length).toBeGreaterThan(0);
    expect(result.data.billingProfile).not.toBeNull();
    expect(result.data.contracts.length).toBeGreaterThan(0);
    expect(result.data.tasks.length).toBeGreaterThan(0);
    expect(result.data.consents.length).toBeGreaterThan(0);
    expect(result.data.internalNotes.length).toBeGreaterThan(0);
    expect(result.data.core.insuranceNumber).toBeTruthy();
  });

  it('lädt vollständige Akte für Werner Müller', async () => {
    const result = await fetchClientFullDetail(DEMO_TENANT_ID, 'client-002');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.risks.length).toBeGreaterThanOrEqual(3);
    expect(result.data.emergencyPlan).not.toBeNull();
    expect(result.data.portalAccess.length).toBeGreaterThan(0);
  });

  it('maskiert sensible Felder ohne Berechtigung', async () => {
    const result = await fetchClientFullDetail(DEMO_TENANT_ID, 'client-001', {
      canViewSensitive: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.core.insuranceNumber).toBe('•••••••••');
    expect(result.data.core.diagnoses).toEqual(['Geschützt']);
  });

  it('liefert Minimal-Fallback für Clients ohne Full-Detail', async () => {
    const result = await fetchClientFullDetail(DEMO_TENANT_ID, 'client-003');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.firstName).toBe('Maria');
    expect(result.data.core).toBeDefined();
  });
});
