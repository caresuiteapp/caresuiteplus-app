import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';
const state = vi.hoisted(() => ({ failTable: '', writes: [] as string[], map: vi.fn(), funding: vi.fn() }));
vi.mock('@/lib/clients/clientBackend', () => ({ isDemoClientBackend: () => false }));
vi.mock('@/lib/clients/clientEditService', () => ({ fetchClientEditData: async () => ({ ok: true, data: { detail: { id: 'client' } } }) }));
vi.mock('@/lib/clients/clientIntakeFormMappers', () => ({ mapClientEditLoadToIntakeForm: state.map }));
vi.mock('@/lib/clients/clientFundingSourceService', () => ({ getClientFundingSelection: state.funding, setClientFundingSources: async () => ({ ok: true }) }));
vi.mock('@/lib/assist/clientCareEntitlementSyncService', () => ({ syncClientCareEntitlementFromLegacy: async () => ({ ok: true }) }));
vi.mock('@/features/intakeDocuments/intakeDocumentRepository', () => ({ loadPersistedIntakeDocumentsForClient: async () => ({ ok: true, data: [] }) }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ from: (table: string) => {
  const result = () => ({ data: table === 'clients' ? { admission_date: '2026-01-01' } : null, error: state.failTable === table ? { code: '42501', message: 'not allowed' } : null });
  const chain: any = { select: () => chain, eq: () => chain, in: () => chain, order: () => chain, limit: () => chain, contains: () => chain,
    insert: () => { state.writes.push(table); return chain; }, update: () => { state.writes.push(table); return chain; }, delete: () => { state.writes.push(table); return chain; },
    maybeSingle: async () => result(), single: async () => result(), then: (resolve: (r: unknown) => unknown) => Promise.resolve(result()).then(resolve) };
  return chain;
} }) }));
import { fetchClientIntakeEditData } from '@/lib/clients/clientIntakeEditService';
import { syncIntakeClientExtendedData } from '@/lib/clients/clientIntakePersistence';

const form = { ...EMPTY_CLIENT_INTAKE_FORM, street: 'Hauptstraße', houseNumber: '2', zip: '10115', city: 'Berlin', careLevel: '3', emergencyContactName: 'Kontakt', facilityName: 'Haus' };
beforeEach(() => { state.failTable = ''; state.writes = []; state.map.mockReset(); state.funding.mockResolvedValue({ ok: true, data: { sources: [] } }); });
describe('intake snapshots cannot turn failed reads into destructive empty values', () => {
  it.each(['clients','client_support_preferences','client_ambulatory_details','client_stationary_details','client_insurance_profiles'])('rejects a failed %s snapshot before exposing an edit form', async (table) => {
    state.failTable = table;
    expect((await fetchClientIntakeEditData('client','tenant')).ok).toBe(false);
    expect(state.map).not.toHaveBeenCalled();
    expect(state.writes).toEqual([]);
  });
  it('propagates failed funding reads rather than replacing the choice with []', async () => {
    state.funding.mockResolvedValue({ ok: false, error: 'Funding unavailable' });
    expect(await fetchClientIntakeEditData('client','tenant')).toEqual({ ok: false, error: 'Funding unavailable' });
    expect(state.map).not.toHaveBeenCalled();
  });
  it.each([
    ['client_addresses', 'adresse_kontakt'], ['client_care_levels', 'kostentraeger'],
    ['client_billing_profiles', 'leistungsart'], ['client_insurance_profiles', 'kostentraeger'],
    ['client_contacts', 'angehoerige'], ['client_ambulatory_details', 'notfall_zugang'], ['client_stationary_details', 'versorgung'],
  ] as const)('does not write a duplicate or replacement after %s lookup failed', async (table, section) => {
    state.failTable = table;
    expect((await syncIntakeClientExtendedData('tenant','client',form,null,{ sections: [section] })).ok).toBe(false);
    expect(state.writes).not.toContain(table);
  });
});
