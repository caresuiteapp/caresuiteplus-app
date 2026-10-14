// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { CentralCatalogWorkspace, type CentralCatalogWorkspaceProps } from '@/components/documents/CentralCatalogWorkspace.web';
import { mapCentralContext } from '@/lib/documents/centralCatalogService';
import type { CentralDocumentSnapshot } from '@/types/documents/centralCatalog';

vi.mock('@/lib/documents/centralCatalogPdf', () => ({ renderCentralDocumentPdf: () => ({ bytes: new TextEncoder().encode('%PDF-1.7\nUI fixture\n%%EOF'), hash: 'a'.repeat(64), pageCount: 1 }) }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const T = '11111111-1111-4111-8111-111111111111', C = '22222222-2222-4222-8222-222222222222';

describe('document editor persistence interactions (no browser layout assertion)', () => {
  it('requires a concrete record choice for a repeated name and loads exactly that record', async () => {
    const otherId = '33333333-3333-4333-8333-333333333333';
    const element = document.createElement('div'); document.body.append(element); const root = createRoot(element);
    const loadContext = vi.fn(async (_target: string, id: string) => ({ ok: true as const, data: mapCentralContext({
      tenantId: T, target: 'client', entityId: id, company: { name: 'Unternehmen GmbH' }, subject: { first_name: 'Mara', last_name: 'Muster' },
    }) }));
    const props: CentralCatalogWorkspaceProps = {
      tenantId: T, author: 'Anna', demo: true, clients: [
        { id: C, label: 'Mara Muster', detail: 'Aufnahmeentwurf' },
        { id: otherId, label: 'Mara Muster', detail: 'Aktive Akte' },
        { id: C, label: 'Mara Muster', detail: 'Aufnahmeentwurf' },
      ], employees: [], loadingEntities: false, permissions: { create: true, preview: true, export: true, save: true },
      records: [], loadingRecords: false, templateKey: 'csdc_einsatz_006',
      loadContext, save: vi.fn(), download: vi.fn(), onSaved: vi.fn(), onRefresh: vi.fn(),
    };
    try {
      await act(async () => root.render(<CentralCatalogWorkspace {...props} />));
      const names = element.querySelector<HTMLSelectElement>('.csdc-entity select')!;
      expect([...names.options].filter((option) => option.textContent === 'Mara Muster')).toHaveLength(1);
      await act(async () => { names.value = C; names.dispatchEvent(new Event('change', { bubbles: true })); });
      expect(loadContext).not.toHaveBeenCalled();
      const records = element.querySelectorAll<HTMLSelectElement>('.csdc-entity select')[1];
      expect([...records.options].map((option) => option.value).sort()).toEqual(['', C, otherId].sort());
      await act(async () => { records.value = otherId; records.dispatchEvent(new Event('change', { bubbles: true })); });
      expect(loadContext).toHaveBeenCalledTimes(1);
      expect(loadContext.mock.calls[0][1]).toBe(otherId);
      expect(element.querySelector('.csdc-source')).not.toBeNull();
      // An existing deep link selects its exact record, including an Aufnahmeentwurf.
      await act(async () => root.render(<CentralCatalogWorkspace {...props} key="linked-draft" clientId={C} />));
      expect(loadContext.mock.calls.at(-1)?.[1]).toBe(C);
      expect(element.querySelectorAll<HTMLSelectElement>('.csdc-entity select')[1].value).toBe(C);
    } finally { await act(async () => root.unmount()); element.remove(); }
  });

  it('saves, refreshes stored data and appends a new revision without replacing individual input', async () => {
    const element = document.createElement('div'); document.body.append(element); const root = createRoot(element);
    const saved: CentralDocumentSnapshot[] = [];
    let companyName = 'Unternehmen GmbH';
    const objectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('about:blank');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const props: CentralCatalogWorkspaceProps = {
      tenantId: T, author: 'Anna', demo: true, clients: [{ id: C, label: 'Mara Muster' }], employees: [], loadingEntities: false,
      permissions: { create: true, preview: true, export: true, save: true }, records: [], loadingRecords: false,
      clientId: C, templateKey: 'csdc_einsatz_006',
      loadContext: async () => ({ ok: true, data: { ...mapCentralContext({ tenantId: T, target: 'client', entityId: C, company: { name: companyName, street: 'Parkstraße 12', postal_code: '10115', city: 'Berlin' }, subject: { first_name: 'Mara', last_name: 'Muster' } }), procedure: { period: '2026-10-13' } } }),
      save: async (snapshot) => { saved.push(structuredClone(snapshot)); return { ok: true, data: { id: snapshot.documentId, tenantId: T, title: snapshot.definition.title, templateKey: snapshot.definition.key, revision: snapshot.revision, snapshot, state: 'draft', pdfPath: 'draft.pdf', pdfHash: 'a'.repeat(64), createdAt: snapshot.createdAt } }; },
      download: vi.fn(), onSaved: vi.fn(), onRefresh: vi.fn(),
    };
    const button = (text: string) => [...element.querySelectorAll<HTMLButtonElement>('button')].find((entry) => entry.textContent === text)!;
    try {
      await act(async () => { root.render(<CentralCatalogWorkspace {...props} />); });
      const companyField = [...element.querySelectorAll('label')].find((label) => label.textContent?.startsWith('Unternehmen / Vertragspartner'))!.querySelector<HTMLInputElement>('input')!;
      const subjectField = [...element.querySelectorAll('label')].find((label) => label.textContent?.startsWith('Klient:in / Patient:in *'))!.querySelector<HTMLInputElement>('input')!;
      expect(companyField.value).toBe('Unternehmen GmbH');
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(subjectField, 'Individuelle Schreibweise');
        subjectField.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await act(async () => root.render(<CentralCatalogWorkspace {...props} author="Anna aktualisiert" loadContext={(...args) => props.loadContext(...args)} />));
      expect(subjectField.value).toBe('Individuelle Schreibweise');
      expect(button('Entwurf in Akte speichern').disabled).toBe(false);
      await act(async () => button('Entwurf in Akte speichern').click());
      expect(saved).toHaveLength(1); expect(saved[0].values.subjectName).toBe('Individuelle Schreibweise');
      companyName = 'Aktualisiertes Unternehmen GmbH';
      await act(async () => button('Stammdaten aktualisieren').click());
      expect(companyField.value).toBe('Aktualisiertes Unternehmen GmbH'); expect(subjectField.value).toBe('Individuelle Schreibweise');
      await act(async () => button('Entwurf in Akte speichern').click());
      expect(saved).toHaveLength(2); expect(saved[1].revision).toBe(2); expect(saved[1].parentDocumentId).toBe(saved[0].documentId);
      expect(saved[1].documentId).not.toBe(saved[0].documentId); expect(saved[1].context.entityId).toBe(C);
    } finally { await act(async () => root.unmount()); element.remove(); objectUrl.mockRestore(); revokeUrl.mockRestore(); }
  });
});
