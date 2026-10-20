// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { TenantCustomFieldDefinition } from '@/types/tenant/tenantCenter';

const api = vi.hoisted(() => ({ save: vi.fn(), canEdit: true }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ roleKey: 'business_admin', can: () => api.canEdit }) }));
vi.mock('@/lib/tenant/tenantCustomFieldService', () => ({ saveTenantCustomFieldDefinition: api.save, resolveCustomFieldPlaceholder: (key: string) => `{{tenant.custom.${key}}}` }));
vi.mock('@/components/layout/platform/platformmodal', () => ({ PlatformModal: (props: { title: string; onClose: () => void; children: React.ReactNode; footerContent: React.ReactNode }) => <dialog open><h2>{props.title}</h2><button type="button" aria-label="Fenster schließen" onClick={props.onClose}>×</button>{props.children}{props.footerContent}</dialog> }));

import { TenantCustomFieldWizardModal } from '@/components/tenant/TenantCustomFieldWizardModal.web';

let root: Root;
let host: HTMLDivElement;
const onClose = vi.fn();
const onSaved = vi.fn();
const existing: TenantCustomFieldDefinition = { id: 'field-1', groupId: null, fieldKey: 'kunden_nr', label: 'Kundennummer', dataType: 'text', moduleKey: null, functionKey: 'documents', visibility: { office: true, portal: false }, validation: { required: false }, isActive: true, sortOrder: 0 };

async function render(field?: TenantCustomFieldDefinition, visible = true) {
  await act(async () => root.render(<TenantCustomFieldWizardModal visible={visible} tenantId="tenant-a" field={field} onClose={onClose} onSaved={onSaved} />));
}

function control(label: string): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  const target = [...host.querySelectorAll('label')].find(node => node.textContent?.startsWith(label));
  expect(target, label).toBeTruthy();
  return (target?.getAttribute('for') ? document.getElementById(target.getAttribute('for')!) : target?.querySelector('input')) as HTMLInputElement;
}

async function change(label: string, value: string) {
  const node = control(label);
  const prototype = node.tagName === 'SELECT' ? HTMLSelectElement.prototype : node.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(node, value);
    node.dispatchEvent(new Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  });
}

async function click(label: string) {
  const button = [...host.querySelectorAll('button')].find(node => node.textContent === label || node.getAttribute('aria-label') === label);
  expect(button, label).toBeTruthy();
  await act(async () => button!.click());
}

async function submit() {
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}

