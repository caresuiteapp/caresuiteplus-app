// @vitest-environment happy-dom
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CareIntakeDocumentsStepPanel } from '@/components/inputs/CareIntakeDocumentsStepPanel.web';
import { EMPTY_CLIENT_INTAKE_FORM, type ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { OPTIONAL_CONSENT_TEMPLATE_KEYS } from '@/features/intakeDocuments/intakeDocumentTypes';

const h = vi.hoisted(() => ({ save: vi.fn(), mode: 'supabase', templateLoad: vi.fn() }));
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
vi.mock('@/hooks/useTenantDisplayMeta', () => ({ useTenantDisplayMeta: () => ({ name: 'Testdienst', city: 'Berlin', zip: '10115', street: 'Testweg 1' }) }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => h.mode }));
vi.mock('@/features/intakeDocuments/intakeDocumentService', async importOriginal => ({ ...await importOriginal<typeof import('@/features/intakeDocuments/intakeDocumentService')>(), loadIntakeDocumentTemplates: h.templateLoad }));
vi.mock('@/components/inputs/CareSignatureModal', () => ({ CareSignatureModal: ({ label, onConfirm }: any) => <div role="dialog" aria-label={label}><button onClick={() => onConfirm(png)}>Zeichnung übernehmen</button></div> }));
let host: HTMLDivElement, root: Root, latest: ClientIntakeFormData;
function Harness() {
  const [form, setForm] = useState<ClientIntakeFormData>(() => ({ ...structuredClone(EMPTY_CLIENT_INTAKE_FORM), firstName: 'Erika', lastName: 'Muster', dateOfBirth: '1950-01-01',
    street: 'Testweg', houseNumber: '4', zip: '10115', city: 'Berlin', phone: '030123456', emergencyContactName: 'Alex Muster', emergencyContactPhone: '0307654321', careContexts: ['daily_assistance'], intakeContractType: 'assist', careLevel: 'pg2', serviceStart: '2026-11-01',
    costBearerTypes: ['pflegekasse'], careFundName: 'Test Pflegekasse', insuranceNumber: 'A123456789', intakeAssignmentEnabled: true, intakeOptionalConsents: [...OPTIONAL_CONSENT_TEMPLATE_KEYS] }));
  latest = form;
  return <CareIntakeDocumentsStepPanel form={form} errors={{}} tenantId="tenant-test" onChange={setForm} onPersistPackage={h.save} />;
}
function button(text: string) {
  const found = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(node => node.textContent?.includes(text));
  if (!found) throw new Error(`Button missing: ${text}`); return found;
}
async function click(text: string) { await act(async () => button(text).click()); }
async function captureBoth() {
  await click('Gemeinsam unterschreiben');
  await click('Jetzt unterschreiben'); await click('Zeichnung übernehmen');
  await click('Jetzt unterschreiben'); await click('Zeichnung übernehmen');
  await act(async () => (document.querySelector('.cs-contract-acknowledgement input') as HTMLInputElement).click());
}
beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); h.mode = 'supabase'; h.save.mockResolvedValue(true);
  h.templateLoad.mockImplementation(async (_tenant, form) => ({ ok: true, data: (await import('@/features/intakeDocuments/buildIntakeDocumentContext')).listApplicableIntakeTemplates(form) }));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<Harness />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('package preview and shared signature interaction', () => {
  it('opens every selection together in exactly one preview and cannot finish with one signature', async () => {
    await click('Gesamte Vorschau öffnen');
    const frame = document.querySelector('iframe')!;
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
    expect(frame.srcdoc.match(/class="package-label"/g)).toHaveLength(7);
    expect(document.querySelectorAll('.cs-contract-index li')).toHaveLength(7);
    await click('Gemeinsam unterschreiben');
    expect(document.querySelectorAll('.cs-contract-signature')).toHaveLength(2);
    await click('Jetzt unterschreiben'); await click('Zeichnung übernehmen');
    expect(button('Unterzeichnetes Paket sichern').disabled).toBe(true);
    expect(h.save).not.toHaveBeenCalled();
  });
  it('saves the exact signed package once and reopens the same locked originals', async () => {
    await click('Gesamte Vorschau öffnen'); await captureBoth(); await click('Unterzeichnetes Paket sichern');
    expect(h.save).toHaveBeenCalledTimes(1);
    const saved = h.save.mock.calls[0][0] as ClientIntakeFormData;
    expect(saved.intakeDocuments).toHaveLength(7); expect(saved.intakeDocuments.every(d => d.status === 'finalized')).toBe(true);
    expect(saved.intakeDocuments.find(d => d.documentType === 'client_contract')?.signatures.employee?.dataUrl).toBe(png);
    expect(document.body.textContent).toContain('im Unternehmen gespeichert');
    await click('Fertig'); await click('Gesamte Vorschau öffnen');
    expect(document.body.textContent).not.toContain('Gemeinsam unterschreiben');
    expect(latest.intakeDocuments.map(d => d.finalizedHtml)).toEqual(saved.intakeDocuments.map(d => d.finalizedHtml));
  });
  it('retains both captures on a save failure and retries the identical payload', async () => {
    h.save.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await click('Gesamte Vorschau öffnen'); await captureBoth(); await click('Unterzeichnetes Paket sichern');
    expect(document.body.textContent).toContain('Speicherung noch offen');
    expect(document.body.textContent).not.toContain('im Unternehmen gespeichert');
    await click('Erneut sichern');
    expect(h.save).toHaveBeenCalledTimes(2);
    expect(h.save.mock.calls[1][0]).toBe(h.save.mock.calls[0][0]);
    expect(document.body.textContent).toContain('im Unternehmen gespeichert');
  });
  it('blocks signing if tenant templates could not be loaded', async () => {
    h.templateLoad.mockResolvedValue({ ok: false, error: 'Vorlagen nicht erreichbar' });
    await act(async () => root.unmount()); root = createRoot(host); await act(async () => root.render(<Harness />));
    expect(button('Gesamte Vorschau öffnen').disabled).toBe(true);
    expect(document.body.textContent).toContain('Vorlagen nicht erreichbar');
  });
});
