// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAssistCatalogItems } from '@/hooks/assistCatalog/useAssistCatalog';
const h = vi.hoisted(() => ({ tenant: 'tenant-A' as string | null, load: vi.fn() }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: { roleKey: 'business_admin' } }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => h.tenant }));
vi.mock('@/lib/assistCatalog', () => ({ loadCatalogItems: h.load, loadCatalogs: vi.fn(), loadAssistAssignmentOptions: vi.fn(), loadAssistDocumentationBlocks: vi.fn() }));
let host: HTMLDivElement, root: Root, result: ReturnType<typeof useAssistCatalogItems>;
function Probe({ search }: { search?: string }) { result = useAssistCatalogItems('assist.intake.service_wish', { search }); return <span>{result.loading ? 'loading' : result.items.map(item => item.label).join(',')}{result.error}</span>; }
async function render(search?: string) { await act(async () => root.render(<Probe search={search}/>)); }
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); h.tenant = 'tenant-A'; h.load.mockResolvedValue({ ok: true, data: [{ id: '1', itemKey: 'help', label: 'Hilfe' }] }); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
describe('catalog loading stability', () => {
  it('loads once despite fresh equivalent filters, then reloads when an actual filter changes', async () => {
    await render(); await render(); await render();
    expect(h.load).toHaveBeenCalledTimes(1); expect(result.loading).toBe(false);
    await render('Haushalt'); expect(h.load).toHaveBeenCalledTimes(2);
  });
  it('ignores a late result from the previous tenant', async () => {
    let resolve!: (value: any) => void; h.load.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    await render(); h.tenant = 'tenant-B'; await render();
    await act(async () => resolve({ ok: true, data: [{ label: 'Alte Mandantendaten' }] }));
    expect(result.items.map(item => item.label)).toEqual(['Hilfe']);
  });
  it('stops loading without a tenant or after an exception and supports retry', async () => {
    h.tenant = null; await render(); expect(result.loading).toBe(false); expect(h.load).not.toHaveBeenCalled();
    h.tenant = 'tenant-A'; h.load.mockRejectedValueOnce(new Error('offline')); await render();
    expect(result.loading).toBe(false); expect(result.error).toContain('nicht geladen');
    await act(async () => result.reload()); expect(result.error).toBeNull(); expect(result.items).toHaveLength(1);
  });
});
