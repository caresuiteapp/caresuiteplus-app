import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  remoteStatusToWorkflow,
  workflowStatusToRemote,
} from '@/lib/services/clients/clientStatusBridge';
import {
  hasProductionErrors,
  validateClientProductionForm,
  validateClientProductionStep,
} from '@/lib/services/clients/clientProductionValidation';
import { supabaseClientRepository } from '@/lib/services/clients/clientRepository.supabase';
import { EMPTY_CLIENT_FORM } from '@/types/forms/clientForm';

const mockFrom = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockNeq = vi.fn();
const mockOr = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();
const mockIs = vi.fn();

function createQueryChain(finalData: unknown = [], finalError: unknown = null) {
  const chain = {
    select: mockSelect.mockReturnThis(),
    eq: mockEq.mockReturnThis(),
    neq: mockNeq.mockReturnThis(),
    or: mockOr.mockReturnThis(),
    order: mockOrder.mockReturnThis(),
    is: mockIs.mockReturnThis(),
    insert: mockInsert.mockReturnThis(),
    update: mockUpdate.mockReturnThis(),
    single: mockSingle.mockResolvedValue({ data: finalData, error: finalError }),
    then: undefined as unknown,
  };

  chain.then = (resolve: (value: { data: unknown; error: unknown }) => void) =>
    Promise.resolve({ data: finalData, error: finalError }).then(resolve);

  return chain;
}

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: mockFrom,
  }),
}));

vi.mock('@/lib/supabase/untypedTable', () => ({
  fromUnknownTable: () => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    insert: vi.fn().mockResolvedValue({ error: null }),
  }),
}));

describe('Client production stabilization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => createQueryChain([]));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('clientStatusBridge', () => {
    it('mappt WorkflowStatus auf remote client_status', () => {
      expect(workflowStatusToRemote('aktiv')).toBe('active');
      expect(workflowStatusToRemote('archiviert')).toBe('archived');
      expect(workflowStatusToRemote('entwurf')).toBe('lead');
    });

    it('mappt remote client_status auf WorkflowStatus', () => {
      expect(remoteStatusToWorkflow('active')).toBe('aktiv');
      expect(remoteStatusToWorkflow('archived')).toBe('archiviert');
      expect(remoteStatusToWorkflow('lead')).toBe('entwurf');
    });

    it('behält lokale Text-Status als Fallback', () => {
      expect(remoteStatusToWorkflow('in_bearbeitung')).toBe('in_bearbeitung');
    });
  });

  describe('clientProductionValidation', () => {
    it('fordert Vor- und Nachname in Schritt 0', () => {
      const errors = validateClientProductionStep(0, EMPTY_CLIENT_FORM);
      expect(hasProductionErrors(errors)).toBe(true);
      expect(errors.firstName).toBeTruthy();
      expect(errors.lastName).toBeTruthy();
    });

    it('fordert PLZ und Ort, nicht Straße in Schritt 1', () => {
      const errors = validateClientProductionStep(1, {
        ...EMPTY_CLIENT_FORM,
        firstName: 'Erika',
        lastName: 'Muster',
      });
      expect(errors.zip).toBeTruthy();
      expect(errors.city).toBeTruthy();
      expect(errors.street).toBeUndefined();
    });

    it('validiert Gesamtformular für Produktion', () => {
      const errors = validateClientProductionForm({
        ...EMPTY_CLIENT_FORM,
        firstName: 'Erika',
        lastName: 'Muster',
        zip: '10115',
        city: 'Berlin',
      });
      expect(hasProductionErrors(errors)).toBe(false);
    });
  });

  describe('supabaseClientRepository.list', () => {
    it('filtert mandantenseitig nach tenant_id', async () => {
      mockFrom.mockImplementation(() =>
        createQueryChain([
          {
            id: 'c-1',
            tenant_id: 'tenant-a',
            first_name: 'Anna',
            last_name: 'Aktiv',
            status: 'active',
            care_level: null,
            city: 'Berlin',
            postal_code: '10115',
            sensitivity: 'care',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ]),
      );

      const result = await supabaseClientRepository.list('tenant-a');

      expect(result.ok).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('clients');
      expect(mockEq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
    });

    it('wendet Lifecycle-Filter archived serverseitig an', async () => {
      mockFrom.mockImplementation(() => createQueryChain([]));

      await supabaseClientRepository.list('tenant-a', { lifecycleFilter: 'archived' });

      expect(mockEq).toHaveBeenCalledWith('status', 'archived');
    });
  });

  describe('supabaseClientRepository.archive', () => {
    it('setzt remote Status archived bei Archivierung', async () => {
      const clientRow = {
        id: 'c-1',
        tenant_id: 'tenant-a',
        first_name: 'Anna',
        last_name: 'Aktiv',
        status: 'active',
        care_level: null,
        city: 'Berlin',
        postal_code: '10115',
        sensitivity: 'care',
        updated_at: '2026-01-01T00:00:00.000Z',
        created_at: '2026-01-01T00:00:00.000Z',
        date_of_birth: null,
        primary_contact_phone: null,
        street: null,
        phone: null,
        email: null,
        notes: null,
        visibility: 'team',
        owned_by_profile_id: null,
        shared_with_profile_ids: [],
      };

      let updateCalls = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table !== 'clients') {
          return createQueryChain([]);
        }

        if (updateCalls === 0) {
          updateCalls += 1;
          return {
            update: mockUpdate.mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
            select: mockSelect.mockReturnValue({
              eq: mockEq.mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: clientRow, error: null }),
                }),
              }),
            }),
          };
        }

        return createQueryChain([clientRow]);
      });

      const result = await supabaseClientRepository.archive('tenant-a', 'c-1', {
        actorProfileId: 'profile-1',
        actorDisplayName: 'Admin',
      });

      expect(result.ok).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'archived' }),
      );
    });
  });
});
