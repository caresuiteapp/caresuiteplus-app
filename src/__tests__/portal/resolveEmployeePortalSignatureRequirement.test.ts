import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchValidVisitSignature = vi.fn();
const resolveLiveVisitId = vi.fn();
const fromUnknownTable = vi.fn();

vi.mock('@/lib/assist/assistVisitSignaturePersistenceService', () => ({
  fetchValidVisitSignature: (...args: unknown[]) => fetchValidVisitSignature(...args),
}));

vi.mock('@/features/liveTracking/resolveLiveAssignment', () => ({
  resolveLiveVisitId: (...args: unknown[]) => resolveLiveVisitId(...args),
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({}),
}));

vi.mock('@/lib/supabase/untypedTable', () => ({
  fromUnknownTable: (...args: unknown[]) => fromUnknownTable(...args),
}));

describe('resolveEmployeePortalDocumentationFlags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchValidVisitSignature.mockResolvedValue({ ok: true, data: null });
    resolveLiveVisitId.mockResolvedValue('visit-1');
  });

  it('requires signature when catalog item requires_signature is true', async () => {
    fromUnknownTable.mockImplementation((_supabase: unknown, table: string) => {
      if (table === 'assist_visits') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { service_key: 'alltagsbegleitung', proof_status: 'none' },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'assist_service_catalog_items') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { requires_signature: true, requires_documentation: true },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const { resolveEmployeePortalDocumentationFlags } = await import(
      '@/lib/portal/resolveEmployeePortalSignatureRequirement'
    );

    const flags = await resolveEmployeePortalDocumentationFlags(
      'tenant-1',
      'assignment-1',
      'dokumentation_offen',
      'Leistung erbracht',
    );

    expect(flags.requiresSignature).toBe(true);
    expect(flags.signatureStatus).toBe('pending');
  });

  it('marks signature captured when persisted signature exists', async () => {
    fetchValidVisitSignature.mockResolvedValue({
      ok: true,
      data: { id: 'sig-1', signerName: 'Heinz-Peter', signedAt: '2026-07-01T10:00:00Z' },
    });

    fromUnknownTable.mockImplementation((_supabase: unknown, table: string) => {
      if (table === 'assist_visits') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { service_key: 'alltagsbegleitung', proof_status: 'pending' },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'assist_service_catalog_items') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { requires_signature: true, requires_documentation: true },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const { resolveEmployeePortalDocumentationFlags } = await import(
      '@/lib/portal/resolveEmployeePortalSignatureRequirement'
    );

    const flags = await resolveEmployeePortalDocumentationFlags(
      'tenant-1',
      'assignment-1',
      'unterschrift_offen',
      'Leistung erbracht',
    );

    expect(flags.signatureStatus).toBe('captured');
  });
});
