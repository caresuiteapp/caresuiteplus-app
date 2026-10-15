// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { MessageWorkspace } from '@/screens/office/OfficeMessengerScreen.web';
import type { MessageDraft } from '@/hooks/useMessageWorkspace.web';
import OfficeMessageDetailRoute from '../../../app/office/messages/[id].web';
import BusinessMessageDetailRoute from '../../../app/business/messages/[threadId].web';

const h = vi.hoisted(() => ({ params: {} as Record<string, string | undefined>, redirect: vi.fn(), send: vi.fn(), canWrite: true, guarded: false, guardBusy: false, setParams: vi.fn(), rows: [] as unknown[] }));
vi.mock('expo-router', () => ({ Redirect: h.redirect, useIsFocused: () => true, usePathname: () => '/business/messages', useLocalSearchParams: () => h.params, useRouter: () => ({ setParams: h.setParams, replace: vi.fn() }) }));
vi.mock('@/components/layout/ScreenShell.web', () => ({ ScreenShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({}) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => 'tenant-a' }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ can: (key: string) => h.canWrite || key === 'office.messages.view', permissions: [], roleKey: 'business_admin' }) }));
vi.mock('@/hooks/useUnsavedWebChanges.web', () => ({ useUnsavedWebChanges: (dirty: boolean, busy: boolean) => { h.guarded = dirty; h.guardBusy = busy; } }));
vi.mock('@/lib/office/messageWorkspaceService.web', () => ({ sendWorkspaceMessage: h.send, CONVERSATION_PAGE_SIZE: 80, loadConversations: async () => ({ ok: true, data: { items: h.rows, hasMore: false } }) }));
vi.mock('@/lib/office/messageWorkspaceSettings.web', () => ({ loadMessagePreferences: async () => ({ ok: true, data: { attachmentsEnabled: true, voiceMessagesEnabled: true, internalNotesEnabled: true, emojisEnabled: true, showReadReceipts: true } }) }));
vi.mock('@/lib/office/officemessagerealtime', () => ({ subscribeToOfficeMessageInbox: () => () => {} }));
vi.mock('@/lib/office/officeMessageNavBadgeSeenStore', () => ({ setOfficeMessageNavBadgeMessengerView: vi.fn() }));
vi.mock('@/components/office/messages/NewConversation.web', () => ({ NewConversation: () => <div>Neue Unterhaltung</div> }));
vi.mock('@/components/office/messages/BroadcastWorkspace.web', () => ({ BroadcastWorkspace: () => null, NewBroadcast: () => null }));
vi.mock('@/components/office/messages/MessageTemplates.web', () => ({ MessageTemplates: () => null }));
vi.mock('@/components/office/messages/MessageSettings.web', () => ({ MessageSettings: () => null }));
vi.mock('@/components/office/messages/ConversationView.web', () => ({ ConversationView: ({ threadId, draft, onDraft, onSend, sending }: { threadId: string; draft: MessageDraft; onDraft: (value: MessageDraft) => void; onSend: () => void; sending: boolean }) => <div data-thread={threadId}><input aria-label="Nachricht" value={draft.text} disabled={!!draft.operation} onChange={event => onDraft({ ...draft, text: event.target.value })} /><button type="button" disabled={sending} onClick={onSend}>Absenden</button><span>{draft.error}</span></div> }));

