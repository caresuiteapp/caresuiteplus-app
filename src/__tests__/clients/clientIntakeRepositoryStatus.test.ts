import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';
import { SYSTEM_CATALOGS } from '@/lib/catalogs/systemCatalogs';
import { createClientFromIntake, updateClientFromIntake } from '@/lib/clients/repositories/clientIntakeRepository.supabase';

const h = vi.hoisted(() => ({ from: vi.fn(), update: vi.fn(), insert: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn(), maybeSingle: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ from: h.from }) }));
vi.mock('expo-crypto', () => ({ randomUUID: () => '11111111-1111-4111-8111-111111111111' }));

const tenantId = '22222222-2222-4222-8222-222222222222';
const clientId = '11111111-1111-4111-8111-111111111111';
const actorId = '33333333-3333-4333-8333-333333333333';
const statuses = [
  ['interessent', 'lead'], ['in_aufnahme', 'lead'], ['aktiv', 'active'],
  ['pausiert', 'paused'], ['warteliste', 'lead'], ['kurzzeitversorgung', 'active'],
  ['abgeschlossen', 'inactive'], ['verstorben', 'deceased'], ['archiviert', 'archived'], ['gesperrt', 'blocked'],
] as const;
const form = (status: string) => ({ ...structuredClone(EMPTY_CLIENT_INTAKE_FORM), firstName: 'Maria', lastName: 'Beispiel', status });

beforeEach(() => {
  vi.clearAllMocks();
  const chain = { update: h.update, insert: h.insert, eq: h.eq, select: h.select, single: h.single, maybeSingle: h.maybeSingle };
  h.from.mockReturnValue(chain); h.update.mockReturnValue(chain); h.insert.mockReturnValue(chain);
  h.eq.mockReturnValue(chain); h.select.mockReturnValue(chain);
  h.single.mockImplementation(async () => ({ data: { id: clientId, status: 'lead', ...h.update.mock.lastCall?.[0] }, error: null }));
});

describe('intake status persistence', () => {
  it.each(statuses)('maps catalogue status %s to %s without a workflow fallback', async (input, stored) => {
    expect((await updateClientFromIntake(tenantId, clientId, form(input), actorId, ['stammdaten'])).ok).toBe(true);
    expect(h.update.mock.calls[0][0].status).toBe(stored);
    expect(h.eq).toHaveBeenCalledWith('tenant_id', tenantId);
    expect(h.eq).toHaveBeenCalledWith('id', clientId);
  });

  it('covers every client status offered by the system catalogue', () => {
    expect(statuses.map(([key]) => key).sort()).toEqual(SYSTEM_CATALOGS.client_status.entries.map((entry) => entry.key).sort());
  });

  it.each(['entwurf', 'geplant'])('keeps legacy unfinished status %s as a lead', async (status) => {
    expect((await updateClientFromIntake(tenantId, clientId, form(status), actorId, ['stammdaten'])).ok).toBe(true);
    expect(h.update.mock.calls[0][0].status).toBe('lead');
  });

  it('allows an unfinished lead master-data edit without asking the database to activate it', async () => {
    h.single.mockImplementation(async () => {
      const patch = h.update.mock.calls[0][0];
      return patch.status === 'active'
        ? { data: null, error: { code: '42501', message: 'Aufnahmeabschluss fehlt' } }
        : { data: { id: clientId, ...patch }, error: null };
    });
    const result = await updateClientFromIntake(tenantId, clientId, form('in_aufnahme'), actorId, ['stammdaten']);
    expect(result.ok).toBe(true);
    expect(h.update.mock.calls[0][0]).toMatchObject({ first_name: 'Maria', last_name: 'Beispiel', status: 'lead' });
  });

  it.each(['', 'unknown_status', 'constructor', '__proto__'])('preserves the stored status for unknown value %s', async (status) => {
    expect((await updateClientFromIntake(tenantId, clientId, form(status), actorId, ['stammdaten'])).ok).toBe(true);
    expect(h.update.mock.calls[0][0]).not.toHaveProperty('status');
  });

  it('does not include a status when only contact data is edited', async () => {
    expect((await updateClientFromIntake(tenantId, clientId, { ...form('aktiv'), city: 'Berlin' }, actorId, ['adresse_kontakt'])).ok).toBe(true);
    expect(h.update.mock.calls[0][0]).toMatchObject({ city: 'Berlin' });
    expect(h.update.mock.calls[0][0]).not.toHaveProperty('status');
  });

  it('keeps a server activation guard rejection visible to the caller', async () => {
    h.single.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'Aufnahmeabschluss fehlt' } });
    expect((await updateClientFromIntake(tenantId, clientId, form('aktiv'), actorId, ['stammdaten'])).ok).toBe(false);
    expect(h.update).toHaveBeenCalledTimes(1);
  });

  it('does not report success when the returned status differs from the requested mapping', async () => {
    h.single.mockImplementationOnce(async () => ({ data: { id: clientId, ...h.update.mock.calls[0][0], status: 'active' }, error: null }));
    const result = await updateClientFromIntake(tenantId, clientId, form('pausiert'), actorId, ['stammdaten']);
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toContain('status');
  });

  it('creates a lead even when the form requests an active status', async () => {
    h.single.mockResolvedValueOnce({ data: { id: clientId }, error: null });
    expect((await createClientFromIntake(tenantId, form('aktiv'), actorId)).ok).toBe(true);
    expect(h.insert.mock.calls[0][0]).toMatchObject({ id: clientId, tenant_id: tenantId, status: 'lead' });
  });
});
