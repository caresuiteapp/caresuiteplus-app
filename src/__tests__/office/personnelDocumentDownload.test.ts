import { beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadPersonnelDocument } from '@/lib/office/personnelDocumentDownload.web';
const h = vi.hoisted(() => ({ load: vi.fn(), download: vi.fn() }));
vi.mock('@/lib/office/employeePersonnelFileService', () => ({ fetchEmployeePersonnelFile: h.load }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ storage: { from: () => ({ download: h.download }) } }) }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
const doc = { id: 'doc', tenantId: 't', employeeId: 'e', fileName: 'Vertrag.pdf', storagePath: 'tenant/t/employees/e/doc/file.pdf' };
beforeEach(() => { vi.clearAllMocks(); h.load.mockResolvedValue({ ok: true, data: { documents: [doc] } }); h.download.mockResolvedValue({ data: new Blob(['pdf']), error: null }); });
describe('personnel document delivery', () => {
  it('loads the permitted record before downloading from storage', async () => {
    const result = await downloadPersonnelDocument('t', 'e', 'doc', 'business_admin', 'profile');
    expect(result.ok && result.data.filename).toBe('Vertrag.pdf');
    expect(h.load).toHaveBeenCalledWith('t', 'e', 'business_admin', { userId: 'profile' });
    expect(h.download).toHaveBeenCalledWith(doc.storagePath);
  });
  it.each([{ tenantId: 'other' }, { employeeId: 'other' }, { storagePath: 'tenant/other/file.pdf' }, { storagePath: 'tenant/t/../other/file.pdf' }, { storagePath: 'tenant/t/%2e%2e/file.pdf' }])('rejects foreign or unsafe paths %j', async patch => {
    h.load.mockResolvedValue({ ok: true, data: { documents: [{ ...doc, ...patch }] } });
    expect((await downloadPersonnelDocument('t', 'e', 'doc', 'business_admin')).ok).toBe(false); expect(h.download).not.toHaveBeenCalled();
  });
  it('does not download a document removed by permission filtering', async () => {
    h.load.mockResolvedValue({ ok: true, data: { documents: [] } });
    expect((await downloadPersonnelDocument('t', 'e', 'doc', 'business_admin')).ok).toBe(false); expect(h.download).not.toHaveBeenCalled();
  });
});
