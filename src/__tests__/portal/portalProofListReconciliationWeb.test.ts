import { beforeEach, describe, expect, it, vi } from 'vitest';

const f = vi.hoisted(() => ({
  assist: vi.fn(),
  settings: vi.fn(),
  rows: [] as Record<string, unknown>[],
  records: [] as Record<string, unknown>[],
  failTable: '' as string,
  pageCap: 75,
  calls: [] as { table: string; from: number; to: number }[],
}));
vi.mock('@/lib/portal/assist/portalAssistVisitProofService', () => ({
  listReleasedProofsForClientPortal: f.assist,
}));
vi.mock('@/lib/client/clientPortalSettingsService', () => ({
  fetchClientPortalSettingsResolved: f.settings,
  canClientPortalSeeFeature: (settings: { showProofs?: boolean }) => settings.showProofs !== false,
}));
vi.mock('@/lib/services/serviceRunner', () => ({ runService: (fn: () => unknown) => fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/supabase/untypedTable', () => ({
  fromUnknownTable: (_client: unknown, table: string) => {
    const query = {
      select: () => query, eq: () => query, in: () => query, order: () => query,
      range: async (from: number, to: number) => {
        f.calls.push({ table, from, to });
        const rows = table === 'service_records' ? f.records : f.rows;
        return {
          data: rows.slice(from, Math.min(to + 1, from + f.pageCap)),
          error: f.failTable === table ? { message: 'offline' } : null,
          count: rows.length,
        };
      },
    };
    return query;
  },
}));
import * as native from '@/lib/portal/assist/portalServiceProofService';
import * as web from '@/lib/portal/assist/portalServiceProofService.web';

beforeEach(() => {
  vi.clearAllMocks();
  f.failTable = '';
  f.pageCap = 75;
  f.calls = [];
  f.records = [];
  f.rows = [{ id: 'p', title: 'Stale mirror', signature_required: true, signed_at: null }];
  f.settings.mockResolvedValue({ ok: true, data: {} });
  f.assist.mockResolvedValue({ ok: true, data: [{
    id: 'p', title: 'Signed proof', signatureRequired: false,
    signedAt: '2026-09-11T10:00:00Z', pdfStoragePath: 'signed.pdf',
  }] });
});

describe.each([['native', native], ['web', web]] as const)('%s proof reconciliation', (_platform, service) => {
  it('shows one current proof when its portal mirror is stale', async () => {
    const result = await service.listPortalServiceProofs('t', 'c');
    if (!result.ok) throw new Error(result.error);
    expect(result.data).toEqual([expect.objectContaining({
      id: 'p', title: 'Signed proof', signatureRequired: false, status: 'unterschrieben',
    })]);
  });

  it('never lets a stale signed mirror hide a pending canonical proof', async () => {
    f.rows = [{ id: 'p', signed_at: '2026-09-10', signature_required: false }];
    f.assist.mockResolvedValue({ ok: true, data: [{
      id: 'p', title: 'Pending', signatureRequired: true, signedAt: null,
    }] });
    const result = await service.listPortalServiceProofs('t', 'c');
    if (!result.ok) throw new Error(result.error);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].status).toBe('offen');
  });

  it.each(['mirror', 'proofs', 'settings', 'records'])('reports an incomplete %s source', async (source) => {
    if (source === 'mirror') f.failTable = 'client_documents';
    if (source === 'proofs') f.assist.mockResolvedValue({ ok: false, error: 'unavailable' });
    if (source === 'settings') f.settings.mockResolvedValue({ ok: false, error: 'unavailable' });
    if (source === 'records') {
      f.rows = [];
      f.assist.mockResolvedValue({ ok: true, data: [] });
      f.failTable = 'service_records';
    }
    expect((await service.listPortalServiceProofs('t', 'c')).ok).toBe(false);
  });

  it('does not label a document signed without signature evidence', async () => {
    f.rows = [{ id: 'unknown', title: 'Unknown state' }];
    f.assist.mockResolvedValue({ ok: true, data: [] });
    const result = await service.listPortalServiceProofs('t', 'c');
    if (!result.ok) throw new Error(result.error);
    expect(result.data[0].status).toBe('offen');
  });

  it('does not revive a withdrawn proof from a stale portal mirror', async () => {
    f.rows = [{ id: 'withdrawn', source: 'assist_visit_proof', signature_required: true }];
    f.assist.mockResolvedValue({ ok: true, data: [] });
    expect(await service.listPortalServiceProofs('t', 'c')).toEqual({ ok: true, data: [] });
  });

  it('loads pending documents beyond the default 1000 row cap', async () => {
    f.rows = Array.from({ length: 1105 }, (_, id) => ({
      id: `proof-${id}`, signature_required: id === 1104, signed_at: id < 1104 ? '2026-09-10' : null,
    }));
    f.assist.mockResolvedValue({ ok: true, data: [] });
    const result = await service.listPortalServiceProofs('t', 'c');
    if (!result.ok) throw new Error(result.error);
    expect(result.data).toHaveLength(1105);
    expect(result.data[0]).toEqual(expect.objectContaining({ id: 'proof-1104', status: 'offen' }));
    expect(f.calls.at(-1)?.from).toBe(1050);
  });

  it.each([
    ['signature_required', 'offen', true],
    ['signed', 'unterschrieben', false],
    ['approved', 'unterschrieben', false],
    ['billable', 'unterschrieben', false],
    ['billed', 'abgerechnet', false],
  ])('maps legacy %s without equating approval with billing', async (status, expected, signatureRequired) => {
    f.rows = [];
    f.assist.mockResolvedValue({ ok: true, data: [] });
    f.records = [{ id: 'record-1', status, created_at: '2026-09-10' }];
    const result = await service.listPortalServiceProofs('t', 'c');
    if (!result.ok) throw new Error(result.error);
    expect(result.data).toEqual([expect.objectContaining({ status: expected, signatureRequired })]);
  });

  it('respects disabled proof access before reading any proof source', async () => {
    f.settings.mockResolvedValue({ ok: true, data: { showProofs: false } });
    expect(await service.listPortalServiceProofs('t', 'c')).toEqual({ ok: true, data: [] });
    expect(f.calls).toEqual([]);
    expect(f.assist).not.toHaveBeenCalled();
  });
});
