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

const mocks = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
}));

vi.mock('@/lib/client/clientPortalSettingsService', () => ({
  fetchClientPortalSettingsResolved: async () => ({ ok: true, data: {} }),
  canClientPortalSeeFeature: () => true,
}));
vi.mock('@/lib/portal/assist/portalAssistVisitProofService', () => ({
  listReleasedProofsForClientPortal: async () => ({ ok: true, data: [] }),
}));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/supabase/untypedTable', () => ({
  fromUnknownTable: (_client: unknown, table: string) => {
    const query = {
      select: () => query, eq: () => query, in: () => query, order: () => query,
      range: async (from: number, to: number) => {
        const rows = table === 'client_documents' ? mocks.rows : [];
        return { data: rows.slice(from, to + 1), count: rows.length, error: null };
      },
    };
    return query;
  },
}));

describe('portal service proofs wiring', () => {
  it('resolves Web service exports through their unique shared cores', async () => {
    const { build } = await import('esbuild');
    const servicePaths = [
      '@/lib/portal/assist/portalServiceProofService',
      '@/lib/portal/assist/portalAssistVisitProofService',
    ];
    const result = await build({
      stdin: {
        contents: `import { listPortalServiceProofs } from '${servicePaths[0]}';
          import { listReleasedProofsForClientPortal, getReleasedProofForClientPortal,
            fetchAssistProofPortalDocumentDetail } from '${servicePaths[1]}';
          export const actions = [listPortalServiceProofs, listReleasedProofsForClientPortal,
            getReleasedProofForClientPortal, fetchAssistProofPortalDocumentDetail];`,
        resolveDir: root, loader: 'ts',
      },
      alias: { '@': path.join(root, 'src') },
      bundle: true, write: false, metafile: true, format: 'esm', platform: 'browser',
      resolveExtensions: ['.web.ts', '.ts', '.web.tsx', '.tsx', '.js'],
      plugins: [{ name: 'external-service-dependencies', setup(builder) {
        builder.onResolve({ filter: /.*/ }, ({ path: request }) => {
          if (servicePaths.includes(request) || /^\.\/portal(?:AssistVisitProof|ServiceProof)Service\.core$/.test(request)) return null;
          return { path: request, external: true };
        });
      } }],
    });
    const inputs = Object.keys(result.metafile!.inputs);
    for (const name of ['portalServiceProofService', 'portalAssistVisitProofService']) {
      expect(inputs.some((file) => file.endsWith(`/${name}.web.ts`))).toBe(true);
      expect(inputs.some((file) => file.endsWith(`/${name}.core.ts`))).toBe(true);
      expect(inputs.some((file) => file.endsWith(`/${name}.ts`))).toBe(false);
    }
  });

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
    mocks.rows = [{
      id: 'proof-1', tenant_id: 'tenant-1', client_id: 'client-1',
      title: 'Leistungsnachweis Mai', file_name: 'ln-mai.pdf', mime_type: 'application/pdf',
      storage_path: 'tenant/clients/proof-1.pdf', category: 'leistungsnachweis',
      status: 'aktiv', portal_visible: true, signature_required: true, signed_at: null,
      created_at: '2026-05-31T10:00:00Z',
    }];
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
