// @vitest-environment happy-dom
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NewConversation } from '@/components/office/messages/NewConversation.web';
import { MessageComposer } from '@/components/office/messages/MessageComposer.web';
import { useMessageResource, type MessageDraft } from '@/hooks/useMessageWorkspace.web';

const h = vi.hoisted(() => ({ create: vi.fn(), send: vi.fn(), created: vi.fn(), changed: vi.fn(), dirty: vi.fn(), busy: vi.fn(), close: vi.fn(), voiceStart: vi.fn(), voiceStop: vi.fn() }));
vi.mock('@/lib/office/clientListService', () => ({ fetchClientList: async () => ({ ok: true, data: [] }) }));
vi.mock('@/lib/office/employeeListService', () => ({ fetchEmployeeList: async () => ({ ok: true, data: [{ id: 'a', firstName: 'Mara', lastName: 'Sommer', status: 'aktiv', jobTitle: 'pflegefachkraft' }, { id: 'b', firstName: 'Ben', lastName: 'Winter', status: 'aktiv', jobTitle: 'pflegefachkraft' }, { id: 'old', firstName: 'Archiv', lastName: 'Alt', status: 'archiviert' }] }) }));
vi.mock('@/lib/auth/accessManagementService', () => ({ fetchInternalUsersList: async () => ({ ok: true, data: [{ id: 'internal-live', displayName: 'Echte Verwaltung', status: 'active', roleKey: 'business_manager' }] }) }));
vi.mock('@/lib/office/messagethreadservice', () => ({ fetchOfficeMessageCategories: async () => ({ ok: true, data: [] }) }));
vi.mock('@/lib/office/messageWorkspaceService.web', () => ({ createConversation: h.create, sendWorkspaceMessage: h.send }));
vi.mock('@/lib/office/officemessagerealtime', () => ({ subscribeToOfficeMessageInbox: () => () => {} }));
vi.mock('@/lib/office/messageQuickReplyTemplateService', () => ({ listQuickReplyTemplates: async () => ({ ok: true, data: [] }) }));
vi.mock('@/hooks/communication/useVoiceMessage.web', () => ({ useVoiceMessage: () => ({ isRecording: false, isSupported: true, durationSeconds: 0, start: h.voiceStart, stop: h.voiceStop, cancel: vi.fn() }) }));

