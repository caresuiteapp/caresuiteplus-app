// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientDocumentRecord } from '@/types/modules/client';
import { getCatalogOptions } from '@/lib/catalogs/systemCatalogService';

const f = vi.hoisted(() => ({
  list: vi.fn(), upload: vi.fn(), pick: vi.fn(), preview: vi.fn(), recommendations: vi.fn(), recordRefresh: vi.fn(),
  tenant: 'tenant-a', actor: 'actor-a', role: 'business_admin', readOnly: false,
}));
vi.mock('react-native', () => ({ Platform: { OS: 'web' }, AppState: { addEventListener: vi.fn() } }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ DEFAULT_LIVE_POLL_MS: 30_000, useLiveRefresh: () => ({ isLiveConnected: false }) }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: { id: f.actor, roleKey: f.role, displayName: 'Testperson' } }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ isReadOnly: f.readOnly, can: () => !f.readOnly }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => f.tenant }));
vi.mock('@/lib/clients/clientDocumentsService', () => ({ listClientDocuments: f.list, uploadClientDocument: f.upload }));
vi.mock('expo-document-picker', () => ({ getDocumentAsync: f.pick }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'demo' }));
vi.mock('@/components/office/ClientDocumentPreview', () => ({ ClientDocumentPreview: (props: { document: ClientDocumentRecord; onDeliveryComplete?: () => void }) => {
  f.preview(props);
  return <div aria-label="Dokumentvorschau">{props.document.title}<button onClick={props.onDeliveryComplete}>Versand abschließen</button></div>;
} }));
vi.mock('@/components/documents/DocumentRecommendations', () => ({ DocumentRecommendations: (props: unknown) => {
  f.recommendations(props); return <div aria-label="Dokumentkatalog" />;
} }));
import { ClientRecordDocumentsPanel } from '@/components/office/ClientRecordDocumentsPanel.web';

