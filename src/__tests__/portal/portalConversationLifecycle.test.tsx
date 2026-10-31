// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PortalOfficeThread } from '@/components/portal/portalofficethread';
import { PortalOfficeMessenger } from '@/components/portal/portalofficemessenger';
import {
  ClientPortalOfficeConversationScreen,
  EmployeePortalOfficeConversationScreen,
} from '@/screens/portal/portalofficemessagesscreens';
import { LiquidPortalRouteLayout } from '@/liquid-command/shell/LiquidPortalRouteLayout';
import { PortalMessengerFocusProvider, usePortalMessengerFocus } from '@/lib/portal/portalMessengerFocusContext';
import type { OfficeMessage, OfficeMessageThreadDetail } from '@/types/office/messaging';

const h = vi.hoisted(() => ({
  details: new Map<string, OfficeMessageThreadDetail>(),
  composer: null as any,
  send: vi.fn(), restart: vi.fn(), read: vi.fn(), replace: vi.fn(),
  threadId: 'a', masterDetail: true, appState: 'active', focused: true,
  actorId: 'account-a',
  appListener: null as ((state: string) => void) | null,
  backListener: null as (() => boolean) | null,
}));

vi.mock('react-native', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  const Box = ({ children, testID }: any) => <div data-testid={testID}>{children}</div>;
  const Button = ({ children, onPress, disabled, testID, accessibilityLabel }: any) =>
    <button data-testid={testID} aria-label={accessibilityLabel} disabled={disabled} onClick={onPress}>{children}</button>;
  return {
    View: Box, Text: Box, Pressable: Button,
    ScrollView: forwardRef(({ children }: any, ref: any) => {
      useImperativeHandle(ref, () => ({ scrollToEnd() {} }));
      return <div>{children}</div>;
    }),
    Modal: ({ children, visible }: any) => visible ? <div>{children}</div> : null,
    Platform: { OS: 'android' },
    Keyboard: { isVisible: () => false, addListener: () => ({ remove() {} }) },
    StyleSheet: { create: (styles: unknown) => styles },
    AppState: {
      get currentState() { return h.appState; },
      addEventListener: (_event: string, listener: (state: string) => void) => {
        h.appListener = listener;
        return { remove() { if (h.appListener === listener) h.appListener = null; } };
      },
    },
    BackHandler: {
      addEventListener: (_event: string, listener: () => boolean) => {
        h.backListener = listener;
        return { remove() { if (h.backListener === listener) h.backListener = null; } };
      },
    },
  };
});
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) }));
vi.mock('expo-router', () => ({
  useIsFocused: () => h.focused,
  useLocalSearchParams: () => ({ threadId: h.threadId }),
  useRouter: () => ({ replace: h.replace }),
  usePathname: () => '/portal/client/messages',
  Stack: () => <FocusControls />,
}));
vi.mock('@/components/keyboard/PortalKeyboard', () => ({ PortalKeyboardAvoidingView: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/theme', () => ({ spacing: { xs: 4, sm: 8, md: 16, lg: 24 }, radius: {}, typography: {}, colors: {} }));
vi.mock('@/design/tokens/carelightadaptive', () => ({ useCareLightPalette: () => ({ c: { violet: '#056CE8' } }) }));
vi.mock('@/design/tokens/themeBridge', () => ({ useLegacyTheme: () => ({ typography: {}, isLight: true }) }));
vi.mock('@/design/tokens/auroraGlass', () => ({
  useLightLiquidGlassShell: () => true,
  useMessagingGlassSurface: () => ({ surfaces: {}, onDarkSurface: false, ink: {} }),
}));
vi.mock('@/components/ui', () => {
  const Button = ({ title, onPress, disabled, loading }: any) => <button disabled={disabled || loading} onClick={onPress}>{title}</button>;
  return { CareLightButton: Button, PremiumButton: Button,
    EmptyState: ({ title }: any) => <div>{title}</div>,
    ErrorState: ({ message }: any) => <div>{message}</div>,
    LoadingState: ({ message }: any) => <div>{message}</div> };
});
vi.mock('@/components/office/officemessagecomposer', () => ({
  OfficeMessageComposer: (props: any) => {
    h.composer = props;
    return <div data-testid="composer">{props.text}:{props.pendingAttachments.map((attachment: any) => attachment.id).join(',')}</div>;
  },
}));
vi.mock('@/components/communication/ChatBubble', () => ({ ChatBubble: ({ message, isOwn, showStatus }: any) =>
  <div data-message-id={message.id} data-own={String(isOwn)} data-status={String(showStatus)}>{message.bodyText}</div> }));
vi.mock('@/components/office/messageattachmentlist', () => ({ MessageAttachmentList: () => null }));
vi.mock('@/components/portal/portalofficestatuscard', () => ({ PortalOfficeStatusCard: () => null }));
vi.mock('@/components/portal/assist/PortalEmptyState', () => ({ PortalEmptyState: ({ title }: any) => <div>{title}</div> }));
vi.mock('@/hooks/useportalofficethreaddetail', () => ({
  usePortalOfficeThreadDetail: (threadId: string) => ({
    detail: h.details.get(threadId), loading: false, error: null, sending: false,
    sendMessage: (body: string, attachments: unknown[]) => h.send(threadId, body, attachments),
    startNewChat: () => h.restart(threadId), refresh: vi.fn(), markAsRead: h.read,
    actorClientId: 'client', actorEmployeeId: 'employee-a',
  }),
}));
vi.mock('@/lib/office/employeeGroupChatService', () => ({ isEmployeeGroupChatThread: (thread: any) => thread.threadType === 'employee_group_office' }));
vi.mock('@/lib/office/portalofficemessageservice', () => ({ getPortalStatusLabel: () => 'Offen' }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ can: () => true, check: () => ({}) }) }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => ({ tenantId: 'tenant', actorId: h.actorId,
  roleKey: 'employee_portal', employeeId: h.actorId === 'account-a' ? 'employee-a' : 'employee-b', clientId: 'client' }) }));
