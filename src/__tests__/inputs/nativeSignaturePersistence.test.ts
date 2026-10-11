import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ upload: vi.fn(), insert: vi.fn(), remove: vi.fn(), insertError: false }));
vi.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000001' }));
vi.mock('@/lib/assist/assistExecutionPersistenceService', () => ({ fetchValidVisitSignature: async () => ({ ok: true, data: null }), isAssistExecutionPersistenceReady: () => true }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ storage: { from: () => ({ upload: f.upload, remove: f.remove }) } }) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: () => ({ insert: (row: Record<string, unknown>) => { f.insert(row); return { select: () => ({ single: async () => ({ data: row, error: f.insertError ? { message: 'insert denied' } : null }) }) }; } }) }));
import { saveVisitSignaturePersistent } from '@/lib/assist/assistVisitSignaturePersistenceService';
const input = { visitId: 'visit', signerName: 'Testperson', signerRole: 'client', storagePath: '', payloadHash: 'hash', signatureHash: 'image-hash', signedAt: '2026-10-11T09:00:00Z', signatureDataUrl: 'data:image/png;base64,iVBORw0KGgo=' };
beforeEach(() => { vi.clearAllMocks(); f.insertError = false; vi.stubGlobal('crypto', undefined); f.upload.mockResolvedValue({ error: null }); f.remove.mockResolvedValue({ error: null }); });
afterEach(() => vi.unstubAllGlobals());
it('persists a native capture with a real UUID and binary PNG without browser crypto', async () => {
  expect((await saveVisitSignaturePersistent('tenant', input)).ok).toBe(true);
  expect(f.insert.mock.calls[0][0].id).toBe('00000000-0000-4000-8000-000000000001');
  expect(f.upload.mock.calls[0][1]).toBeInstanceOf(ArrayBuffer);
  expect([...new Uint8Array(f.upload.mock.calls[0][1])]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
});
it('reports a failed signature insert and cleans up its own uploaded image', async () => {
  f.insertError = true;
  expect((await saveVisitSignaturePersistent('tenant', input)).ok).toBe(false);
  expect(f.remove).toHaveBeenCalledWith(['tenant/tenant/assist/visits/visit/signatures/00000000-0000-4000-8000-000000000001.png']);
});