let root: Root; let host: HTMLDivElement;
const actor = { tenantId: 'tenant-a', profileId: 'profile-a', roleKey: 'business_admin' as const };
const preferences = { attachmentsEnabled: true, voiceMessagesEnabled: true, internalNotesEnabled: true, emojisEnabled: true, showReadReceipts: true };
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); h.create.mockReset().mockResolvedValue({ ok: true, data: { id: 'created-thread' } }); h.send.mockReset().mockResolvedValue({ ok: true, data: { id: 'sent' } });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.open = true; });
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) { this.open = false; });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
const renderNew = (mode: 'employee' | 'group' | 'internal' = 'employee') => act(async () => root.render(<StrictMode><NewConversation actor={actor} mode={mode} onClose={h.close} onCreated={h.created} onDirtyChange={h.dirty} onBusyChange={h.busy} /></StrictMode>));
const btn = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.includes(text))!;
async function field(label: string, value: string) {
  const control = document.getElementById([...document.querySelectorAll('label')].find(item => item.textContent?.startsWith(label))!.htmlFor) as HTMLInputElement | HTMLTextAreaElement;
  await act(async () => { Object.getOwnPropertyDescriptor(control.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(control, value); control.dispatchEvent(new Event('input', { bubbles: true })); });
}
async function submit() { await act(async () => { document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }); }
describe('conversation creation workflows', () => {
  it('uses live recipients, ignores archived people, prevents double submit and preserves a failed first message', async () => {
    let finish!: (result: unknown) => void; h.create.mockReturnValue(new Promise(resolve => { finish = resolve; })); h.send.mockResolvedValue({ ok: false, error: 'offline' });
    await renderNew(); expect(document.body.textContent).toContain('Mara Sommer'); expect(document.body.textContent).not.toContain('Archiv Alt');
    await act(async () => btn('Mara Sommer').click()); await field('Betreff', 'Übergabe'); await field('Erste Nachricht', 'Bitte Rückmeldung');
    await act(async () => { const form = document.querySelector('form')!; form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(h.create).toHaveBeenCalledOnce(); expect(btn('Abbrechen').disabled).toBe(true);
    await act(async () => finish({ ok: true, data: { id: 'created-thread' } }));
    expect(h.created).toHaveBeenCalledExactlyOnceWith('created-thread', expect.objectContaining({ text: 'Bitte Rückmeldung', error: 'offline', operation: expect.objectContaining({ body: 'Bitte Rückmeldung' }) }));
  });
  it('keeps the same group operation after a partial failure and locks the original recipient selection', async () => {
    h.create.mockResolvedValueOnce({ ok: false, error: 'Teilnehmer noch unvollständig' }).mockResolvedValueOnce({ ok: true, data: { id: 'group' } });
    await renderNew('group'); await act(async () => { btn('Mara Sommer').click(); btn('Ben Winter').click(); }); await field('Gruppenname', 'Team Nord'); await submit();
    const first = h.create.mock.calls[0][1]; expect(first.input.employeeParticipantIds).toEqual(['a', 'b']); expect(btn('Einrichtung fortsetzen')).toBeTruthy();
    expect(document.querySelector<HTMLButtonElement>('[role="checkbox"]')!.disabled).toBe(true);
    await submit(); expect(h.create.mock.calls[1][1]).toBe(first); expect(h.created).toHaveBeenCalledOnce(); expect(h.send).not.toHaveBeenCalled();
  });
  it('uses actual internal profiles and respects cancelling a dirty dialog', async () => {
    await renderNew('internal'); expect(document.body.textContent).toContain('Echte Verwaltung'); await act(async () => btn('Echte Verwaltung').click());
    vi.mocked(window.confirm).mockReturnValue(false); await act(async () => btn('Abbrechen').click()); expect(h.close).not.toHaveBeenCalled(); expect(h.dirty).toHaveBeenLastCalledWith(true);
  });
});
describe('composer and request isolation', () => {
  const renderComposer = (draft: MessageDraft) => act(async () => root.render(<MessageComposer actor={actor} draft={draft} onChange={h.changed} onSend={h.send} sending={false} canNote canVoice onBusyChange={h.busy} onOpenTemplates={vi.fn()} preferences={preferences} templateVersion={0} />));
  it('keeps Enter for new lines, sends with Ctrl+Enter and exposes a safe retry for a frozen operation', async () => {
    await renderComposer({ text: 'Hallo', internal: false, attachments: [] });
    const textarea = host.querySelector('textarea')!; await act(async () => { textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }); expect(h.send).not.toHaveBeenCalled();
    await act(async () => { textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })); }); expect(h.send).toHaveBeenCalledOnce();
    await renderComposer({ text: 'Hallo', internal: false, attachments: [], operation: { id: 'same-id', body: 'Hallo', internal: false, attachments: [] }, error: 'Noch nicht bestätigt' });
    expect(host.querySelector('textarea')!.disabled).toBe(true); expect(btn('Versand fortsetzen').disabled).toBe(false); expect(host.textContent).toContain('Noch nicht bestätigt');
  });
  it('validates dropped files and retains valid attachments alongside a rejected file', async () => {
    await renderComposer({ text: 'Text bleibt', internal: false, attachments: [] });
    const event = new Event('drop', { bubbles: true, cancelable: true }); Object.defineProperty(event, 'dataTransfer', { value: { files: [{ name: 'plan.pdf', type: 'application/pdf', size: 3, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }, { name: 'programm.exe', type: 'application/octet-stream', size: 3 }] } });
    await act(async () => host.querySelector('.mw-composer')!.dispatchEvent(event));
    expect(h.changed).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'Text bleibt', attachments: [expect.objectContaining({ fileName: 'plan.pdf' })] })); expect(host.querySelector('[role="alert"]')!.textContent).toContain('programm.exe');
  });
  it('discards a late result from the previous organisation', async () => {
    let finish!: (value: any) => void; const slow = new Promise<any>(resolve => { finish = resolve; });
    function Probe({ scope }: { scope: string }) { const resource = useMessageResource<string>(scope, () => scope === 'a' ? slow : Promise.resolve({ ok: true, data: 'Organisation B' })); return <div>{resource.data || 'Laden'}</div>; }
    await act(async () => root.render(<Probe scope="a" />)); await act(async () => root.render(<Probe scope="b" />)); expect(host.textContent).toBe('Organisation B');
    await act(async () => finish({ ok: true, data: 'Geheime Daten A' })); expect(host.textContent).toBe('Organisation B');
  });
});
