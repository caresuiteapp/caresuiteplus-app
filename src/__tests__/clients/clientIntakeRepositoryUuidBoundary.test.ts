import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyIntakeForm } from '@/lib/clients/clientIntakeService';
import { createClientFromIntake } from '@/lib/clients/repositories/clientIntakeRepository.supabase';

const mockFrom = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();

function createQueryChain() {
  return {
    update: mockUpdate.mockReturnThis(),
    insert: mockInsert.mockReturnThis(),
    eq: mockEq.mockReturnThis(),
    in: mockIn.mockReturnThis(),
    select: mockSelect.mockReturnThis(),
    single: mockSingle,
  };
}

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}));

describe('createClientFromIntake UUID boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => createQueryChain());
  });

  it('legt bei alter Demo-ID neu an, ohne einen UUID-Filter aufzurufen', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: '99c34302-47b8-4f7c-9199-28240c9c1937' },
      error: null,
    });

    const result = await createClientFromIntake(
      '33333333-3333-4333-8333-333333333333',
      { ...createEmptyIntakeForm(), firstName: 'Sicher', lastName: 'Angelegt' },
      null,
      'client-intake-172324',
    );

    expect(result.ok).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockEq).not.toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalled();
  });

  it('aktualisiert einen Entwurf mit gültiger UUID', async () => {
    const draftClientId = '11111111-1111-4111-8111-111111111111';
    mockSingle.mockResolvedValueOnce({ data: { id: draftClientId }, error: null });

    const result = await createClientFromIntake(
      '33333333-3333-4333-8333-333333333333',
      { ...createEmptyIntakeForm(), firstName: 'Server', lastName: 'Entwurf' },
      null,
      draftClientId,
    );

    expect(result.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith('id', draftClientId);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
