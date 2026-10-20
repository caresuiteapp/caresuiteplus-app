// @vitest-environment happy-dom
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CareIntakeDocumentsStepPanel } from '@/components/inputs/CareIntakeDocumentsStepPanel.web';
import { EMPTY_CLIENT_INTAKE_FORM, type ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { OPTIONAL_CONSENT_TEMPLATE_KEYS } from '@/features/intakeDocuments/intakeDocumentTypes';

const h = vi.hoisted(() => ({ save: vi.fn(), mode: 'supabase', templateLoad: vi.fn(), navigate: vi.fn(), phone: false }));
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
vi.mock('@/hooks/useTenantDisplayMeta', () => ({ useTenantDisplayMeta: () => ({ name: 'Testdienst', city: 'Berlin', zip: '10115', street: 'Testweg 1' }) }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => h.mode }));
vi.mock('@/features/intakeDocuments/intakeDocumentService', async importOriginal => ({ ...await importOriginal<typeof import('@/features/intakeDocuments/intakeDocumentService')>(), loadIntakeDocumentTemplates: h.templateLoad }));
// Keep the real signature modal and its portals. Only device APIs, the canvas
// output and catalog search are stubs; otherwise overlay regressions go unseen.
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
vi.mock('@/hooks/useDeviceClass', () => ({ useDeviceClass: () => ({ isPhone: h.phone, isTablet: false }) }));
vi.mock('@/hooks/useOrientation', () => ({ useOrientation: () => ({ isLandscape: true }) }));
vi.mock('@/components/layout/OrientationGate', () => ({ OrientationGate: ({ children }: any) => <>{children}</> }));
vi.mock('@/components/layout/platform/gradientmodalheader', () => ({ GradientModalHeader: ({ onClose }: any) => <button onClick={onClose}>Zeichnen abbrechen</button> }));
vi.mock('@/components/inputs/CareSignatureCanvas', () => ({ CareSignatureCanvas: ({ onConfirm }: any) => <button onClick={() => onConfirm(png)}>Zeichnung übernehmen</button> }));
vi.mock('@/components/ui', () => ({ PremiumInput: () => null, PremiumButton: () => null }));
vi.mock('@/components/inputs/CareCostCarrierTemplateSearch', () => ({ CareCostCarrierTemplateSearch: ({ onChange }: any) => <button type="button" onClick={() => onChange({ name: 'Test Pflegekasse', street: 'Kassenweg 1', zip: '10115', city: 'Berlin', ikNumber: '123456789', systemTemplateId: 'catalog-test', carrierType: 'pflegekasse' })}>Test Pflegekasse auswählen</button> }));
let host: HTMLDivElement, root: Root, latest: ClientIntakeFormData;
function Harness({ overrides = {} }: { overrides?: Partial<ClientIntakeFormData> }) {
  const [form, setForm] = useState<ClientIntakeFormData>(() => ({ ...structuredClone(EMPTY_CLIENT_INTAKE_FORM), firstName: 'Erika', lastName: 'Muster', dateOfBirth: '1950-01-01',
    street: 'Testweg', houseNumber: '4', zip: '10115', city: 'Berlin', phone: '030123456', emergencyContactName: 'Alex Muster', emergencyContactPhone: '0307654321', careContexts: ['daily_assistance'], intakeContractType: 'assist', careLevel: 'pg2', serviceStart: '2026-11-01',
    costBearerTypes: ['pflegekasse'], careFundName: 'Test Pflegekasse', insuranceNumber: 'A123456789', intakeAssignmentEnabled: true, intakeOptionalConsents: [...OPTIONAL_CONSENT_TEMPLATE_KEYS], ...overrides }));
  latest = form;
  return <CareIntakeDocumentsStepPanel form={form} errors={{}} tenantId="tenant-test" onChange={setForm} onPersistPackage={h.save} onNavigateSection={h.navigate} />;
}
function button(text: string) {
  const found = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(node => node.textContent?.includes(text));
  if (!found) throw new Error(`Button missing: ${text}`); return found;
}
async function click(text: string) { await act(async () => button(text).click()); }
async function remount(overrides: Partial<ClientIntakeFormData>) {
  await act(async () => root.unmount()); root = createRoot(host);
  await act(async () => root.render(<Harness overrides={overrides}/>));
}
async function fill(name: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function captureBoth() {
  await click('Gemeinsam unterschreiben');
  await click('Jetzt unterschreiben'); await click('Zeichnung übernehmen');
  await click('Jetzt unterschreiben'); await click('Zeichnung übernehmen');
  await act(async () => (document.querySelector('.cs-contract-acknowledgement input') as HTMLInputElement).click());
}
beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); h.mode = 'supabase'; h.phone = false; h.save.mockResolvedValue(true);
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
  it.each([false, true])('removes the covering package layer during real signature capture (phone=%s)', async phone => {
    h.phone = phone;
    await click('Gesamte Vorschau öffnen'); await click('Gemeinsam unterschreiben');
    await click('Jetzt unterschreiben');
    expect(document.querySelector('.cs-contract-backdrop')).toBeNull();
    expect(button('Zeichnung übernehmen')).toBeTruthy();
    await click('Zeichnung übernehmen');
    expect(document.querySelector('.cs-contract-dialog')).not.toBeNull();
    expect(document.querySelectorAll('.cs-contract-signature.is-captured')).toHaveLength(1);
    expect(h.save).not.toHaveBeenCalled();
  });
  it('returns from a cancelled drawing without losing the package or fabricating a signature', async () => {
    await click('Gesamte Vorschau öffnen'); await click('Gemeinsam unterschreiben'); await click('Jetzt unterschreiben');
    await click('Zeichnung übernehmen'); await click('Jetzt unterschreiben');
    await click('Zeichnen abbrechen');
    expect(document.querySelectorAll('.cs-contract-signature')).toHaveLength(2);
    expect(document.querySelectorAll('.cs-contract-signature.is-captured')).toHaveLength(1);
    expect(button('Unterzeichnetes Paket sichern').disabled).toBe(true);
  });
  it('recovers the four missing screenshot fields, reviews the updated package and saves both roles', async () => {
    await remount({ insuranceNumber: '', careFundName: '', emergencyContactName: '', emergencyContactPhone: '' });
    await click('Gesamte Vorschau öffnen');
    expect(document.querySelector('[role="alert"]')!.textContent).toContain('Versichertennummer');
    expect(document.querySelector('[role="alert"]')!.textContent).toContain('Pflegekasse');
    expect(Array.from(document.querySelectorAll('button')).some(node => node.textContent === 'Gemeinsam unterschreiben')).toBe(false);
    await click('Angaben ergänzen');
    await fill('insuranceNumber', 'B987654321'); await fill('emergencyContactName', 'Neue Kontaktperson'); await fill('emergencyContactPhone', '030987654');
    await click('Test Pflegekasse auswählen');
    expect(latest.insuranceNumber).toBe('');
    await click('Angaben übernehmen');
    expect(latest.insuranceNumber).toBe('B987654321');
    expect(latest.costBearerTemplateIds.pflegekasse).toBe('catalog-test');
    expect(latest.costBearerIk).toBe('123456789');
    expect(document.querySelector('iframe')!.srcdoc).toContain('Neue Kontaktperson');
    expect(document.querySelector('iframe')!.srcdoc).toContain('B987654321');
    await captureBoth(); await click('Unterzeichnetes Paket sichern');
    expect(h.save).toHaveBeenCalledTimes(1);
    expect(h.save.mock.calls[0][0].intakeDocuments.every((d: any) => d.status === 'finalized')).toBe(true);
  });
  it('keeps corrections open after the opening click completes its native button activation', async () => {
    await remount({ insuranceNumber: '', careFundName: '', emergencyContactName: '', emergencyContactPhone: '' });
    await click('Gesamte Vorschau öffnen');
    const opener = button('Angaben ergänzen');
    await act(async () => {
      opener.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    // Browsers run button activation after the click handlers/React update.
    // Happy DOM's click() snapshots type before dispatch and misses this case.
    await act(async () => {
      if (opener.isConnected && opener.type === 'submit') opener.form?.requestSubmit(opener);
    });
    expect(document.querySelector('input[name="insuranceNumber"]')).not.toBeNull();
    expect(document.querySelector('input[name="emergencyContactPhone"]')).not.toBeNull();
    expect(document.querySelector('iframe')).toBeNull();
    expect(h.save).not.toHaveBeenCalled();
  });
  it('removes only explicitly declined extras and then signs all remaining documents', async () => {
    await remount({ insuranceNumber: '', careFundName: '', emergencyContactName: '', emergencyContactPhone: '' });
    await click('Gesamte Vorschau öffnen'); await click('Angaben ergänzen');
    await click('Zusatzdokument aus Paket entfernen');
    expect(latest.intakeAssignmentEnabled).toBe(false);
    expect(latest.intakeOptionalConsents).toContain('emergency_contact_consent_default');
    await click('Angaben ergänzen'); await click('Zusatzdokument aus Paket entfernen');
    expect(latest.intakeOptionalConsents).not.toContain('emergency_contact_consent_default');
    expect(document.querySelectorAll('.cs-contract-index li')).toHaveLength(5);
    await captureBoth(); await click('Unterzeichnetes Paket sichern');
    expect(h.save.mock.calls[0][0].intakeDocuments).toHaveLength(5);
  });
  it('offers the original form section and never signs while required details are still missing', async () => {
    await remount({ insuranceNumber: '' });
    await click('Gesamte Vorschau öffnen'); await click('Angaben ergänzen'); await click('Angaben übernehmen');
    expect(button('Angaben ergänzen')).toBeTruthy(); expect(h.save).not.toHaveBeenCalled();
    await click('Angaben ergänzen'); await click('Im Aufnahmeformular ergänzen');
    expect(h.navigate).toHaveBeenCalledWith('kostentraeger');
    expect(document.querySelector('.cs-contract-dialog')).toBeNull();
  });
  it('adds a care fund only after an explicit choice and keeps carrier references together', async () => {
    await remount({ costBearerTypes: [], costBearerType: '', careFundName: '' });
    await click('Gesamte Vorschau öffnen'); await click('Angaben ergänzen');
    expect(latest.costBearerTypes).toEqual([]);
    const checkbox = document.querySelector<HTMLInputElement>('.cs-contract-carrier input[type="checkbox"]')!;
    expect(checkbox.checked).toBe(false);
    await act(async () => checkbox.click()); await click('Test Pflegekasse auswählen'); await click('Angaben übernehmen');
    expect(latest.costBearerTypes).toEqual(['pflegekasse']); expect(latest.costBearerType).toBe('pflegekasse');
    expect(latest.careFundName).toBe('Test Pflegekasse'); expect(latest.careFundStreet).toBe('Kassenweg 1');
    expect(button('Gemeinsam unterschreiben').disabled).toBe(false);
  });
  it('preserves a previously signed original and routes corrections through renewed review', async () => {
    await click('Gesamte Vorschau öffnen'); await captureBoth(); await click('Unterzeichnetes Paket sichern');
    const original = latest.intakeDocuments.find(d => d.documentType === 'privacy_consent')!;
    await remount({ insuranceNumber: '', intakeDocuments: [original] });
    await click('Gesamte Vorschau öffnen'); await click('Angaben ergänzen');
    expect(document.querySelector('input[name="insuranceNumber"]')).toBeNull();
    expect(document.body.textContent).toContain('Die bisherigen Originale bleiben erhalten');
    expect(latest.intakeDocuments.find(d => d.documentType === 'privacy_consent')?.finalizedHtml).toBe(original.finalizedHtml);
    await click('Im Aufnahmeformular ergänzen'); expect(h.navigate).toHaveBeenCalledWith('kostentraeger');
  });
});