vi.mock('@/hooks/platform/usePlatformLayout', () => ({ usePlatformLayout: () => ({ useMasterDetail: h.masterDetail }) }));
vi.mock('@/screens/portal/PortalTabScreen', () => ({ PortalTabScreen: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/components/portal/assist/PortalGlassHero', () => ({ PortalGlassHero: () => null }));
vi.mock('@/components/permissions', () => ({ LockedActionBanner: () => null }));
vi.mock('@/components/portal/PortalNewChatModal', () => ({ PortalNewChatModal: () => null }));
vi.mock('@/components/portal/portalofficeinbox', () => ({ PortalOfficeInbox: () => <div>Inbox</div> }));
vi.mock('@/components/messaging', () => ({
  MessengerShell: ({ thread, selectedThreadId, onCloseThread }: any) => selectedThreadId
    ? <div><button onClick={onCloseThread}>Liste</button>{thread}</div> : <div>Inbox</div>,
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ profile: null, portalSession: null, signOut: vi.fn() }),
  RequireAuth: ({ children }: any) => children,
  RequireRole: ({ children }: any) => children,
  RequireEmployeePasswordSetup: ({ children }: any) => children,
}));
vi.mock('@/hooks/useportalofficemessages', () => ({ usePortalOfficeMessages: () => ({ threads: [] }) }));
vi.mock('@/hooks/useClientPortalSettings', () => ({ useClientPortalSettings: () => ({ settings: null, loading: false, error: null }) }));
vi.mock('@/liquid-command/foundation/useLiquidLayout', () => ({ useLiquidLayout: () => ({ width: 390, isPhone: true }) }));
vi.mock('@/liquid-command/components/LiquidPrimitives', () => {
  const Box = ({ children, testID }: any) => <div data-testid={testID}>{children}</div>;
  return {
    LiquidBackdrop: Box, LiquidSurface: Box, LiquidVisualModeProvider: Box,
    LiquidGlyph: () => null, LiquidLogo: () => <div data-testid="portal-logo">CareSuite</div>,
    LiquidIconButton: ({ label, onPress }: any) => <button onClick={onPress}>{label}</button>,
    LiquidButton: ({ label, onPress }: any) => <button onClick={onPress}>{label}</button>,
  };
});
vi.mock('@/components/portal/accessibility/PortalTextSizeControls', () => ({ PortalTextSizeControls: () => null }));
vi.mock('@/design/tokens/portalPremium', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/design/tokens/portalPremium')>(),
  PortalPremiumProvider: ({ children }: any) => children,
}));

