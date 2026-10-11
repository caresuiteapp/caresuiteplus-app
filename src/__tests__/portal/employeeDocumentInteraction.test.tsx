// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ query: vi.fn(), download: vi.fn(), open: vi.fn(), refresh: vi.fn(), actor: { tenantId: 'tenant', actorId: 'profile', employeeId: 'employee', clientId: null, roleKey: 'employee_portal', isLinkedReady: true, isResolvingClientLink: false, isResolvingEmployeeLink: false } }));
vi.mock('react-native', () => ({ Linking: { openURL: h.open } }));
vi.mock('@/lib/portal', () => ({ fetchPortalDocumentDetail: vi.fn(), fetchPortalDocuments: vi.fn(), downloadPortalDocument: h.download }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => h.actor }));
vi.mock('@/lib/supabase/config', () => ({ isDemoMode: () => false }));
vi.mock('@/hooks/core', async () => ({ useAsyncQuery: h.query, ...(await vi.importActual('@/hooks/core/useMutation')) }));
import { usePortalDocumentDetail } from '@/hooks/usePortalDocumentDetail';
import { usePortalDocuments } from '@/hooks/usePortalDocuments';
let root: Root, host: HTMLDivElement;
let state: ReturnType<typeof usePortalDocumentDetail> | ReturnType<typeof usePortalDocuments>;
function Harness({ detail = false }) { state = detail ? usePortalDocumentDetail('document', 'employee') : usePortalDocuments('employee'); return null; }
const render = async (detail = false) => { await act(async () => root.render(<Harness detail={detail} />)); };
beforeEach(() => {
  vi.clearAllMocks(); (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  h.actor.employeeId = 'employee'; h.actor.isLinkedReady = true; h.actor.isResolvingEmployeeLink = false;
  h.query.mockReturnValue({ data: null, loading: false, error: null, refreshError: null, refreshing: false, refresh: async () => { await h.refresh(); }, refreshWithResult: h.refresh });
  h.download.mockResolvedValue({ ok: true, data: { downloadUrl: 'https://example.test/document.pdf', fileName: 'document.pdf', mimeType: 'application/pdf' } });
  h.refresh.mockResolvedValue(true); h.open.mockResolvedValue(undefined);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
describe('personal document interactions', () => {
  it('does not report a successful download when opening the signed file fails, then allows retry', async () => {
    h.open.mockRejectedValueOnce(new Error('Datei konnte nicht geöffnet werden')); await render(true);
    await act(async () => { await (state as ReturnType<typeof usePortalDocumentDetail>).download(); });
    const failed = state as ReturnType<typeof usePortalDocumentDetail>;
    expect(failed.downloadLoading).toBe(false); expect(failed.downloadError).toContain('nicht geöffnet'); expect(failed.successMessage).toBeNull();
    await act(async () => { await failed.download(); });
    expect(h.open).toHaveBeenCalledTimes(2); expect((state as ReturnType<typeof usePortalDocumentDetail>).successMessage).toBe('Download gestartet.');
    expect(h.download).toHaveBeenCalledWith('document', 'profile', 'employee_portal', { tenantId: 'tenant', clientId: null, employeeId: 'employee' });
  });
  it('reports the actual refresh result and keeps a refresh failure visible with cached documents', async () => {
    await render(); await act(async () => { await state.refresh(); }); expect((state as ReturnType<typeof usePortalDocuments>).showSuccess).toBe(true);
    h.refresh.mockResolvedValue(false); h.query.mockReturnValue({ data: [{ id: 'document' }], loading: false, error: null, refreshError: 'Aktualisierung fehlgeschlagen', refreshing: false, refresh: async () => { await h.refresh(); }, refreshWithResult: h.refresh });
    await render(); await act(async () => { await state.refresh(); });
    expect((state as ReturnType<typeof usePortalDocuments>).showSuccess).toBe(false); expect(state.error).toBe('Aktualisierung fehlgeschlagen');
  });
  it('shows employee-link resolution and failure instead of an empty list or not-found document', async () => {
    h.actor.employeeId = null as any; h.actor.isLinkedReady = false; h.actor.isResolvingEmployeeLink = true;
    await render(); expect(state.loading).toBe(true); expect(state.error).toBeNull(); expect((state as ReturnType<typeof usePortalDocuments>).isEmpty).toBe(false);
    h.actor.isResolvingEmployeeLink = false; await render(); expect(state.error).toContain('Mitarbeitendenprofil');
    expect(h.query.mock.calls.at(-1)?.[2].enabled).toBe(false);
    await act(async () => root.unmount()); root = createRoot(host); await render(true);
    expect(state.error).toContain('Mitarbeitendenprofil'); expect((state as ReturnType<typeof usePortalDocumentDetail>).notFound).toBe(false);
  });
});
