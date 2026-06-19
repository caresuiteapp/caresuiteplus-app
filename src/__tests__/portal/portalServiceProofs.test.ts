import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  listPortalServiceProofs,
  resolvePortalServiceProofStatusLabel,
} from '@/lib/portal/assist/portalServiceProofService';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const mockMaybeSingle = vi.fn();
const mockOrder = vi.fn();
const mockEqCategory = vi.fn();
const mockEqStatus = vi.fn();
const mockEqPortalVisible = vi.fn();
const mockEqClient = vi.fn();
const mockEqTenant = vi.fn();
const mockSelectDocs = vi.fn();
const mockFromUnknown = vi.fn();

const mockServiceRecordsIn = vi.fn();
const mockServiceRecordsOrder = vi.fn();
const mockServiceRecordsEqClient = vi.fn();
const mockServiceRecordsEqTenant = vi.fn();
const mockServiceRecordsSelect = vi.fn();
const mockServiceRecordsFrom = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: (table: string) => {
      if (table === 'service_records') {
        mockServiceRecordsFrom(table);
        return {
          select: mockServiceRecordsSelect.mockReturnValue({
            eq: mockServiceRecordsEqTenant.mockReturnValue({
              eq: mockServiceRecordsEqClient.mockReturnValue({
                in: mockServiceRecordsIn.mockReturnValue({
                  order: mockServiceRecordsOrder.mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    },
  }),
}));

vi.mock('@/lib/supabase/untypedTable', () => ({
  fromUnknownTable: (...args: unknown[]) => mockFromUnknown(...args),
}));

describe('portal service proofs wiring', () => {
  it('AssistPortalOverview opens proofs modal instead of request form', () => {
    const source = readSrc('src/components/portal/assist/AssistPortalOverview.tsx');
    expect(source).toContain('PortalServiceProofsModal');
    expect(source).toContain('setProofsModalOpen(true)');
    expect(source).not.toContain("setRequestModal('nachweise')");
    expect(source).toContain('PortalDocumentUploadModal');
    expect(source).toContain('setUploadModalOpen(true)');
  });

  it('migration adds portal RLS for released proofs', () => {
    const sql = readSrc('supabase/migrations/0104_portal_service_proofs.sql');
    expect(sql).toContain('client_documents_portal_select');
    expect(sql).toContain("category = 'leistungsnachweis'");
    expect(sql).toContain('service_records_portal_select');
  });
});

describe('listPortalServiceProofs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFromUnknown.mockReturnValue({
      select: mockSelectDocs.mockReturnValue({
        eq: mockEqTenant.mockReturnValue({
          eq: mockEqClient.mockReturnValue({
            eq: mockEqPortalVisible.mockReturnValue({
              eq: mockEqCategory.mockReturnValue({
                eq: mockEqStatus.mockReturnValue({
                  order: mockOrder.mockResolvedValue({
                    data: [
                      {
                        id: 'proof-1',
                        tenant_id: 'tenant-1',
                        client_id: 'client-1',
                        title: 'Leistungsnachweis Mai',
                        file_name: 'ln-mai.pdf',
                        mime_type: 'application/pdf',
                        storage_path: 'tenant/clients/proof-1.pdf',
                        category: 'leistungsnachweis',
                        status: 'aktiv',
                        portal_visible: true,
                        signature_required: true,
                        signed_at: null,
                        created_at: '2026-05-31T10:00:00Z',
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    });
  });

  it('maps released client_documents to portal proofs', async () => {
    const result = await listPortalServiceProofs('tenant-1', 'client-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.status).toBe('offen');
      expect(result.data[0]?.periodLabel).toContain('2026');
    }
  });

  it('labels proof statuses in German', () => {
    expect(resolvePortalServiceProofStatusLabel('offen')).toBe('Offen');
    expect(resolvePortalServiceProofStatusLabel('abgerechnet')).toBe('Abgerechnet');
  });
});