let root: Root; let host: HTMLDivElement;
const actor = { tenantId: 'tenant-a', profileId: 'profile-a', roleKey: 'business_admin' as const };
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); h.params = { thread: 'a' }; h.canWrite = true; h.guarded = false; h.guardBusy = false;
  h.redirect.mockImplementation(() => null);
  h.rows = ['a', 'b'].map(id => ({ id, tenantId: 'tenant-a', subject: `Betreff ${id}`, employeeName: `Person ${id}`, threadType: 'employee_office', status: 'received', priority: 'normal', unreadCount: 0, createdAt: '2026-10-15T10:00:00Z', lastMessageAt: '2026-10-15T10:00:00Z' }));
  h.setParams.mockImplementation((next: object) => { h.params = { ...h.params, ...next }; }); h.send.mockReset().mockResolvedValue({ ok: true, data: { id: 'sent' } });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = (tenantId = 'tenant-a') => act(async () => root.render(<MessageWorkspace key={tenantId} actor={{ ...actor, tenantId }} actorUserId="auth-user" />));
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.includes(text))!;
async function write(value: string) { const input = host.querySelector<HTMLInputElement>('[aria-label="Nachricht"]')!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); }); }
describe('message workspace navigation', () => {
  it.each([
    { Route: OfficeMessageDetailRoute, routeParam: 'id', pathname: '/office/messages' },
    { Route: BusinessMessageDetailRoute, routeParam: 'threadId', pathname: '/business/messages' },
  ])('canonicalizes $pathname detail links so changing audience clears the old conversation', async ({ Route, routeParam, pathname }) => {
    h.params = { [routeParam]: 'a', audience: 'employees', filter: 'mine', query: 'Rückfrage' };
    await act(async () => root.render(<Route />));
    const href = h.redirect.mock.calls.at(-1)![0].href;
    expect(href).toEqual({ pathname, params: { thread: 'a', audience: 'employees', filter: 'mine', query: 'Rückfrage' } });
    h.params = href.params; await render();
    expect(host.querySelector('[data-thread]')?.getAttribute('data-thread')).toBe('a');
    await act(async () => button('Klient:innen').click()); await render();
    expect(h.params.audience).toBe('clients'); expect(host.querySelector('[data-thread]')).toBeNull();
  });
  it.each([OfficeMessageDetailRoute, BusinessMessageDetailRoute])('prefers an explicit conversation query over the detail path parameter', async Route => {
    h.params = { id: 'path-office', threadId: 'path-business', thread: 'explicit-thread', audience: 'internal', compose: 'group' };
    await act(async () => root.render(<Route />));
    expect(h.redirect.mock.calls.at(-1)![0].href.params).toEqual({ thread: 'explicit-thread', audience: 'internal', compose: 'group' });
  });
  it('preserves independent drafts across conversations and follows URL selection removal', async () => {
    await render(); await write('Entwurf für A'); expect(h.guarded).toBe(true);
    await act(async () => button('Person b').click()); await render(); expect(host.querySelector('[data-thread]')?.getAttribute('data-thread')).toBe('b'); await write('Entwurf für B');
    await act(async () => button('Person a').click()); await render(); expect(host.querySelector<HTMLInputElement>('[aria-label="Nachricht"]')!.value).toBe('Entwurf für A');
    h.params = {}; await render(); expect(host.querySelector('[data-thread]')).toBeNull(); expect(h.guarded).toBe(true);
  });
  it('blocks navigation during sending and retries the exact same message operation', async () => {
    let finish!: (result: unknown) => void; h.send.mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce({ ok: true, data: { id: 'sent' } });
    await render(); await write('Hallo'); await act(async () => { button('Absenden').click(); button('Person b').click(); });
    expect(h.send).toHaveBeenCalledOnce(); expect(h.params.thread).toBe('a'); expect(h.guardBusy).toBe(true);
    const operation = h.send.mock.calls[0][2]; await act(async () => finish({ ok: false, error: 'Bestätigung fehlt' })); expect(host.textContent).toContain('Bestätigung fehlt');
    await act(async () => button('Absenden').click()); expect(h.send.mock.calls[1][2]).toBe(operation); expect(host.querySelector<HTMLInputElement>('[aria-label="Nachricht"]')!.value).toBe(''); expect(h.guarded).toBe(false);
  });
  it('clears drafts when the organisation changes and blocks sending in read-only mode', async () => {
    await render(); await write('Vertraulich A'); await render('tenant-b'); expect(host.querySelector<HTMLInputElement>('[aria-label="Nachricht"]')!.value).toBe(''); expect(host.textContent).not.toContain('Vertraulich A');
    h.canWrite = false; await render('tenant-b'); await write('Darf nicht senden'); await act(async () => button('Absenden').click()); expect(h.send).not.toHaveBeenCalled(); expect(button('Neue Nachricht')).toBeUndefined();
  });
});
