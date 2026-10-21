// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsultationWorkspaceView } from '@/features/beratung/ConsultationWorkspace.web';
import { activateConsultationDraftScope, clearConsultationDrafts, readConsultationContactDraft } from '@/lib/beratung/workspaceDrafts';
import { consultationContactErrors, consultationContactForm, emptyConsultationContact } from '@/lib/beratung/firstContact';
import type { ConsultationWorkspace } from '@/lib/beratung/workspaceModel';
const h = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('@/lib/clients/repositories/clientIntakeDraftWriter.supabase', () => ({ upsertClientIntakeDraft: h.save }));
const tenant = '11111111-1111-4111-8111-111111111111';
const scope = `${tenant}:office`;
const existing = { id: '22222222-2222-4222-8222-222222222222', name: 'Maria Beispiel', address: 'Musterweg 2, 12345 Berlin', phone: '0301234567', care_grade: '', payer: '', insurance_number: '', access_notes: '', notes: '' };
const workspace: ConsultationWorkspace = { capabilities: { teamTemplates: true, followUps: true, centralContact: true }, canManage: true, canReview: true, canQualify: false, employeeView: false, cases: [], encounters: [], clients: [existing], employees: [], events: [], revisions: [] };
let root: Root, host: HTMLDivElement;
const command = vi.fn(), reload = vi.fn(), openCase = vi.fn();
async function render(canCreateClient = true) {
  await act(async () => root.render(<ConsultationWorkspaceView workspace={workspace} loading={false} busy={false} error={null} notice={null} employeeView={false}
    tenantId={tenant} draftScope={scope} canCreateClient={canCreateClient} createInitially onCommand={command} onReload={reload} onOpenCase={openCase} />));
}
async function input(label: string, value: string) {
  const field = [...host.querySelectorAll('label')].find(el => el.querySelector('span')?.textContent === label)?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea');
  expect(field, label).toBeTruthy();
  await act(async () => {
    const proto = field!.tagName === 'SELECT' ? HTMLSelectElement.prototype : field!.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(field, value);
    field!.dispatchEvent(new Event(field!.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  });
}
async function click(text: string) {
  const button = [...host.querySelectorAll('button')].find(el => el.textContent === text);
  expect(button, text).toBeTruthy(); await act(async () => button!.click());
}
async function newContact() { await input('Klientin / Klient', '__new__'); }
async function fill() { await input('Vorname', 'Lina'); await input('Nachname *', 'Muster'); await input('Telefon', '0307654321'); }
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  clearConsultationDrafts(); activateConsultationDraftScope(scope);
  vi.clearAllMocks();
  h.save.mockImplementation(async (_tenant, _form, options) => ({ ok: true, data: { clientId: options.clientId } }));
  command.mockResolvedValue({ case_id: 'case-1', encounter_id: 'visit-1' });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); clearConsultationDrafts(); });

