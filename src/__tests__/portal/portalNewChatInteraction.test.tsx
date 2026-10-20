import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PortalNewChatModal } from '@/components/portal/PortalNewChatModal';
import { readPortalNewChatDraft, clearPortalNewChatDraft } from '@/lib/portal/portalNewChatDraftStore';

const h = vi.hoisted(() => ({
  values: [] as any[], deps: [] as any[], cursor: 0, effects: [] as (() => unknown)[],
  create: vi.fn(), categories: vi.fn(), session: vi.fn(), linked: true, audience: 'employee',
}));
vi.mock('react', async (original) => ({
  ...await original<object>(),
  useMemo: (f: () => any) => f(),
  useState: (initial: any) => {
    const i = h.cursor++;
    if (!(i in h.values)) h.values[i] = typeof initial === 'function' ? initial() : initial;
    return [h.values[i], (value: any) => { h.values[i] = typeof value === 'function' ? value(h.values[i]) : value; }];
  },
  useRef: (initial: any) => { const i = h.cursor++; return h.values[i] ??= { current: initial }; },
  useEffect: (f: () => unknown, deps: any[]) => {
    const i = h.cursor++;
    if (!h.deps[i] || deps.some((v, n) => !Object.is(v, h.deps[i][n]))) h.effects.push(f);
    h.deps[i] = deps;
  },
}));
vi.mock('react-native', () => ({
  KeyboardAvoidingView: 'KeyboardAvoidingView', Modal: 'Modal', ScrollView: 'ScrollView',
  TextInput: 'TextInput', Pressable: 'Pressable', Text: 'Text', View: 'View',
  BackHandler: { addEventListener: () => ({ remove: vi.fn() }) },
  Platform: { OS: 'android' }, StyleSheet: { create: (s: unknown) => s },
}));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) }));
vi.mock('@/theme', () => ({ spacing: {}, radius: {} }));
vi.mock('@/components/ui', () => ({ PremiumInput: 'Input' }));
vi.mock('@/design/tokens/carelightadaptive', () => ({ useCareLightPalette: () => ({ c: {} }) }));
vi.mock('@/design/tokens/themeBridge', () => ({ useLegacyTheme: () => ({ typography: {} }) }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ portalSession: null }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => 'test-tenant' }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => ({
  actorId: 'test-actor', employeeId: 'employee', roleKey: 'employee_portal', isLinkedReady: h.linked,
}) }));
vi.mock('@/lib/auth/portalSupabaseAuth', () => ({ ensurePortalWriteSession: (...args: any[]) => h.session(...args) }));
vi.mock('@/lib/office/portalofficemessageservice', () => ({
  resolvePortalActor: () => ({ ok: true, data: { employeeId: 'employee' } }),
  fetchPortalOfficeCategories: (...args: any[]) => h.categories(...args),
  createPortalOfficeThread: (...args: any[]) => h.create(...args),
}));
vi.mock('@/lib/portal/portalUserFacingError', () => ({ toPortalUserFacingError: (error: string) => error }));
function nodes(node: any): any[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return node?.props ? [node, ...nodes(node.props.children)] : [];
}
const created = vi.fn(), closed = vi.fn();
function render(presentation: 'screen' | 'modal' = 'screen') {
  h.cursor = 0;
  const tree = nodes(PortalNewChatModal({ visible: true, audience: 'employee', presentation, onCreated: created, onClose: closed }));
  h.effects.splice(0).forEach((f) => f());
  return tree;
}
function input(message: string) {
  render().find((n) => n.props.testID === 'portal-new-chat-message').props.onChangeText(message);
  return render();
}
function send() { return render().find((n) => n.props.testID === 'portal-new-chat-send').props.onPress(); }
beforeEach(() => {
  vi.clearAllMocks(); h.values = []; h.deps = []; h.effects = []; h.linked = true;
  clearPortalNewChatDraft('test-tenant', 'employee', 'test-actor');
  h.session.mockResolvedValue({ ok: true }); h.categories.mockResolvedValue({ ok: true, data: [] });
  h.create.mockResolvedValue({ ok: true, data: { id: 'created-thread' } });
});
describe('new portal chat interaction on Android', () => {
  it('opens recipient, keyboard-aware entry and send in the screen without a modal', () => {
    const tree = render();
    expect(tree[0].type).toBe('KeyboardAvoidingView');
    expect(tree.some((n) => n.type === 'Modal')).toBe(false);
    expect(tree.some((n) => n.type === 'TextInput')).toBe(true);
    expect(tree.some((n) => n.props.accessibilityLabel === 'Zurück zu Nachrichten')).toBe(true);
  });
  it('uses one full-screen modal when opened from an assignment', () => {
    const tree = render('modal');
    expect(tree.filter((n) => n.type === 'Modal')).toHaveLength(1);
    expect(tree[0].props.presentationStyle).toBe('fullScreen');
  });
  it('sends the first message and opens only the saved server thread', async () => {
    render(); input('Bitte Rückruf zum Einsatz.'); await send();
    expect(h.create).toHaveBeenCalledWith('test-tenant', expect.anything(), expect.objectContaining({
      initialMessage: 'Bitte Rückruf zum Einsatz.', subject: 'Bitte Rückruf zum Einsatz.',
    }));
    expect(created).toHaveBeenCalledWith('created-thread');
    expect(readPortalNewChatDraft('test-tenant', 'employee', 'test-actor')).toBeNull();
  });
  it('does not create an empty conversation', async () => { render(); input('  '); await send(); expect(h.create).not.toHaveBeenCalled(); });
  it('keeps the message and screen on a server failure', async () => {
    h.create.mockResolvedValue({ ok: false, error: 'Verbindung unterbrochen' });
    render(); input('Nicht verlieren'); await send();
    expect(created).not.toHaveBeenCalled(); expect(closed).not.toHaveBeenCalled();
    expect(render().find((n) => n.type === 'TextInput').props.value).toBe('Nicht verlieren');
    expect(render().some((n) => n.props.children === 'Verbindung unterbrochen')).toBe(true);
  });
  it('blocks double sends and closing while the request is running', async () => {
    let finish!: (value: any) => void;
    h.create.mockImplementation(() => new Promise((r) => { finish = r; }));
    render(); input('Einmal senden'); const first = send(); await Promise.resolve();
    await send(); render().find((n) => n.props.accessibilityLabel === 'Zurück zu Nachrichten').props.onPress();
    expect(h.create).toHaveBeenCalledTimes(1); expect(closed).not.toHaveBeenCalled();
    finish({ ok: true, data: { id: 'one' } }); await first;
  });
  it('can still send if optional categories fail', async () => {
    h.categories.mockRejectedValue(new Error('offline'));
    render(); await Promise.resolve(); input('Allgemeine Frage'); await send();
    expect(created).toHaveBeenCalledWith('created-thread');
  });
  it('keeps native drafts isolated to the account and restores after closing', () => {
    render(); input('Mein Entwurf');
    expect(readPortalNewChatDraft('test-tenant', 'employee', 'other-actor')).toBeNull();
    h.values = []; h.deps = []; render();
    expect(render().find((n) => n.type === 'TextInput').props.value).toBe('Mein Entwurf');
  });
  it('requires the linked account and a writable session', async () => {
    h.linked = false; render(); input('Frage'); await send(); expect(h.create).not.toHaveBeenCalled();
    h.linked = true; h.session.mockResolvedValue({ ok: false, error: 'Neu anmelden' });
    await send(); expect(h.create).not.toHaveBeenCalled(); expect(created).not.toHaveBeenCalled();
  });
});