let host: HTMLDivElement;
let root: Root;
function doc(id: string, overrides: Partial<ClientDocumentRecord> = {}): ClientDocumentRecord {
  return { id, tenantId: 'tenant-a', clientId: 'client-a', title: id, fileName: `${id}.pdf`, mimeType: 'application/pdf', category: 'vertrag', storagePath: `${id}.pdf`, status: 'abgeschlossen', sensitivity: 'standard', uploadedBy: 'actor-a', validUntil: null, createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-01T12:00:00Z', documentSource: 'upload', ...overrides };
}
const documents = () => [
  doc('z', { title: 'Zuschussvertrag', fileName: 'vereinbarung-2026.pdf', updatedAt: '2026-10-10T12:00:00Z' }),
  doc('a', { title: 'Aufnahmevertrag', updatedAt: '2026-10-12T12:00:00Z' }),
  doc('b', { title: 'Befund Oktober', category: 'arztbrief', updatedAt: '2026-10-14T12:00:00Z' }),
];
const picked = () => ({ canceled: false, assets: [{ name: 'Pflegegradbescheid.pdf', mimeType: 'application/pdf', size: 512, uri: 'file:///synthetic-document.pdf' }] });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const render = async (clientId = 'client-a', initialDocuments?: ClientDocumentRecord[]) => {
  await act(async () => root.render(<ClientRecordDocumentsPanel clientId={clientId} clientLastName="Beispiel" initialDocuments={initialDocuments} onRecordRefresh={f.recordRefresh} />));
};
function button(text: string, scope: ParentNode = host) {
  const found = [...scope.querySelectorAll('button')].find((item) => item.textContent?.includes(text) || item.getAttribute('aria-label') === text);
  if (!found) throw new Error(`Button fehlt: ${text}`);
  return found;
}
const click = async (text: string, scope?: ParentNode) => { await act(async () => button(text, scope).click()); };
function input() { return host.querySelector<HTMLInputElement>('input[type="search"]')!; }
function filterSelect() { return host.querySelectorAll<HTMLSelectElement>('.cr-docs-filters select')[0]!; }
function sortSelect() { return host.querySelectorAll<HTMLSelectElement>('.cr-docs-filters select')[1]!; }
function rows() { return [...host.querySelectorAll<HTMLButtonElement>('.cr-docs-row')].map((row) => row.getAttribute('aria-label')); }
async function change(element: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}
async function prepareUpload() { await click('Dokument hochladen'); await click('Datei auswählen'); }
async function submit() {
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  f.tenant = 'tenant-a'; f.actor = 'actor-a'; f.role = 'business_admin'; f.readOnly = false;
  f.list.mockReset().mockResolvedValue({ ok: true, data: documents() });
  f.upload.mockReset().mockResolvedValue({ ok: true, data: doc('uploaded') });
  f.pick.mockReset().mockResolvedValue(picked());
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('client document list and preview', () => {
  it('shows scoped documents immediately and only occupied categories as shortcuts while retaining the full catalog in both selects', async () => {
    f.list.mockResolvedValue({ ok: true, data: [...documents(), doc('other-client', { clientId: 'client-b' }), doc('other-tenant', { tenantId: 'tenant-b' })] });
    await render();
    expect(rows()).toEqual(['Befund Oktober ansehen', 'Aufnahmevertrag ansehen', 'Zuschussvertrag ansehen']);
    const rowDescription = button('Befund Oktober ansehen').getAttribute('aria-describedby')!.split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent).join(' ');
    expect(rowDescription).toContain('Arztbrief'); expect(rowDescription).toContain('Abgeschlossen'); expect(rowDescription).toContain('14.10.2026');
    const shortcuts = host.querySelector('[aria-label="Vorhandene Dokumentkategorien"]')!;
    expect([...shortcuts.querySelectorAll('button')].map((item) => item.textContent?.replace(/\s+/g, ''))).toEqual(['AlleDokumente3', 'Vertrag2', 'Arztbrief1']);
    const catalogKeys = getCatalogOptions('document_category').map((item) => item.value);
    expect([...filterSelect().options].map((option) => option.value)).toEqual(['all', ...catalogKeys]);
    await click('Dokument hochladen');
    expect([...host.querySelector<HTMLSelectElement>('form select')!.options].map((option) => option.value)).toEqual(catalogKeys);
    expect(f.list).toHaveBeenCalledExactlyOnceWith('tenant-a', 'client-a');
    expect(f.recommendations).toHaveBeenLastCalledWith({ module: 'office', workflow: 'client_documents', clientId: 'client-a', compact: true });
  });

  it('searches title, filename and category locally and combines filters with alphabetical sorting', async () => {
    await render();
    await change(input(), '  AUFNAHME  '); expect(rows()).toEqual(['Aufnahmevertrag ansehen']);
    await change(input(), 'vereinbarung-2026'); expect(rows()).toEqual(['Zuschussvertrag ansehen']);
    await change(input(), 'arztbrief'); expect(rows()).toEqual(['Befund Oktober ansehen']);
    await change(input(), ''); await change(filterSelect(), 'vertrag'); await change(sortSelect(), 'name');
    expect(rows()).toEqual(['Aufnahmevertrag ansehen', 'Zuschussvertrag ansehen']);
    await change(input(), 'unbekannte Unterlage'); expect(rows()).toEqual([]); expect(host.textContent).toContain('Keine passenden Dokumente');
    await click('Filter zurücksetzen'); expect(filterSelect().value).toBe('all'); expect(input().value).toBe('');
    expect(rows()).toEqual(['Aufnahmevertrag ansehen', 'Befund Oktober ansehen', 'Zuschussvertrag ansehen']);
    expect(f.list).toHaveBeenCalledOnce();
  });

  it('opens the existing preview with the scoped document and restores all filters on return', async () => {
    await render(); await change(input(), 'vertrag'); await change(filterSelect(), 'vertrag'); await change(sortSelect(), 'name');
    await click('Zuschussvertrag ansehen');
    expect(host.querySelector('[aria-label="Dokumentvorschau"]')).not.toBeNull();
    expect(document.activeElement).toBe(button('Zur Dokumentenliste'));
    expect(f.preview).toHaveBeenLastCalledWith(expect.objectContaining({ tenantId: 'tenant-a', clientId: 'client-a', document: expect.objectContaining({ id: 'z' }), clientLastName: 'Beispiel', actorName: 'Testperson', onDeliveryComplete: f.recordRefresh }));
    await click('Versand abschließen'); expect(f.recordRefresh).toHaveBeenCalledOnce();
    await click('Zur Dokumentenliste');
    expect(input().value).toBe('vertrag'); expect(filterSelect().value).toBe('vertrag'); expect(sortSelect().value).toBe('name');
    expect(rows()).toEqual(['Aufnahmevertrag ansehen', 'Zuschussvertrag ansehen']);
    expect(f.list).toHaveBeenCalledOnce();
  });

  it('distinguishes initial loading and errors from an empty record and retries the failed request', async () => {
    const pending = deferred<unknown>(); f.list.mockReturnValueOnce(pending.promise); await render();
    expect(host.textContent).toContain('Die Unterlagen werden zusammengestellt.');
    expect(host.textContent).not.toContain('Hier entsteht die Dokumentenakte.');
    expect(button('Dokumentenliste aktualisieren').disabled).toBe(true);
    await act(async () => pending.resolve({ ok: false, error: 'Abruf gesperrt' }));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Abruf gesperrt');
    expect(host.textContent).toContain('Dokumente derzeit nicht verfügbar');
    expect(host.textContent).not.toContain('Hier entsteht die Dokumentenakte.');
    await click('Erneut laden'); expect(rows()).toHaveLength(3); expect(f.list).toHaveBeenCalledTimes(2);
  });

  it('retains loaded documents after a refresh failure and makes recovery available', async () => {
    await render(); f.list.mockResolvedValueOnce({ ok: false, error: 'Abruf gesperrt' });
    await click('Dokumentenliste aktualisieren');
    expect(rows()).toHaveLength(3); expect(host.querySelector('[role="alert"]')?.textContent).toContain('Abruf gesperrt');
    await click('Erneut laden'); expect(host.querySelector('[role="alert"]')).toBeNull(); expect(f.list).toHaveBeenCalledTimes(3);
  });

  it('shows a real empty record without empty category tiles and omits every upload entry point for read-only access', async () => {
    f.readOnly = true; f.list.mockResolvedValue({ ok: true, data: [] }); await render();
    expect(host.textContent).toContain('Hier entsteht die Dokumentenakte.');
    expect(host.querySelector('[aria-label="Vorhandene Dokumentkategorien"]')).toBeNull();
    expect(host.textContent).not.toContain('Dokument hochladen'); expect(host.textContent).not.toContain('Erstes Dokument hinzufügen');
    expect(host.querySelector('form')).toBeNull(); expect(f.pick).not.toHaveBeenCalled(); expect(f.upload).not.toHaveBeenCalled();
  });
});

describe('client document upload lifecycle', () => {
  it('presets the selected category, serializes rapid submissions and refreshes only after a confirmed upload', async () => {
    const pending = deferred<unknown>(); f.upload.mockReturnValueOnce(pending.promise); await render();
    await change(filterSelect(), 'arztbrief'); await prepareUpload();
    expect(host.querySelector<HTMLSelectElement>('form select')!.value).toBe('arztbrief');
    expect(host.querySelector<HTMLInputElement>('form input')!.value).toBe('Pflegegradbescheid');
    const form = host.querySelector('form')!;
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(f.upload).toHaveBeenCalledExactlyOnceWith('tenant-a', 'client-a', expect.objectContaining({ title: 'Pflegegradbescheid', category: 'arztbrief', fileName: 'Pflegegradbescheid.pdf', mimeType: 'application/pdf', sizeBytes: 512, uploadedBy: 'actor-a' }));
    expect(button('Wird gespeichert…').disabled).toBe(true); expect(button('Upload schließen').disabled).toBe(true);
    expect(f.list).toHaveBeenCalledOnce(); expect(f.recordRefresh).not.toHaveBeenCalled();
    const refresh = deferred<unknown>(); f.list.mockReturnValueOnce(refresh.promise);
    await act(async () => pending.resolve({ ok: true, data: doc('uploaded') }));
    expect(button('Dokument hochladen').disabled).toBe(true); expect(document.activeElement).not.toBe(button('Dokument hochladen'));
    await act(async () => refresh.resolve({ ok: true, data: documents() }));
    expect(host.querySelector('form')).toBeNull(); expect(host.textContent).toContain('Dokument wurde in der Akte gespeichert.');
    expect(button('Dokument hochladen').disabled).toBe(false); expect(document.activeElement).toBe(button('Dokument hochladen'));
    expect(f.list).toHaveBeenCalledTimes(2); expect(f.recordRefresh).toHaveBeenCalledOnce();
  });

  it('retains the selected file and title after an upload throws and asks to verify the list before retrying', async () => {
    f.upload.mockRejectedValueOnce(new Error('write interrupted')); await render(); await prepareUpload(); await submit();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('nicht vollständig bestätigt');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Aktualisieren Sie zunächst die Liste');
    expect(button('Pflegegradbescheid.pdf')).toBeDefined();
    expect(host.querySelector<HTMLInputElement>('form input')!.value).toBe('Pflegegradbescheid');
    expect(button('In Akte speichern').disabled).toBe(false); expect(f.list).toHaveBeenCalledOnce(); expect(f.recordRefresh).not.toHaveBeenCalled();
  });

  it('retains the file when the service declines the upload and shows the service error', async () => {
    f.upload.mockResolvedValueOnce({ ok: false, error: 'Datei konnte nicht gespeichert werden.' }); await render(); await prepareUpload(); await submit();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Datei konnte nicht gespeichert werden.');
    expect(button('Pflegegradbescheid.pdf')).toBeDefined(); expect(button('In Akte speichern').disabled).toBe(false);
    expect(f.list).toHaveBeenCalledOnce();
  });

  it('makes a confirmed upload clear when its subsequent refresh fails and prevents resubmitting the old file', async () => {
    await render(); await prepareUpload(); f.list.mockResolvedValueOnce({ ok: false, error: 'Abruf gesperrt' }); await submit();
    expect(host.textContent).toContain('Das Dokument wurde gespeichert.');
    expect(host.textContent).toContain('ein erneuter Upload ist nicht nötig');
    expect(host.textContent).not.toContain('Der Upload konnte nicht vollständig bestätigt werden.');
    expect(host.querySelector('form')).toBeNull(); expect(f.recordRefresh).toHaveBeenCalledOnce();
    await click('Dokument hochladen');
    expect(host.querySelector<HTMLInputElement>('form input')!.value).toBe(''); expect(button('In Akte speichern').disabled).toBe(true);
    expect(host.textContent).not.toContain('Pflegegradbescheid.pdf'); expect(f.upload).toHaveBeenCalledOnce();
  });

  it('serializes rapid file picks and recovers from a picker exception without enabling an empty upload', async () => {
    const pending = deferred<unknown>(); f.pick.mockReturnValueOnce(pending.promise); await render(); await click('Dokument hochladen');
    await act(async () => { const pickButton = button('Datei auswählen'); pickButton.click(); pickButton.click(); });
    expect(f.pick).toHaveBeenCalledOnce(); expect(button('Datei wird gelesen…').disabled).toBe(true);
    await act(async () => pending.resolve({ canceled: true, assets: null }));
    f.pick.mockRejectedValueOnce(new Error('reader interrupted')); await click('Datei auswählen');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Datei konnte nicht gelesen werden.');
    expect(button('In Akte speichern').disabled).toBe(true); expect(f.upload).not.toHaveBeenCalled();
  });

  it.each(['client', 'tenant', 'actor', 'role', 'readOnly'] as const)('discards picked files and late picker results when %s changes', async (identity) => {
    await render(); await prepareUpload();
    const pending = deferred<unknown>(); f.pick.mockReturnValueOnce(pending.promise); await click('Pflegegradbescheid.pdf');
    if (identity === 'tenant') f.tenant = 'tenant-b';
    if (identity === 'actor') f.actor = 'actor-b';
    if (identity === 'role') f.role = 'office_staff';
    if (identity === 'readOnly') f.readOnly = true;
    await render(identity === 'client' ? 'client-b' : 'client-a');
    await act(async () => pending.resolve(picked()));
    expect(host.querySelector('form')).toBeNull(); expect(host.textContent).not.toContain('Pflegegradbescheid.pdf');
    if (!f.readOnly) {
      await click('Dokument hochladen');
      expect(host.querySelector<HTMLInputElement>('form input')!.value).toBe(''); expect(button('In Akte speichern').disabled).toBe(true);
    }
    expect(f.upload).not.toHaveBeenCalled();
  });

  it.each([true, false])('ignores late upload feedback after switching client (success: %s)', async (success) => {
    const pending = deferred<unknown>(); f.upload.mockReturnValueOnce(pending.promise); await render(); await prepareUpload(); await submit();
    await render('client-b'); const requests = f.list.mock.calls.length;
    await act(async () => pending.resolve(success ? { ok: true, data: doc('uploaded') } : { ok: false, error: 'Fehler aus der vorherigen Akte' }));
    expect(host.textContent).not.toContain('Dokument wurde in der Akte gespeichert.');
    expect(host.textContent).not.toContain('Fehler aus der vorherigen Akte'); expect(host.querySelector('form')).toBeNull();
    expect(f.list).toHaveBeenCalledTimes(requests); expect(f.recordRefresh).not.toHaveBeenCalled();
  });
});
