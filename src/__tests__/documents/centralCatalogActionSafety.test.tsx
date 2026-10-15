// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { CentralCatalogWorkspace, type CentralCatalogWorkspaceProps } from '@/components/documents/CentralCatalogWorkspace.web';
import { findCentralDocument } from '@/data/seeds/documentCatalog/centralCatalog';
import { createCentralSnapshot } from '@/lib/documents/centralCatalogModel';
import { mapCentralContext } from '@/lib/documents/centralCatalogService';
import type { ServiceResult } from '@/types';
import type { CentralDocumentStored } from '@/types/documents/centralCatalog';

vi.mock('@/lib/documents/centralCatalogPdf', () => ({ renderCentralDocumentPdf: () => ({ bytes: new TextEncoder().encode('%PDF-1.7\nfixture\n%%EOF'), hash: 'a'.repeat(64), pageCount: 1 }) }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const tenantId = '11111111-1111-4111-8111-111111111111';
const clientId = '22222222-2222-4222-8222-222222222222';
const context = { ...mapCentralContext({ tenantId, target: 'client', entityId: clientId, company: { name: 'Unternehmen GmbH', street: 'Parkstraße 12', postal_code: '10115', city: 'Berlin' }, subject: { first_name: 'Mara', last_name: 'Muster' } }), procedure: { period: '2026-10-15' } };
const snapshot = createCentralSnapshot(findCentralDocument('csdc_einsatz_006')!, context, 'Anna');
const stored: CentralDocumentStored = { id: snapshot.documentId, tenantId, templateKey: snapshot.definition.key, title: snapshot.definition.title, revision: 1, snapshot, state: 'draft', pdfPath: 'draft.pdf', pdfHash: 'a'.repeat(64), createdAt: snapshot.createdAt };

function props(): CentralCatalogWorkspaceProps {
  return { tenantId, author: 'Anna', demo: true, clients: [{ id: clientId, label: 'Mara Muster' }], employees: [], loadingEntities: false,
    permissions: { create: true, preview: true, export: true, save: true }, records: [], loadingRecords: false,
    clientId, templateKey: snapshot.definition.key, loadContext: vi.fn(async () => ({ ok: true as const, data: context })),
    save: vi.fn(async () => ({ ok: true as const, data: stored })), download: vi.fn(), onSaved: vi.fn(), onRefresh: vi.fn() };
}

describe('catalogue asynchronous action safety (no layout assertion)', () => {
  it('saves only once and keeps the active editor visible until the response arrives', async () => {
    const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('about:blank');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    let finish!: (value: ServiceResult<CentralDocumentStored>) => void;
    const save = vi.fn(() => new Promise<ServiceResult<CentralDocumentStored>>((resolve) => { finish = resolve; }));
    const navigation = { guard: null as (() => boolean) | null };
    const input = { ...props(), save, onNavigationGuardChange: (guard: (() => boolean) | null) => { navigation.guard = guard; } };
    try {
      await act(async () => root.render(<CentralCatalogWorkspace {...input} />));
      const button = [...host.querySelectorAll<HTMLButtonElement>('button')].find((entry) => entry.textContent === 'Entwurf in Akte speichern')!;
      expect(button.disabled).toBe(false);
      await act(async () => { button.click(); button.click(); });
      expect(save).toHaveBeenCalledTimes(1);
      expect(navigation.guard?.()).toBe(false);
      const recordsTab = [...host.querySelectorAll<HTMLButtonElement>('.csdc-tabs button')][1];
      expect(recordsTab.disabled).toBe(true);
      await act(async () => recordsTab.click());
      expect(host.querySelector('.csdc-editor')).not.toBeNull();
      expect([...host.querySelectorAll<HTMLButtonElement>('.csdc-template')].every((entry) => entry.disabled)).toBe(true);
      await act(async () => finish({ ok: true, data: stored }));
      expect(input.onSaved).toHaveBeenCalledTimes(1);
      expect(navigation.guard?.()).toBe(true);
      expect(recordsTab.disabled).toBe(false);
      expect(button.textContent).toBe('Fassung gespeichert');
    } finally { await act(async () => root.unmount()); host.remove(); createUrl.mockRestore(); revokeUrl.mockRestore(); }
  });

  it('reopens a saved definition after its template has left the current catalogue', async () => {
    const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
    const archived = { ...stored, templateKey: 'archived-template', snapshot: { ...snapshot, definition: { ...snapshot.definition, key: 'archived-template', title: 'Gespeicherte frühere Vorlage' } } };
    const input = { ...props(), initialTab: 'records' as const, records: [archived] };
    try {
      await act(async () => root.render(<CentralCatalogWorkspace {...input} />));
      await act(async () => [...host.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Neue Fassung')!.click());
      expect(host.querySelector('.csdc-editor h2')?.textContent).toBe('Gespeicherte frühere Vorlage');
      expect(host.querySelector('.csdc-document-id')?.textContent).toContain('Fassung 2');
      expect(input.loadContext).not.toHaveBeenCalled();
    } finally { await act(async () => root.unmount()); host.remove(); }
  });

  it('deduplicates a stored file download and unlocks the action after failure', async () => {
    const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
    let finish!: (value: ServiceResult<Uint8Array>) => void;
    const download = vi.fn(() => new Promise<ServiceResult<Uint8Array>>((resolve) => { finish = resolve; }));
    const input = { ...props(), initialTab: 'records' as const, records: [stored], download };
    try {
      await act(async () => root.render(<CentralCatalogWorkspace {...input} />));
      const button = host.querySelector<HTMLButtonElement>('.csdc-record .csdc-button')!;
      await act(async () => { button.click(); button.click(); });
      expect(download).toHaveBeenCalledTimes(1);
      await act(async () => finish({ ok: false, error: 'Datei vorübergehend nicht erreichbar.' }));
      expect(button.disabled).toBe(false);
      expect(host.textContent).toContain('Datei vorübergehend nicht erreichbar.');
    } finally { await act(async () => root.unmount()); host.remove(); }
  });
});
