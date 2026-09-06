import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LiquidPortalRouteLayout } from '@/liquid-command/shell/LiquidPortalRouteLayout';
import { EmployeeLogbookLifecycleGate } from '@/components/portal/EmployeeLogbookLifecycleGate';

const state = vi.hoisted(() => ({
  path: '/portal/employee', width: 360, bottom: 24,
  trip: null as Record<string, unknown> | null, gate: false, slot: 0,
  replace: vi.fn(), push: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...await original<object>(),
  useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn,
  useEffect: () => undefined,
  useState: (value: unknown) => [state.gate && state.slot++ === 0 ? state.trip : value, vi.fn()],
}));
vi.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', Modal: 'Modal',
  Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock('expo-router', () => ({
  Stack: 'Stack', usePathname: () => state.path,
  useRouter: () => ({ replace: state.replace, push: state.push }),
}));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: state.bottom }) }));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ profile: { displayName: 'Testkonto' }, signOut: vi.fn() }),
  RequireAuth: 'RequireAuth', RequireEmployeePasswordSetup: 'RequireEmployeePasswordSetup', RequireRole: 'RequireRole',
}));
vi.mock('@/hooks/useportalofficemessages', () => ({ usePortalOfficeMessages: () => ({ threads: [] }) }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => ({ isReady: true, tenantId: 'tenant', employeeId: 'employee' }) }));
vi.mock('@/liquid-command/foundation/useLiquidLayout', () => ({ useLiquidLayout: () => ({ width: state.width, isPhone: state.width < 600 }) }));
vi.mock('@/liquid-command/components/LiquidPrimitives', () => ({
  LiquidBackdrop: 'Backdrop', LiquidButton: 'Button', LiquidIconButton: 'IconButton',
  LiquidGlyph: 'Glyph', LiquidLogo: 'Logo', LiquidSurface: 'Surface', LiquidVisualModeProvider: 'Mode',
}));
vi.mock('@/components/portal/accessibility/PortalTextSizeControls', () => ({ PortalTextSizeControls: 'TextSize' }));
vi.mock('@/design/tokens/portalPremium', () => ({ PortalPremiumProvider: 'Theme' }));
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
const flatStyle = (style: unknown): Record<string, any> => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
function shell() {
  state.gate = false;
  return nodes(LiquidPortalRouteLayout({ kind: 'employee', overlay: <ViewMarker /> }));
}
function ViewMarker() { return <div data-testid="gps-slot" />; }
beforeEach(() => { vi.clearAllMocks(); state.path = '/portal/employee'; state.width = 360; state.bottom = 24; state.trip = null; state.gate = false; state.slot = 0; });

describe('portal navigation stays accessible during GPS and execution', () => {
  it.each(['/portal/employee', '/portal/employee/assignments/visit/execute'])('keeps every navigation action callable on %s', (path) => {
    state.path = path;
    const tree = shell();
    const navigation = tree.find((node) => node.props.testID === 'portal-bottom-navigation')!;
    expect(navigation).toBeDefined();
    const tabs = nodes(navigation).filter((node) => node.props.accessibilityRole === 'tab');
    expect(tabs.length).toBeGreaterThanOrEqual(5);
    for (const tab of tabs) tab.props.onPress();
    expect(state.replace).toHaveBeenCalledTimes(tabs.length);
    expect(nodes(navigation).some((node) => node.props.accessibilityLabel === 'Weitere Portalbereiche öffnen')).toBe(true);
  });
  it.each([0, 24, 48])('reserves the GPS row and navigation above system inset %s', (inset) => {
    state.bottom = inset;
    const footer = shell().find((node) => node.props.testID === 'portal-navigation-footer')!;
    const content = nodes(footer);
    const navIndex = content.findIndex((node) => node.props.testID === 'portal-bottom-navigation');
    const gpsIndex = content.findIndex((node) => node.props['data-testid'] === 'gps-slot');
    expect(gpsIndex).toBeGreaterThan(0);
    expect(navIndex).toBeGreaterThan(gpsIndex);
    expect(flatStyle(footer.props.style).paddingBottom).toBeGreaterThanOrEqual(inset);
    expect(flatStyle(content[navIndex].props.style).position).not.toBe('absolute');
    expect(flatStyle(footer.props.style).flexShrink).toBe(0);
  });
  it('keeps the desktop rail accessible in execution', () => {
    state.width = 1280; state.path = '/portal/employee/assignments/visit/execute';
    expect(shell().filter((node) => node.props.accessibilityRole === 'tab').length).toBeGreaterThan(5);
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
