// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ConversationView } from '@/components/office/messages/ConversationView.web';

const h = vi.hoisted(() => ({ detail: {} as any, load: vi.fn(), read: vi.fn(), change: vi.fn(), remove: vi.fn(), changed: vi.fn(), busy: vi.fn() }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ can: () => true }) }));
vi.mock('@/lib/office/messageWorkspaceService.web', () => ({ loadConversation: h.load, loadConversationMessages: async () => ({ ok: true, data: { items: [], hasMore: false } }), loadConversationAttachments: async () => ({ ok: true, data: [] }), markConversationRead: h.read, updateConversation: h.change, removeConversationMessage: h.remove }));
vi.mock('@/lib/office/messagethreadservice', () => ({ fetchOfficeMessageCategories: async () => ({ ok: true, data: [] }) }));
vi.mock('@/lib/office/officemessagerealtime', () => ({ subscribeToOfficeMessageThread: () => () => {} }));
vi.mock('@/lib/office/officemessageauditservice', () => ({ auditFromThread: () => ({}), logOfficeMessageAuditEvent: async () => ({ ok: true }) }));
vi.mock('@/components/office/messages/MessageComposer.web', () => ({ MessageComposer: () => <textarea aria-label="Schreibbereich" /> }));
vi.mock('@/components/office/messages/MessageAttachments.web', () => ({ MessageFile: () => null }));

let root: Root; let host: HTMLDivElement;
const actor = { tenantId: 'tenant-a', profileId: 'me', roleKey: 'business_admin' as const };
const preferences = { attachmentsEnabled: true, voiceMessagesEnabled: true, internalNotesEnabled: true, emojisEnabled: true, showReadReceipts: true };
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks();
  h.detail = { id: 'thread', tenantId: 'tenant-a', threadType: 'employee_office', employeeName: 'Mara Sommer', subject: 'Übergabe', status: 'received', priority: 'normal', isClosed: false, canReply: true, createdAt: '2026-10-15T10:00:00Z', updatedAt: '2026-10-15T10:00:00Z', messages: [{ id: 'incoming', threadId: 'thread', body: 'Bitte um Rückruf', senderDisplayName: 'Mara Sommer', senderEmployeeId: 'employee', senderProfileId: null, isInternalNote: false, isSystemMessage: false, readAt: null, sentAt: '2026-10-15T10:00:00Z', createdAt: '2026-10-15T10:00:00Z' }, { id: 'colleague', threadId: 'thread', body: 'Antwort der Kollegin', senderDisplayName: 'Lea Kollegin', senderProfileId: 'other-profile', isInternalNote: false, isSystemMessage: false, readAt: null, sentAt: '2026-10-15T10:01:00Z', createdAt: '2026-10-15T10:01:00Z' }] };
  h.load.mockReset().mockImplementation(async () => ({ ok: true, data: { thread: h.detail, hasMore: false } })); h.read.mockReset().mockResolvedValue({ ok: true, data: true });
  h.change.mockReset().mockImplementation(async (_actor, _id, patch) => { h.detail = { ...h.detail, ...patch, isClosed: patch.status === 'closed' }; return { ok: true, data: true }; });
  h.remove.mockReset().mockImplementation(async (_actor, _thread, id) => { h.detail = { ...h.detail, messages: h.detail.messages.filter((message: any) => message.id !== id) }; return { ok: true, data: true }; });
  vi.spyOn(window, 'confirm').mockReturnValue(true); Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
const render = (focused = true) => act(async () => root.render(<ConversationView actor={actor} threadId="thread" draft={{ text: '', internal: false, attachments: [] }} onDraft={vi.fn()} onSend={vi.fn()} sending={false} refreshToken={0} onBack={vi.fn()} onChanged={h.changed} onBusyChange={h.busy} onOpenTemplates={vi.fn()} focused={focused} preferences={preferences} templateVersion={0} onRemoved={vi.fn()} />));
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === text)!;
describe('conversation detail interactions', () => {
  it('keeps colleague messages distinct from the current sender and marks read only while the view is active', async () => {
    await render(false); expect(h.read).not.toHaveBeenCalled(); expect(host.textContent).toContain('Lea Kollegin'); expect(host.querySelectorAll('.mw-message--own')).toHaveLength(0);
    await render(true); expect(h.read).toHaveBeenCalledOnce(); expect(h.changed).toHaveBeenCalledOnce();
    await render(true); expect(h.read).toHaveBeenCalledOnce();
  });
  it('keeps the history visible after a read failure and permits an explicit retry', async () => {
    h.read.mockResolvedValueOnce({ ok: false, error: 'Lesestatus nicht bestätigt' }).mockResolvedValueOnce({ ok: true, data: true });
    await render(); expect(host.textContent).toContain('Bitte um Rückruf'); expect(host.querySelector('[role="alert"]')?.textContent).toContain('Lesestatus nicht bestätigt');
    await act(async () => button('Erneut versuchen').click()); expect(h.read).toHaveBeenCalledTimes(2); expect(host.querySelector('[role="alert"]')).toBeNull();
  });
  it('persists closure before disabling replies and refreshes a removed message', async () => {
    await render(); await act(async () => button('Details').click());
    await act(async () => { const select = host.querySelector<HTMLSelectElement>('#mw-status')!; select.value = 'closed'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(h.change).toHaveBeenCalledWith(actor, 'thread', { status: 'closed' }); expect(host.querySelector('[aria-label="Schreibbereich"]')).toBeNull(); expect(button('Gespräch wieder öffnen')).toBeTruthy();
    await act(async () => button('Entfernen').click()); expect(h.remove).toHaveBeenCalledWith(actor, 'thread', 'incoming', 'deleted'); expect(host.textContent).not.toContain('Bitte um Rückruf');
  });
});