describe('central first contact from consultation', () => {
  it('saves central first-contact data and uses that exact client ID for the new case', async () => {
    await render(); await newContact(); await fill();
    await input('Straße', 'Musterstraße'); await input('Hausnummer', '9'); await input('Postleitzahl', '12345'); await input('Ort', 'Berlin');
    await input('Abweichende Kontaktperson', 'Tochter Anna'); await input('Anliegen / erste Hinweise', 'Fragen zum ersten Besuch.');
    await click('Eckdaten speichern & übernehmen');
    expect(h.save).toHaveBeenCalledTimes(1);
    const [savedTenant, form, options] = h.save.mock.calls[0];
    expect(savedTenant).toBe(tenant);
    expect(form).toMatchObject({ firstName: 'Lina', lastName: 'Muster', street: 'Musterstraße', houseNumber: '9', zip: '12345', city: 'Berlin',
      intakeStage: 'first_contact', intakeWorkflowVersion: 2, careContexts: ['consulting'], intakeAppointmentRequested: false, consentVertrag: false, consentDatenschutz: false });
    expect(options).toMatchObject({ expectedRevision: 0 });
    expect(host.querySelector('.cw-contact-saved a')?.getAttribute('href')).toBe(`/business/office/clients/new?draftId=${options.clientId}`);
    await click('Fallakte anlegen');
    expect(command).toHaveBeenCalledWith('create', expect.objectContaining({ client_id: options.clientId, preparation: 'Kontaktperson: Tochter Anna\nFragen zum ersten Besuch.' }));
    expect(openCase).toHaveBeenCalledWith('case-1', 'visit-1');
    expect(readConsultationContactDraft(scope)).toBeNull();
  });
  it('retains an unconfirmed write unchanged across closing and reopening', async () => {
    h.save.mockResolvedValueOnce({ ok: false, error: 'Antwort verloren', rejected: false });
    await render(); await newContact(); await fill(); await click('Eckdaten speichern & übernehmen');
    expect(host.querySelector('fieldset')?.disabled).toBe(true);
    const first = h.save.mock.calls[0];
    await act(async () => root.render(null)); await render(); await newContact();
    expect(host.textContent).toContain('Die letzte Speicherung ist noch offen');
    await click('Speicherung erneut prüfen');
    expect(h.save.mock.calls[1]).toEqual(first);
    expect(host.textContent).toContain('Eckdaten unter „Klienten“ gespeichert');
  });
  it('keeps the saved central record selected when creating the case fails', async () => {
    command.mockResolvedValueOnce(null);
    await render(); await newContact(); await fill(); await click('Eckdaten speichern & übernehmen');
    await click('Fallakte anlegen'); await click('Fallakte anlegen');
    expect(h.save).toHaveBeenCalledTimes(1);
    expect(command).toHaveBeenCalledTimes(2);
    expect(command.mock.calls[0][1].client_id).toBe(command.mock.calls[1][1].client_id);
  });
  it('offers matching existing contacts without writing a second record', async () => {
    await render(); await newContact(); await input('Vorname', 'Maria'); await input('Nachname *', 'Beispiel');
    expect(host.textContent).toContain('Möglicherweise bereits vorhanden');
    await act(async () => host.querySelector<HTMLButtonElement>('.cw-contact-match')!.click());
    await click('Fallakte anlegen');
    expect(h.save).not.toHaveBeenCalled();
    expect(command).toHaveBeenCalledWith('create', expect.objectContaining({ client_id: existing.id }));
  });
  it('validates required data and permits editing after a definite rejected write', async () => {
    await render(); await newContact(); await click('Eckdaten speichern & übernehmen');
    expect(h.save).not.toHaveBeenCalled(); expect(host.querySelector('[aria-invalid=true]')).toBeTruthy();
    await fill(); h.save.mockResolvedValueOnce({ ok: false, error: 'Keine Berechtigung', rejected: true });
    await click('Eckdaten speichern & übernehmen');
    expect(host.querySelector('fieldset')?.disabled).toBe(false);
    await input('Vorname', 'Lena'); await click('Eckdaten speichern & übernehmen');
    expect(h.save.mock.calls[1][1].firstName).toBe('Lena');
    expect(h.save.mock.calls[1][2].clientId).toBe(h.save.mock.calls[0][2].clientId);
    expect(h.save.mock.calls[1][2].operationId).not.toBe(h.save.mock.calls[0][2].operationId);
  });
  it('does not offer creation without the central intake permissions', async () => {
    await render(false);
    expect(host.querySelector<HTMLOptionElement>('option[value="__new__"]')?.disabled).toBe(true);
    await input('Klientin / Klient', existing.id); await click('Fallakte anlegen');
    expect(h.save).not.toHaveBeenCalled();
  });
  it('clears contact drafts on actor/tenant changes and logout', async () => {
    await render(); await newContact(); await fill();
    expect(readConsultationContactDraft(scope)?.input.lastName).toBe('Muster');
    activateConsultationDraftScope('different-tenant:actor');
    expect(readConsultationContactDraft(scope)).toBeNull();
    clearConsultationDrafts(); expect(readConsultationContactDraft('different-tenant:actor')).toBeNull();
  });
  it('accepts a partial email contact and leaves intake documents and consents open', () => {
    const input = { ...emptyConsultationContact(), lastName: ' Muster ', email: ' kontakt@example.invalid ' };
    expect(consultationContactErrors(input)).toEqual({});
    const form = consultationContactForm(input);
    expect(form.lastName).toBe('Muster'); expect(form.email).toBe('kontakt@example.invalid');
    expect(form.intakeDocuments).toEqual([]); expect(form.consentDatenschutz).toBe(false);
    expect(consultationContactErrors({ ...input, dateOfBirth: '2026-02-30' }).dateOfBirth).toBeTruthy();
  });
});
