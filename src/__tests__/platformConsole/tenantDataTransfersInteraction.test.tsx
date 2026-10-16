// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ action: vi.fn(), files: vi.fn(), list: vi.fn(), upload: vi.fn(), download: vi.fn(), discard: vi.fn(), open: vi.fn() }));
vi.mock('@/lib/dataTransfers/service', () => ({
  transferAction: api.action, listTransferFiles: api.files, listTransfers: api.list, downloadTransferFile: api.download,
  discardTransferFile: api.discard, getOpenTransfer: api.open, formatTransferSize: (n: number) => `${n} B`,
}));
vi.mock('@/lib/dataTransfers/upload.web', () => ({ uploadTransferFile: api.upload }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({}) }));
import { TenantDataUploadDialog } from '@/components/dataTransfers/TenantDataUploadDialog.web';
import { TenantTransferInbox } from '@/components/dataTransfers/TenantDataUploadGate.web';
import { TenantDataTransfers } from '@/screens/platformConsole/TenantDataTransfers.web';
import type { DataRequest } from '@/lib/dataTransfers/service';
const request: DataRequest = { id: 'request-a', tenant_id: 'tenant-a', message: 'Bitte Ihre Unterlagen übermitteln.', state: 'open', created_at: '2026-10-16T08:00:00Z', expires_at: '2026-11-16T08:00:00Z', submitted_at: null };
let host: HTMLDivElement; let root: Root;
const flush = async () => { await act(async () => { await Promise.resolve(); }); };
const render = async (node: React.ReactNode) => { await act(async () => root.render(node)); await flush(); };
const button = (text: string) => [...host.querySelectorAll('button')].find(node => node.textContent === text)!;
const click = async (text: string) => { await act(async () => button(text).click()); await flush(); };
async function selectFile(name = 'beliebig.backup') {
  const input = host.querySelector('input[type=file]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { configurable: true, value: [new File(['export'], name)] });
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
}
beforeEach(() => {
  vi.clearAllMocks(); (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  api.files.mockResolvedValue({ items: [], total: 0 }); api.list.mockResolvedValue({ items: [], total: 0 });
  api.action.mockResolvedValue({}); api.upload.mockResolvedValue(undefined);
  api.open.mockResolvedValue({ request });
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
it('activates the popup for exactly the selected company and leaves an actionable retry on failure', async () => {
  await render(<TenantDataTransfers tenantId="tenant-a" />);
  api.action.mockRejectedValueOnce(new Error('Verbindung unterbrochen'));
  await click('Upload-Popup beim Mandanten aktivieren');
  expect(host.textContent).toContain('Verbindung unterbrochen');
  expect(api.action).toHaveBeenLastCalledWith('create', 'tenant-a', expect.objectContaining({ p_name: expect.stringContaining('Klienten- und Personaldaten') }));
  await click('Upload-Popup beim Mandanten aktivieren');
  expect(host.textContent).toContain('Upload-Anfrage aktiviert');
});
it('requires successful upload and explicit authorization before submitting arbitrary file formats', async () => {
  const onSubmitted = vi.fn();
  await render(<TenantDataUploadDialog request={request} userId="user-a" onClose={vi.fn()} onSubmitted={onSubmitted} />);
  expect(button('Daten übermitteln').disabled).toBe(true);
  await selectFile();
  const record = { id: 'f', tenant_id: 'tenant-a', request_id: 'request-a', name: 'beliebig.backup', size: 6, created_by: 'user-a', state: 'pending', object_path: 'opaque' };
  api.action.mockResolvedValueOnce(record);
  api.files.mockResolvedValue({ items: [{ ...record, state: 'ready' }], total: 1 });
  await click('Dateien hochladen / fortsetzen');
  expect(api.upload).toHaveBeenCalledWith(expect.any(File), record, expect.any(AbortSignal), expect.any(Function));
  expect(button('Daten übermitteln').disabled).toBe(true);
  await act(async () => (host.querySelector('input[type=checkbox]') as HTMLInputElement).click());
  await click('Daten übermitteln');
  expect(api.action).toHaveBeenLastCalledWith('submit', 'tenant-a', { p_request_id: 'request-a' });
  expect(host.textContent).toContain('Daten erfolgreich übermittelt');
  await click('Fertig'); expect(onSubmitted).toHaveBeenCalledOnce();
});
it('keeps a failed upload recoverable without reporting a successful submission', async () => {
  await render(<TenantDataUploadDialog request={request} userId="user-a" onClose={vi.fn()} onSubmitted={vi.fn()} />);
  await selectFile('Export.zip');
  api.action.mockResolvedValue({ id: 'f', name: 'Export.zip', size: 6, state: 'pending' });
  api.upload.mockRejectedValueOnce(new Error('Netzwerk unterbrochen'));
  await click('Dateien hochladen / fortsetzen');
  expect(host.textContent).toContain('Netzwerk unterbrochen');
  expect(host.textContent).not.toContain('Daten erfolgreich übermittelt');
  expect(button('Daten übermitteln').disabled).toBe(true);
  expect(button('Dateien hochladen / fortsetzen').disabled).toBe(false);
});
it('ignores a stale popup response after the company session is replaced', async () => {
  let resolveOld: (value: unknown) => void = () => {};
  api.open.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValue({ request: null });
  await render(<TenantTransferInbox key="a" tenantId="tenant-a" userId="user-a" />);
  await render(<TenantTransferInbox key="b" tenantId="tenant-b" userId="user-b" />);
  await act(async () => resolveOld({ request }));
  expect(host.querySelector('dialog')).toBeNull();
  expect(host.textContent).not.toContain(request.message);
});
it('shows only released download actions and sends the bound file to the download API', async () => {
  const ready = { id: 'file', tenant_id: 'tenant-a', request_id: request.id, state: 'ready', name: 'Kunden.xlsx', size: 88 };
  api.list.mockResolvedValue({ items: [{ ...request, state: 'submitted', file_count: 1 }], total: 1 });
  api.files.mockResolvedValue({ items: [ready], total: 1 });
  await render(<TenantDataTransfers tenantId="tenant-a" />);
  await click('Herunterladen'); expect(api.download).toHaveBeenCalledWith(ready);
  await click('Als bearbeitet markieren'); expect(api.action).toHaveBeenCalledWith('process', 'tenant-a', expect.objectContaining({ p_request_id: request.id }));
});
