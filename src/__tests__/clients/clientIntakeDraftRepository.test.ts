import { beforeEach, describe, expect, it, vi } from 'vitest';
import { upsertClientIntakeDraft } from '@/lib/clients/repositories/clientIntakeDraftRepository.supabase';
import { createEmptyIntakeForm } from '@/lib/clients/clientIntakeService';

const mockFrom = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();

function createQueryChain() {
  const chain = {
    update: mockUpdate.mockReturnThis(),
    insert: mockInsert.mockReturnThis(),
    eq: mockEq.mockReturnThis(),
    select: mockSelect.mockReturnThis(),
    maybeSingle: mockMaybeSingle,
    single: mockSingle,
  };
  return chain;
}

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: mockFrom,
  }),
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => '44444444-4444-4444-8444-444444444444' }));

describe('upsertClientIntakeDraft', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFrom.mockImplementation(() => createQueryChain());
  });

  it('legt bei fehlendem Datensatz einen Lead mit derselben Entwurfs-ID an', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockSingle.mockResolvedValueOnce({ data: { id: '11111111-1111-4111-8111-111111111111' }, error: null });

    const form = {
      ...createEmptyIntakeForm(),
      firstName: 'Test',
      lastName: 'Entwurf',
    };

    const result = await upsertClientIntakeDraft('tenant-a', form, {
      clientId: '11111111-1111-4111-8111-111111111111',
      actorProfileId: 'profile-1',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe('11111111-1111-4111-8111-111111111111');
    }
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ id: '11111111-1111-4111-8111-111111111111', status: 'lead' }));
  });

  it('aktualisiert bestehenden Lead bei gültiger clientId', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: '22222222-2222-4222-8222-222222222222', status: 'lead' }, error: null });
    mockSingle.mockResolvedValueOnce({ data: { id: '22222222-2222-4222-8222-222222222222' }, error: null });

    const form = {
      ...createEmptyIntakeForm(),
      firstName: 'Draft',
      lastName: 'Client',
    };

    const result = await upsertClientIntakeDraft('tenant-a', form, {
      clientId: '22222222-2222-4222-8222-222222222222',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe('22222222-2222-4222-8222-222222222222');
    }
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith('status', 'lead');
  });

  it('überspringt bei ungültiger lokaler ID den UUID-Filter und legt sicher neu an', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockSingle.mockResolvedValueOnce({ data: { id: '44444444-4444-4444-8444-444444444444' }, error: null });

    const result = await upsertClientIntakeDraft(
      '33333333-3333-4333-8333-333333333333',
      { ...createEmptyIntakeForm(), firstName: 'Sicher', lastName: 'Entwurf' },
      { clientId: 'keine-uuid' },
    );

    expect(result).toEqual({ ok: true, data: { id: '44444444-4444-4444-8444-444444444444' } });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockEq).not.toHaveBeenCalledWith('id', 'keine-uuid');
    expect(mockInsert).toHaveBeenCalled();
  });
  it('legt für einen bereits aktivierten Entwurf keinen zweiten Lead an', async () => {
    const clientId = '11111111-1111-4111-8111-111111111111';
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: clientId, status: 'active' }, error: null });
    expect(await upsertClientIntakeDraft('tenant-a', createEmptyIntakeForm(), { clientId })).toMatchObject({ ok: false, recoverableClientId: clientId });
    expect(mockInsert).not.toHaveBeenCalled(); expect(mockUpdate).not.toHaveBeenCalled();
  });
  it('behält nach einem verlorenen Insert-Ergebnis die ID und aktualisiert beim Retry denselben Lead', async () => {
    const clientId = '11111111-1111-4111-8111-111111111111'; const form = { ...createEmptyIntakeForm(), firstName: 'Erhalten' };
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null }); mockSingle.mockRejectedValueOnce(new Error('response lost'));
    const first = await upsertClientIntakeDraft('tenant-a', form, { clientId }); expect(first).toMatchObject({ ok: false, recoverableClientId: clientId });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: clientId, status: 'lead' }, error: null }); mockSingle.mockResolvedValueOnce({ data: { id: clientId }, error: null });
    expect(await upsertClientIntakeDraft('tenant-a', form, { clientId: first.recoverableClientId })).toEqual({ ok: true, data: { id: clientId } });
    expect(mockInsert).toHaveBeenCalledTimes(1); expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockEq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
  });
});