function FocusControls() {
  const focus = usePortalMessengerFocus();
  return <div>
    <button onClick={() => focus.setActive(true)}>Chat öffnen</button>
    <button onClick={() => focus.setActive(false)}>Chat verlassen</button>
  </div>;
}
function SelectionControls() {
  const focus = usePortalMessengerFocus();
  return <div>
    <button onClick={() => focus.openThread('a')}>A</button>
    <button onClick={() => focus.openThread('b')}>B</button>
    <span data-testid="focus-active">{String(focus.active)}</span>
    <PortalOfficeMessenger audience="client" />
  </div>;
}
const message = (id: string): OfficeMessage => ({
  id, threadId: 'a', tenantId: 'tenant', body: id, senderType: 'office_profile', senderProfileId: 'office',
  senderClientId: null, senderEmployeeId: null, senderDisplayName: 'Verwaltung',
  isInternalNote: false, isSystemMessage: false, sentAt: '2026-10-11T08:00:00Z', readAt: null, status: 'sent',
  createdAt: '2026-10-11T08:00:00Z', updatedAt: '2026-10-11T08:00:00Z',
});
const detail = (id: string, messages: OfficeMessage[] = [], closed = false): OfficeMessageThreadDetail => ({
  id, tenantId: 'tenant', threadType: 'client_office', status: closed ? 'closed' : 'received', priority: 'normal',
  subject: `Chat ${id}`, categoryId: null, categoryLabel: null, clientId: 'client', clientName: null,
  employeeId: null, employeeName: null, participantName: null, lastMessageAt: null, lastMessagePreview: null,
  unreadCount: messages.length, archivedAt: null, createdAt: '2026-10-11T08:00:00Z', updatedAt: '2026-10-11T08:00:00Z',
  messages, canReply: !closed, isClosed: closed,
});
const deferred = <T,>() => {
  let resolve!: (result: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
};
let root: Root, host: HTMLDivElement;
const render = async (node: React.ReactNode) => { await act(async () => root.render(node)); };
const press = async (label: string) => {
  const button = [...host.querySelectorAll('button')].find((node) => node.textContent === label);
  expect(button, label).toBeDefined();
  await act(async () => button!.click());
};
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  h.details = new Map([['a', detail('a')], ['b', detail('b')]]);
  h.composer = null; h.threadId = 'a'; h.masterDetail = true; h.appState = 'active'; h.focused = true;
  h.actorId = 'account-a';
  h.appListener = null; h.backListener = null;
  h.read.mockResolvedValue({ ok: true, data: undefined });
  h.send.mockResolvedValue({ ok: true }); h.restart.mockResolvedValue({ ok: true, data: detail('new') });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('portal conversation lifecycle on a mounted React tree', () => {
  it('clears private composer contents when a different employee opens the same group thread', async () => {
    await render(<PortalOfficeThread threadId="a" />);
    await act(async () => { h.composer.onChangeText('Privat A'); h.composer.onPendingAttachmentsChange([{ id: 'private-a' }]); });
    h.actorId = 'account-b'; await render(<PortalOfficeThread threadId="a" />);
    expect(h.composer.text).toBe(''); expect(h.composer.pendingAttachments).toEqual([]);
  });
  it('returns a direct employee chat deep link to the inbox on Android Back and removes the handler on blur', async () => {
    h.masterDetail = false;
    await render(<PortalMessengerFocusProvider><EmployeePortalOfficeConversationScreen /></PortalMessengerFocusProvider>);
    await act(async () => expect(h.backListener?.()).toBe(true));
    expect(h.replace).toHaveBeenCalledWith('/portal/employee/messages');
    h.focused = false;
    await render(<PortalMessengerFocusProvider><EmployeePortalOfficeConversationScreen /></PortalMessengerFocusProvider>);
    expect(h.backListener).toBeNull();
  });
  it('distinguishes a colleague group contribution from the signed-in employee message', async () => {
    const own = { ...message('own'), senderType: 'employee_portal' as const, senderProfileId: null, senderEmployeeId: 'employee-a' };
    const colleague = { ...own, id: 'colleague', senderEmployeeId: 'employee-b' };
    h.details.set('a', { ...detail('a', [own, colleague]), threadType: 'employee_group_office' });
    await render(<PortalOfficeThread threadId="a" />);
    expect(host.querySelector('[data-message-id="own"]')?.getAttribute('data-own')).toBe('true');
    expect(host.querySelector('[data-message-id="colleague"]')?.getAttribute('data-own')).toBe('false');
    expect(host.querySelector('[data-message-id="colleague"]')?.getAttribute('data-status')).toBe('false');
  });

  it('blocks two send calls in the same turn and preserves newly edited draft and attachments', async () => {
    const flight = deferred<{ ok: true }>(); h.send.mockReturnValueOnce(flight.promise);
    await render(<PortalOfficeThread threadId="a" />);
    await act(async () => { h.composer.onChangeText('Gesendet'); h.composer.onPendingAttachmentsChange([{ id: 'sent-file' }]); });
    let pending!: Promise<void>;
    await act(async () => { pending = h.composer.onSend(); void h.composer.onSend(); });
    expect(h.send).toHaveBeenCalledTimes(1);
    await act(async () => { h.composer.onChangeText('Nächster Entwurf'); h.composer.onPendingAttachmentsChange([{ id: 'sent-file' }, { id: 'new-file' }]); });
    await act(async () => { flight.resolve({ ok: true }); await pending; });
    expect(h.composer.text).toBe('Nächster Entwurf');
    expect(h.composer.pendingAttachments).toEqual([{ id: 'new-file' }]);
  });

  it('keeps the text and attachment after failure and sends the same payload on retry', async () => {
    h.send.mockResolvedValueOnce({ ok: false, error: 'Offline' });
    await render(<PortalOfficeThread threadId="a" />);
    await act(async () => { h.composer.onChangeText('Entwurf'); h.composer.onPendingAttachmentsChange([{ id: 'file' }]); });
    await act(async () => h.composer.onSend());
    expect(h.composer.text).toBe('Entwurf'); expect(h.composer.pendingAttachments).toEqual([{ id: 'file' }]);
    await press('Erneut senden');
    expect(h.send).toHaveBeenLastCalledWith('a', 'Entwurf', [{ id: 'file' }]);
    expect(h.composer.text).toBe(''); expect(h.composer.pendingAttachments).toEqual([]);
  });

  it('does not offer a new private-thread restart for a closed group chat', async () => {
    h.details.set('a', { ...detail('a', [], true), threadType: 'employee_group_office' });
    await render(<PortalOfficeThread threadId="a" />);
    expect(host.textContent).toContain('Gruppen-Chat ist abgeschlossen');
    expect(host.textContent).not.toContain('Verwaltung anschreiben');
    expect(h.restart).not.toHaveBeenCalled();
  });
  it('does not move an unsent draft or attachment between tablet conversations', async () => {
    await render(<PortalMessengerFocusProvider><SelectionControls /></PortalMessengerFocusProvider>);
    await press('A');
    await act(async () => {
      h.composer.onChangeText('Privater Entwurf für A');
      h.composer.onPendingAttachmentsChange([{ id: 'attachment-a' }]);
    });
    expect(host.textContent).toContain('Privater Entwurf für A:attachment-a');
    await press('B');
    expect(h.composer.text).toBe('');
    expect(h.composer.pendingAttachments).toEqual([]);
    await act(async () => h.composer.onChangeText('Nachricht für B'));
    await act(async () => h.composer.onSend());
    expect(h.send).toHaveBeenCalledWith('b', 'Nachricht für B', []);
  });

  it('keeps the new conversation draft when a previous send completes after switching threads', async () => {
    const flight = deferred<{ ok: true }>(); h.send.mockReturnValueOnce(flight.promise);
    await render(<PortalOfficeThread threadId="a" />);
    await act(async () => h.composer.onChangeText('Nachricht A'));
    let pending!: Promise<void>;
    await act(async () => { pending = h.composer.onSend(); });
    await render(<PortalOfficeThread threadId="b" />);
    await act(async () => h.composer.onChangeText('Entwurf B'));
    await act(async () => { flight.resolve({ ok: true }); await pending; });
    expect(h.composer.text).toBe('Entwurf B');
  });

  it('marks every newly arriving office reply read without repeatedly marking an unchanged batch', async () => {
    h.details.set('a', detail('a', [message('one')]));
    await render(<PortalOfficeThread threadId="a" />);
    expect(h.read).toHaveBeenCalledTimes(1);
    h.details.set('a', detail('a', [message('one')]));
    await render(<PortalOfficeThread threadId="a" />);
    expect(h.read).toHaveBeenCalledTimes(1);
    h.details.set('a', detail('a', [message('one'), message('two')]));
    await render(<PortalOfficeThread threadId="a" />);
    expect(h.read).toHaveBeenCalledTimes(2);
  });

  it('does not mark a background reply read until the app returns to the foreground', async () => {
    h.appState = 'background'; h.details.set('a', detail('a', [message('one')]));
    await render(<PortalOfficeThread threadId="a" />);
    expect(h.read).not.toHaveBeenCalled();
    await act(async () => h.appListener?.('active'));
    expect(h.read).toHaveBeenCalledTimes(1);
  });

  it('does not mark replies read on a mounted, unfocused route and reads them on returning', async () => {
    await render(<PortalOfficeThread threadId="a" />);
    h.focused = false;
    h.details.set('a', detail('a', [message('arrived-on-another-page')]));
    await render(<PortalOfficeThread threadId="a" />);
    expect(h.read).not.toHaveBeenCalled();
    h.focused = true;
    await render(<PortalOfficeThread threadId="a" />);
    expect(h.read).toHaveBeenCalledTimes(1);
  });

  it('allows a failed read acknowledgement to retry on the next refreshed detail', async () => {
    h.read.mockResolvedValueOnce({ ok: false, error: 'offline' });
    h.details.set('a', detail('a', [message('one')]));
    await render(<PortalOfficeThread threadId="a" />);
    h.details.set('a', detail('a', [message('one')]));
    await render(<PortalOfficeThread threadId="a" />);
    expect(h.read).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['client', ClientPortalOfficeConversationScreen], ['employee', EmployeePortalOfficeConversationScreen],
  ] as const)('opens the new %s conversation after restarting a closed direct route', async (kind, Screen) => {
    h.details.set('a', detail('a', [], true));
    await render(<PortalMessengerFocusProvider><Screen /></PortalMessengerFocusProvider>);
    await press('Verwaltung anschreiben');
    expect(h.replace).toHaveBeenCalledWith(`/portal/${kind}/messages/new`);
  });

  it('prevents duplicate restarts and keeps a failed restart visible and retryable', async () => {
    const flight = deferred<{ ok: false; error: string }>(); h.restart.mockReturnValueOnce(flight.promise);
    h.details.set('a', detail('a', [], true));
    await render(<PortalOfficeThread threadId="a" />);
    await press('Verwaltung anschreiben');
    await press('Verwaltung anschreiben');
    expect(h.restart).toHaveBeenCalledTimes(1);
    await act(async () => flight.resolve({ ok: false, error: 'Offline. Bitte erneut versuchen.' }));
    expect(host.textContent).toContain('Senden fehlgeschlagen. Bitte erneut versuchen.');
    await press('Verwaltung anschreiben');
    expect(h.restart).toHaveBeenCalledTimes(2);
  });

  it('returns from an in-page Android conversation to the inbox using hardware Back', async () => {
    h.masterDetail = false;
    await render(<PortalMessengerFocusProvider><SelectionControls /></PortalMessengerFocusProvider>);
    await press('A');
    expect(h.backListener).not.toBeNull();
    await act(async () => expect(h.backListener?.()).toBe(true));
    expect(host.textContent).toContain('Inbox');
    expect(h.composer).not.toBeNull();
    expect(h.backListener).toBeNull();
  });

  it('releases chat chrome and the hardware Back handler when the mounted messenger route loses focus', async () => {
    h.masterDetail = false;
    const tree = <PortalMessengerFocusProvider><SelectionControls /></PortalMessengerFocusProvider>;
    await render(tree);
    await press('A');
    expect(host.querySelector('[data-testid="focus-active"]')?.textContent).toBe('true');
    h.focused = false;
    await render(<PortalMessengerFocusProvider><SelectionControls /></PortalMessengerFocusProvider>);
    expect(host.querySelector('[data-testid="focus-active"]')?.textContent).toBe('false');
    expect(h.backListener).toBeNull();
    h.focused = true;
    await render(<PortalMessengerFocusProvider><SelectionControls /></PortalMessengerFocusProvider>);
    expect(host.querySelector('[data-testid="focus-active"]')?.textContent).toBe('true');
    expect(h.backListener).not.toBeNull();
  });

  it('reserves mobile chat space by hiding portal chrome and restores navigation on closing', async () => {
    await render(<LiquidPortalRouteLayout kind="client" />);
    expect(host.querySelector('[data-testid="portal-bottom-navigation"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="portal-logo"]')).not.toBeNull();
    await press('Chat öffnen');
    expect(host.querySelector('[data-testid="portal-bottom-navigation"]')).toBeNull();
    expect(host.querySelector('[data-testid="portal-logo"]')).toBeNull();
    await press('Chat verlassen');
    expect(host.querySelector('[data-testid="portal-bottom-navigation"]')).not.toBeNull();
  });
});
