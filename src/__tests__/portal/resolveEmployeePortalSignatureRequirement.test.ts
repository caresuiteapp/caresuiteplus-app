import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchValidVisitSignature = vi.fn();
const resolveLiveVisitId = vi.fn();
const resolveLiveAssignment = vi.fn();
const fromUnknownTable = vi.fn();

vi.mock('@/lib/assist/assistVisitSignaturePersistenceService', () => ({
  fetchValidVisitSignature: (...args: unknown[]) => fetchValidVisitSignature(...args),
}));

vi.mock('@/features/liveTracking/resolveLiveAssignment', () => ({
  resolveLiveVisitId: (...args: unknown[]) => resolveLiveVisitId(...args),
  resolveLiveAssignment: (...args: unknown[]) => resolveLiveAssignment(...args),
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({}),
}));

vi.mock('@/lib/supabase/untypedTable', () => ({
  fromUnknownTable: (...args: unknown[]) => fromUnknownTable(...args),
}));

describe('resolveEmployeePortalDocumentationFlags', () => {
  const tenantId = '56180c22-b894-4fab-b55e-a563c94dd6e7';
  const assignmentId = '27be8d4e-e6e1-4b2a-bccb-918ade0ad1ab';
  const visitId = '27be8d4e-e6e1-4b2a-bccb-918ade0ad1ab';

  beforeEach(() => {
    vi.clearAllMocks();
    fetchValidVisitSignature.mockResolvedValue({ ok: true, data: null });
    resolveLiveVisitId.mockResolvedValue(visitId);
    resolveLiveAssignment.mockResolvedValue({ ok: true, data: { visitId } });
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
      tenantId,
      assignmentId,
      'dokumentation_offen',
      'Leistung erbracht',
    );

    expect(flags.requiresSignature).toBe(true);
    expect(flags.signatureStatus).toBe('pending');
  });

  it('requires signature on beendet when documentation notes are submitted', async () => {
    fromUnknownTable.mockImplementation((_supabase: unknown, table: string) => {
      if (table === 'assist_visits') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { service_key: '', proof_status: 'none' },
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
      tenantId,
      assignmentId,
      'beendet',
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
      tenantId,
      assignmentId,
      'unterschrift_offen',
      'Leistung erbracht',
    );

    expect(flags.signatureStatus).toBe('captured');
  });

  it('falls back to master assignment id when live visit resolver returns null', async () => {
    resolveLiveAssignment.mockResolvedValue({ ok: true, data: null });
    resolveLiveVisitId.mockResolvedValue(null);
    fetchValidVisitSignature.mockResolvedValue({
      ok: true,
      data: { id: 'sig-2', signerName: 'Heinz-Peter', signedAt: '2026-07-01T10:00:00Z' },
    });

    const { resolveEmployeePortalDocumentationFlags } = await import(
      '@/lib/portal/resolveEmployeePortalSignatureRequirement'
    );

    const flags = await resolveEmployeePortalDocumentationFlags(
      tenantId,
      assignmentId,
      'unterschrift_offen',
      'Leistung erbracht',
    );

    expect(fetchValidVisitSignature).toHaveBeenCalledWith(tenantId, assignmentId);
    expect(flags.signatureStatus).toBe('captured');
  });
});