beforeEach(() => {
  vi.clearAllMocks(); api.canEdit = true; api.save.mockResolvedValue({ ok: true, data: [existing] });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it('validates incomplete input locally, then saves a German labeled selection with its choices', async () => {
  await render(); await submit();
  expect(api.save).not.toHaveBeenCalled(); expect(host.textContent).toContain('Bitte geben Sie dem Feld eine Bezeichnung.');
  await change('Bezeichnung', 'Bevorzugter Kontaktweg');
  await change('Art der Eingabe', 'select');
  await submit(); expect(api.save).not.toHaveBeenCalled();
  await change('Auswahlmöglichkeiten', 'Telefon\nE-Mail');
  await act(async () => control('Portale').click());
  await submit();
  expect(api.save).toHaveBeenCalledWith('tenant-a', expect.objectContaining({ fieldKey: 'bevorzugter_kontaktweg', dataType: 'select', validation: { required: false, options: ['Telefon', 'E-Mail'] }, visibility: { office: true, portal: true } }), 'business_admin');
  expect(onSaved).toHaveBeenCalledWith([existing]); expect(onClose).toHaveBeenCalledTimes(1);
});

it('protects both footer cancel and window close and resets when reopened', async () => {
  await render(); await change('Bezeichnung', 'Neues Feld');
  await click('Abbrechen'); expect(onClose).not.toHaveBeenCalled(); expect(host.textContent).toContain('Änderungen verwerfen?');
  await click('Weiter bearbeiten'); expect(control('Bezeichnung').value).toBe('Neues Feld');
  await click('Fenster schließen'); expect(onClose).not.toHaveBeenCalled();
  await click('Verwerfen und schließen'); expect(onClose).toHaveBeenCalledTimes(1);
  await render(undefined, false); await render(); expect(control('Bezeichnung').value).toBe('');
});

it('keeps existing references stable while saving changed names and visibility', async () => {
  await render(existing); expect(control('Art der Eingabe').disabled).toBe(true); expect(control('Schlüssel').disabled).toBe(true);
  await change('Bezeichnung', 'Interne Kundennummer');
  await act(async () => control('Pflichtfeld').click());
  await submit(); expect(api.save).toHaveBeenCalledWith('tenant-a', expect.objectContaining({ id: 'field-1', fieldKey: 'kunden_nr', label: 'Interne Kundennummer', validation: { required: true } }), 'business_admin');
});

it('retains input after service failures and unexpected rejections', async () => {
  api.save.mockResolvedValueOnce({ ok: false, error: 'Feldname bereits vergeben.' }).mockRejectedValueOnce(new Error('network'));
  await render(); await change('Bezeichnung', 'Kontaktweg'); await submit();
  expect(host.textContent).toContain('Feldname bereits vergeben.'); expect(control('Bezeichnung').value).toBe('Kontaktweg'); expect(onClose).not.toHaveBeenCalled();
  await submit(); expect(host.textContent).toContain('Ihre Eingaben bleiben erhalten.'); expect(control('Bezeichnung').value).toBe('Kontaktweg');
});

it('prevents writes without permission and duplicate saves while a request is pending', async () => {
  api.canEdit = false; await render(); await submit(); expect(api.save).not.toHaveBeenCalled();
  expect(host.textContent).toContain('Sie haben keine Berechtigung');
  api.canEdit = true; await render(); await change('Bezeichnung', 'Aktenzeichen');
  let resolve!: (result: unknown) => void; api.save.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await submit(); await submit(); await click('Fenster schließen');
  expect(api.save).toHaveBeenCalledTimes(1); expect(onClose).not.toHaveBeenCalled();
  await act(async () => resolve({ ok: true, data: [existing] })); expect(onClose).toHaveBeenCalledTimes(1);
});

it('ignores completion after switching to another field or company', async () => {
  let resolve!: (result: unknown) => void; api.save.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await render(); await change('Bezeichnung', 'Aktenzeichen'); await submit();
  await render(existing); await act(async () => resolve({ ok: true, data: [] }));
  expect(onClose).not.toHaveBeenCalled(); expect(onSaved).not.toHaveBeenCalled(); expect(control('Bezeichnung').value).toBe(existing.label);
});

it('deactivates existing fields without deleting them and can reactivate an inactive field', async () => {
  await render(existing); await act(async () => control('Feld aktiv verwenden').click()); await submit();
  expect(api.save).toHaveBeenLastCalledWith('tenant-a', expect.objectContaining({ id: existing.id, isActive: false }), 'business_admin');
  await render(undefined, false); await render({ ...existing, isActive: false });
  expect((control('Feld aktiv verwenden') as HTMLInputElement).checked).toBe(false);
  await act(async () => control('Feld aktiv verwenden').click()); await submit();
  expect(api.save).toHaveBeenLastCalledWith('tenant-a', expect.objectContaining({ id: existing.id, isActive: true }), 'business_admin');
});

it('retains a confirmed saved ID after list refresh failure and retries as an update with a stable key and type', async () => {
  api.save.mockResolvedValueOnce({ ok: false, savedId: 'confirmed-new-id', error: 'Das Zusatzfeld wurde gespeichert, aber die aktualisierte Liste konnte nicht geladen werden.' });
  await render(); await change('Bezeichnung', 'Aktenzeichen'); await submit();
  expect(api.save.mock.calls[0][1].id).toBeUndefined(); expect(host.textContent).toContain('Feld gespeichert · Liste nicht aktualisiert');
  expect(control('Schlüssel').disabled).toBe(true); expect(control('Art der Eingabe').disabled).toBe(true); expect(onSaved).not.toHaveBeenCalled();
  await change('Bezeichnung', 'Interne Akte'); await submit();
  expect(api.save).toHaveBeenLastCalledWith('tenant-a', expect.objectContaining({ id: 'confirmed-new-id', fieldKey: 'aktenzeichen', label: 'Interne Akte', dataType: 'text' }), 'business_admin');
  expect(onSaved).toHaveBeenCalledOnce();
});
