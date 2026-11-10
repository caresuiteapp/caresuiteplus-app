vi.mock('@expo/vector-icons/Ionicons', () => ({ default: () => null }));
vi.mock('@expo/vector-icons/Feather', () => ({ default: () => null }));
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LiquidPortalRouteLayout } from '@/liquid-command/shell/LiquidPortalRouteLayout';
import { EmployeeLogbookLifecycleGate } from '@/components/portal/EmployeeLogbookLifecycleGate';
import { employeePortalNavigation } from '@/lib/portal/employee/employeePortalNavigation';

const state = vi.hoisted(() => ({
  role: 'employee_portal', clientSettings: null as any, path: '/portal/employee', width: 360, bottom: 24,
  top: 24, left: 0, right: 0, keyboard: false,
  trip: null as Record<string, unknown> | null, gate: false, slot: 0, unread: 0,
  replace: vi.fn(), push: vi.fn(),
  modules: ['assist'] as ('assist' | 'pflege')[],
  selected: 'assist' as 'assist' | 'pflege',
}));
vi.mock('react', async (original) => ({
  ...await original<object>(),
  useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn,
  useEffect: () => undefined,
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => [state.gate && state.slot++ === 0 ? state.trip : value, vi.fn()],
}));
vi.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', Modal: 'Modal', Image: 'Image',
  useWindowDimensions: () => ({ width: state.width, height: 800, fontScale: 1 }),
  Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock('@/components/portal/employee/EmployeePortalArtwork', () => ({ EmployeePortalArtwork: () => null }));
vi.mock('@/components/portal/employee/EmployeePortalBackdrop', () => ({ EmployeePortalBackdrop: () => null }));
vi.mock('@/components/portal/PortalReadOnlyAvatar', () => ({ PortalReadOnlyAvatar: 'Avatar' }));
vi.mock('@/hooks/usePortalProfileAvatar', () => ({ usePortalProfileAvatarForActor: () => ({ avatarUrl: 'https://example.test/employee.png' }) }));
vi.mock('@/components/portal/employee/EmployeePortalWorkspaceContext', () => ({
  EmployeePortalWorkspaceContext: { Provider: 'Workspace' },
  useEmployeePortalWorkspaceContext: () => null,
}));
vi.mock('@/hooks/useEmployeePortalWorkspace', async () => {
  const { employeePortalNavigation } = await import('@/lib/portal/employee/employeePortalNavigation');
  return { useEmployeePortalWorkspace: () => ({
    selected: state.selected, available: state.modules, navigation: employeePortalNavigation(state.selected),
    loading: false, error: null, retry: vi.fn(), select: vi.fn(),
  }) };
});
vi.mock('expo-router', () => ({
  Stack: 'Stack', usePathname: () => state.path,
  useRouter: () => ({ replace: state.replace, push: state.push }),
}));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: state.top, bottom: state.bottom, left: state.left, right: state.right }) }));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ profile: { displayName: 'Testkonto', roleKey: state.role }, signOut: vi.fn() }),
  RequireAuth: 'RequireAuth', RequireEmployeePasswordSetup: 'RequireEmployeePasswordSetup', RequireRole: 'RequireRole',
}));
vi.mock('@/hooks/usePortalVisualViewport', () => ({ usePortalVisualViewport: () => ({ height: null, width: null, offsetTop: 0, offsetLeft: 0, keyboardVisible: state.keyboard }) }));
vi.mock('@/hooks/useportalofficemessages', () => ({ usePortalOfficeMessages: () => ({ threads: [{ unreadCount: state.unread }] }) }));
vi.mock('@/hooks/useClientPortalSettings', () => ({ useClientPortalSettings: () => ({ settings: state.clientSettings }) }));
vi.mock('@/lib/portal/portalMessengerFocusContext', () => ({
  PortalMessengerFocusProvider: 'MessengerFocus',
  usePortalMessengerFocus: () => ({ active: false }),
}));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => ({ isReady: true, tenantId: 'tenant', employeeId: 'employee', displayName: 'Testkonto' }) }));
vi.mock('@/liquid-command/foundation/useLiquidLayout', () => ({ useLiquidLayout: () => ({ width: state.width, isPhone: state.width < 600 }) }));
vi.mock('@/liquid-command/components/LiquidPrimitives', () => ({
  LiquidBackdrop: 'Backdrop', LiquidButton: 'Button', LiquidIconButton: 'IconButton',
  LiquidGlyph: 'Glyph', LiquidLogo: 'Logo', LiquidSurface: 'Surface', LiquidVisualModeProvider: 'Mode',
}));
vi.mock('@/components/portal/accessibility/PortalTextSizeControls', () => ({ PortalTextSizeControls: 'TextSize' }));
vi.mock('@/design/web/WebFontScaleProvider', () => ({ useWebFontScaleValue: () => 1 }));
vi.mock('@/design/tokens/portalPremium', async (original) => ({ ...await original<object>(), PortalPremiumProvider: 'Theme' }));
vi.mock('@/lib/employeeLogbook', () => ({ flushLogbookPointQueue: vi.fn(), resumeActiveEmployeeLogbookTracking: vi.fn() }));
vi.mock('@/features/liveTracking/assistLocationPointQueue', () => ({ flushAssistLocationPointQueue: vi.fn() }));

