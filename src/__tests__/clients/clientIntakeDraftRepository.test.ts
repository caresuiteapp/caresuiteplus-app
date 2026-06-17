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

describe('upsertClientIntakeDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => createQueryChain());
  });

  it('legt neuen Lead an wenn Update auf stale clientId scheitert', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockSingle.mockResolvedValueOnce({ data: { id: 'new-lead-id' }, error: null });

    const form = {
      ...createEmptyIntakeForm(),
      firstName: 'Test',
      lastName: 'Entwurf',
    };

    const result = await upsertClientIntakeDraft('tenant-a', form, {
      clientId: 'stale-active-client',
      actorProfileId: 'profile-1',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe('new-lead-id');
    }
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalled();
  });

  it('aktualisiert bestehenden Lead bei gültiger clientId', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'lead-1' }, error: null });

    const form = {
      ...createEmptyIntakeForm(),
      firstName: 'Draft',
      lastName: 'Client',
    };

    const result = await upsertClientIntakeDraft('tenant-a', form, {
      clientId: 'lead-1',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe('lead-1');
    }
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