type Element = { type: string | ((props: any) => unknown); props: Record<string, any> };
function nodes(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const node = tree as Element;
  if (typeof node.type === 'function') return nodes(node.type(node.props));
  return [node, ...nodes(node.props.children)];
}
const flatStyle = (style: unknown): Record<string, any> => Object.assign({}, ...[typeof style === 'function' ? style({ pressed: false }) : style].flat(Infinity).filter(Boolean));
function shell(kind: 'employee' | 'client' = 'employee') {
  state.gate = false;
  return nodes(LiquidPortalRouteLayout({ kind, overlay: <ViewMarker /> }));
}
function ViewMarker() { return <div data-testid="gps-slot" />; }
beforeEach(() => { state.role = 'employee_portal'; state.clientSettings = null; vi.clearAllMocks(); state.path = '/portal/employee'; state.width = 360; state.bottom = 24; state.top = 24; state.left = 0; state.right = 0; state.keyboard = false; state.trip = null; state.gate = false; state.slot = 0; state.unread = 0; state.modules = ['assist']; state.selected = 'assist'; });

describe('portal navigation stays accessible during GPS and execution', () => {
  it('passes the authenticated employee photo into the header', () => {
    expect(shell().find(node => node.type === 'Avatar')?.props.avatarUrl).toBe('https://example.test/employee.png');
  });
  it.each(['/portal/employee/beratung/case', '/portal/employee/pflegetouren'])(
    'never mounts an unauthorized direct module route %s', (path) => {
      state.path = path;
      const tree = shell();
      expect(tree.some(node => node.type === 'Stack')).toBe(false);
      expect(tree.some(node => node.props.testID === 'employee-portal-module-route-guard')).toBe(true);
    },
  );
  it.each([360, 1024, 1920])('opens personal training in Assist at width %s', width => {
    state.width = width;
    const tab = shell().find(node => node.props.accessibilityLabel === 'Akademie, Meine Akademie')!;
    expect(tab).toBeDefined();
    tab.props.onPress();
    expect(state.push).toHaveBeenLastCalledWith('/portal/employee/akademie');
    state.path = '/portal/employee/akademie';
    const tree = shell();
    expect(tree.some(node => node.type === 'Stack')).toBe(true);
    expect(tree.some(node => node.props.testID === 'employee-portal-module-route-guard')).toBe(false);
    expect(tree.find(node => node.props.accessibilityLabel === 'Akademie, Meine Akademie')?.props.accessibilityState.selected).toBe(true);
  });
  it('opens the personal care tour route only in the released Pflege workspace', () => {
    state.path = '/portal/employee/pflegetouren'; state.modules = ['assist', 'pflege'];
    expect(shell().some(node => node.type === 'Stack')).toBe(false);
    state.selected = 'pflege';
    const tree = shell();
    expect(tree.some(node => node.type === 'Stack')).toBe(true);
    expect(tree.some(node => node.props.accessibilityLabel === 'Meine Pflegetouren')).toBe(true);
    expect(tree.some(node => node.props.accessibilityLabel === 'Offene Einsätze')).toBe(false);
  });
  it.each(['employee', 'client'] as const)('keeps the wide %s portal and composer above the tablet system bars', (kind) => {
    state.width = 1280; state.path = `/portal/${kind}/messages`;
    state.top = 32; state.bottom = 56; state.left = 10; state.right = 18;
    const tree = shell(kind), viewport = tree.find(node => node.props.testID === 'portal-visual-viewport')!;
    const main = kind === 'employee' ? tree.find(node => node.props.testID === 'employee-portal-header') : tree.find(node => node.type === 'View' && flatStyle(node.props.style).overflow === 'hidden' && flatStyle(node.props.style).paddingTop === state.top);
    expect(main).toBeDefined();
    expect(flatStyle(viewport.props.style)).toMatchObject({ paddingLeft: 10, paddingRight: 18 });
    expect(flatStyle(tree.find(node => node.props.testID === 'portal-navigation-footer')!.props.style).paddingBottom).toBe(56);
    expect(tree.some(node => node.props.testID === 'portal-bottom-navigation')).toBe(false);
  });
  it('does not add a second navigation-bar gap above the open keyboard', () => {
    state.width = 1280; state.keyboard = true; state.bottom = 56;
    expect(flatStyle(shell().find(node => node.props.testID === 'portal-navigation-footer')!.props.style).paddingBottom).toBe(0);
  });
  it('does not advertise a budget page to family accounts while retaining it for released client accounts', () => {
    state.width = 1280; state.path = '/portal/client'; state.clientSettings = {portalEnabled: true, showBudget: true};
    state.role = 'client_portal';
    expect(shell('client').some(node => node.props.accessibilityLabel === 'Budget')).toBe(true);
    state.role = 'family_portal';
    const family = shell('client');
    expect(family.some(node => node.props.accessibilityLabel === 'Budget')).toBe(false);
    expect(family.some(node => node.props.accessibilityLabel === 'Einsätze')).toBe(true);
  });
  it.each(['/portal/employee', '/portal/employee/assignments/visit/execute'])('keeps every navigation action callable on %s', (path) => {
    state.path = path;
    const tree = shell();
    const navigation = tree.find((node) => node.props.testID === 'employee-portal-symbol-navigation')!;
    expect(navigation).toBeDefined();
    const tabs = nodes(navigation).filter((node) => node.props.accessibilityRole === 'tab');
    const routes = employeePortalNavigation(state.selected).map(item => item.route);
    expect(tabs).toHaveLength(routes.length);
    for (const tab of tabs) tab.props.onPress();
    expect(state.push.mock.calls.map(([route]) => route).sort()).toEqual(routes.sort());
    expect(nodes(navigation).some(node => node.props.accessibilityLabel === 'Alle Portalbereiche öffnen')).toBe(true);
  });
  it('puts one readable caption under each icon on the narrow rail and retains full names', () => {
    state.width = 320;
    const tree = shell();
    const navigation = tree.find(node => node.props.testID === 'employee-portal-symbol-navigation')!;
    const tabs = nodes(navigation).filter(node => node.props.accessibilityRole === 'tab');
    const captions = tabs.map(tab => nodes(tab).find(node => node.type === 'Text')?.props.children);
    expect(captions.slice(0, 7)).toEqual(['Übersicht', 'Einsätze', 'Prüfen', 'Doku', 'Klienten', 'Kalender', 'Zeitkonto']);
    expect(captions).toContain('Dateien');
    expect(captions).toContain('Hilfe');
    for (const tab of tabs) {
      expect(tab.props.accessibilityLabel.length).toBeGreaterThan(2);
      expect(flatStyle(tab.props.style).width).toBeGreaterThanOrEqual(44);
    }
    for (const caption of captions) expect(caption).toMatch(/^\S+$/);
    const open = tabs.find(node => node.props.accessibilityLabel === 'Prüfen, Offene Einsätze');
    expect(open).toBeDefined(); open!.props.onPress();
    expect(state.push).toHaveBeenCalledWith('/portal/employee/offene-einsaetze');
  });
  it.each(['employee', 'client'] as const)('keeps full accessible names and destinations behind the short %s plan label', (kind) => {
    if (kind === 'client') { state.role = 'client_portal'; state.path = '/portal/client'; }
    const navigation = shell(kind).find(node => node.props.testID === (kind === 'employee' ? 'employee-portal-symbol-navigation' : 'portal-bottom-navigation'))!;
    const plan = nodes(navigation).find(node => node.props.accessibilityLabel === 'Einsätze')!;
    if (kind === 'client') expect(nodes(plan).some(node => node.type === 'Text' && node.props.children === 'Plan')).toBe(true);
    else expect(plan.props.accessibilityHint).toBe('Einsätze');
    plan.props.onPress();
    expect(state.push).toHaveBeenCalledWith(kind === 'employee' ? '/portal/employee/assignments' : '/portal/client/appointments');
    if (kind === 'employee') {
      const logbook = nodes(navigation).find(node => node.props.accessibilityLabel === 'Fahrten, Fahrtenbuch')!;
      expect(logbook.props.accessibilityHint).toBe('Fahrtenbuch');
      logbook.props.onPress();
      expect(state.push).toHaveBeenCalledWith('/portal/employee/fahrtenbuch');
    }
  });
  it.each([[0, undefined], [1, '1'], [123, '99+']] as const)('keeps compact unread count %s readable and the exact count accessible', (count, badge) => {
    state.unread = count;
    const tree = shell();
    const label = count > 0 ? `Postfach, Nachrichten, ${count} ungelesene Nachrichten` : 'Postfach, Nachrichten';
    const navigation = tree.find(node => node.props.testID === 'employee-portal-symbol-navigation')!;
    const chat = nodes(navigation).find(node => node.props.accessibilityLabel === label)!;
    expect(chat).toBeDefined();
    expect(nodes(chat).filter(node => node.type === 'Text').map(node => node.props.children)).toEqual(badge ? ['Postfach', badge] : ['Postfach']);
    chat.props.onPress();
    expect(state.push).toHaveBeenCalledWith('/portal/employee/messages');
  });
  it('retains the client document destination and accessible name behind the short record label', () => {
    state.role = 'client_portal'; state.path = '/portal/client';
    const navigation = shell('client').find(node => node.props.testID === 'portal-bottom-navigation')!;
    const documents = nodes(navigation).find(node => node.props.accessibilityLabel === 'Dokumente')!;
    expect(nodes(documents).some(node => node.type === 'Text' && node.props.children === 'Akte')).toBe(true);
    documents.props.onPress();
    expect(state.push).toHaveBeenCalledWith('/portal/client/documents');
  });
  it.each([0, 24, 48])('reserves the GPS row and navigation above system inset %s', (inset) => {
    state.bottom = inset;
    const footer = shell().find((node) => node.props.testID === 'portal-navigation-footer')!;
    const content = nodes(footer);
    const gpsIndex = content.findIndex((node) => node.props['data-testid'] === 'gps-slot');
    expect(gpsIndex).toBeGreaterThan(0);
    const navigation = shell().find(node => node.props.testID === 'employee-portal-symbol-navigation')!;
    expect(navigation).toBeDefined();
    expect(flatStyle(footer.props.style).paddingBottom).toBeGreaterThanOrEqual(inset);
    expect(flatStyle(navigation.props.style).position).not.toBe('absolute');
    expect(flatStyle(footer.props.style).flexShrink).toBe(0);
  });
  it('keeps desktop navigation actions callable during execution with system insets', () => {
    state.width = 1280; state.path = '/portal/employee/assignments/visit/execute';
    state.top = 32; state.bottom = 56;
    const tabs = shell().filter((node) => node.props.accessibilityRole === 'tab');
    expect(tabs.length).toBeGreaterThan(5);
    for (const tab of tabs) {
      expect(tab.props.onPress).toBeTypeOf('function');
      tab.props.onPress();
    }
    expect(state.push).toHaveBeenCalledTimes(tabs.length);
    expect(state.push).toHaveBeenCalledWith('/portal/employee/assignments');
    expect(state.push).toHaveBeenCalledWith('/portal/employee/fahrtenbuch');
    expect(state.push).toHaveBeenCalledWith('/portal/employee/offene-einsaetze');
  });
  it('opens the active approach directly in its assignment', () => {
    state.gate = true;
    state.trip = { assignmentId: 'visit', routeType: 'home_to_client' };
    const tree = nodes(EmployeeLogbookLifecycleGate());
    tree.find((node) => node.props.testID === 'employee-active-logbook-banner')!.props.onPress();
    expect(state.push).toHaveBeenCalledWith({ pathname: '/portal/employee/assignments/[id]/execute', params: { id: 'visit' } });
    expect(flatStyle(tree[0].props.style).position).not.toBe('absolute');
  });
  it('shows no second GPS banner on any execution route', () => {
    state.gate = true; state.path = '/portal/employee/assignments/other-visit/execute';
    state.trip = { assignmentId: 'visit', routeType: 'home_to_client' };
    expect(EmployeeLogbookLifecycleGate()).toBeNull();
  });
});
