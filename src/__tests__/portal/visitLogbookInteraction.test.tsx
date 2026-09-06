import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeePortalVisitLogbookCard } from '@/components/portal/EmployeePortalVisitLogbookCard';
import { EmployeePortalVisitStickyHeader } from '@/components/portal/EmployeePortalVisitStickyHeader';
import type { LogbookTrip } from '@/types/modules/employeeLogbook';

// Execute the real component handlers/effects. Only rendering, scheduling and
// the persistence/device boundaries are replaced; no source-text assertions.
const harness = vi.hoisted(() => {
  type Effect = { run: () => void | (() => void); deps?: readonly unknown[]; cleanup?: () => void; pending: boolean };
  const slots: unknown[] = []; const effects = new Map<number, Effect>(); let cursor = 0;
  const same = (a?: readonly unknown[], b?: readonly unknown[]) => Boolean(a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i])));
  return {
    begin: () => { cursor = 0; },
    reset: () => { slots.length = 0; effects.clear(); cursor = 0; },
    flush: () => { for (const e of effects.values()) { if (e.pending) { e.pending = false; e.cleanup?.(); e.cleanup = e.run() || undefined; } } },
    unmount: () => { for (const e of effects.values()) e.cleanup?.(); },
    useRef: (initial: unknown) => { const i = cursor++; slots[i] ??= { current: initial }; return slots[i]; },
    useState: (initial: unknown) => {
      const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], (next: unknown) => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }];
    },
    useCallback: (callback: unknown, deps: readonly unknown[]) => {
      const i = cursor++; const old = slots[i] as { callback: unknown; deps: readonly unknown[] } | undefined;
      if (!old || !same(old.deps, deps)) slots[i] = { callback, deps };
      return (slots[i] as { callback: unknown }).callback;
    },
    useEffect: (run: Effect['run'], deps?: readonly unknown[]) => {
      const i = cursor++; const old = effects.get(i);
      effects.set(i, { run, deps, cleanup: old?.cleanup, pending: !old || old.pending || !same(old.deps, deps) });
    },
  };
});
const mocks = vi.hoisted(() => ({ load: vi.fn(), eligible: vi.fn(), finish: vi.fn(), confirm: vi.fn(), start: vi.fn(), focus: null as ((state: string) => void) | null }));
vi.mock('react', async (original) => ({ ...await original<object>(), ...harness }));
vi.mock('react-native', () => ({
  AppState: { addEventListener: (_: string, cb: (state: string) => void) => { mocks.focus = cb; return { remove: vi.fn() }; } },
  Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default }, StyleSheet: { create: (v: unknown) => v },
  View: 'View', Text: 'Text', Modal: 'Modal', ScrollView: 'ScrollView',
  KeyboardAvoidingView: 'KeyboardAvoidingView', Pressable: 'Pressable', Image: 'Image',
}));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) }));
vi.mock('@/components/ui', () => ({ InfoBanner: 'InfoBanner', PremiumButton: 'PremiumButton', PremiumInput: 'PremiumInput', SectionPanel: 'SectionPanel', PremiumBadge: 'PremiumBadge' }));
vi.mock('@/components/brand/brandassets', () => ({ CARESUITE_VISIT_GUIDE_MASCOT: 'robot' }));
vi.mock('@/components/portal/EmployeePortalVisitProgressSteps', () => ({ EmployeePortalVisitProgressSteps: 'ProgressSteps' }));
vi.mock('@/lib/employeeLogbook', () => ({
  loadEmployeeLogbook: mocks.load, resolveEmployeeLogbookEligibility: mocks.eligible,
  finishVisitApproachLogbook: mocks.finish, finishActiveVisitLogbookTrip: mocks.finish,
  confirmEmployeeLogbookTrip: mocks.confirm, startVisitServiceLogbookTrip: mocks.start,
}));

type Node = { type?: unknown; props: Record<string, any> };
function nodes(tree: unknown): Node[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const node = tree as Node;
  return [node, ...nodes(node.props.children)];
}
const props = { tenantId: 'tenant', employeeId: 'employee', assignmentId: 'e950fc62-6962-465b-b7fa-334f84f84ed7', clientId: 'client', clientName: 'Testklient', startAddress: 'Teststraße', transportMode: 'car' as const, phase: 'en_route', onConfirmationRequiredChange: vi.fn() };
let current = { ...props };
let trips: LogbookTrip[] = [];
function trip(status: LogbookTrip['status']): LogbookTrip { return { id: 'trip', ...props, purpose: 'Anfahrt', routeType: 'home_to_client', startedAt: '2026-09-06T07:00:00Z', distanceFinalKm: 1.2, status } as unknown as LogbookTrip; }
function render() { harness.begin(); const tree = EmployeePortalVisitLogbookCard(current); harness.flush(); return nodes(tree); }
async function settle() { for (let i = 0; i < 5; i += 1) { await new Promise((resolve) => setTimeout(resolve, 0)); render(); } return render(); }
function button(tree: Node[], title: string) { const found = tree.find((n) => n.props.title === title); if (!found) throw new Error('Missing button: ' + title); return found.props; }
beforeEach(() => {
  harness.reset(); vi.clearAllMocks(); trips = []; current = { ...props }; mocks.focus = null;
  mocks.load.mockImplementation(async () => ({ trips: [...trips] }));
  mocks.eligible.mockResolvedValue({ eligible: true });
  mocks.finish.mockImplementation(async () => { trips = [trip('confirmation_required')]; return trips[0]; });
  mocks.confirm.mockImplementation(async () => { trips = [trip('confirmed')]; });
  mocks.start.mockResolvedValue({ started: true });
});
afterEach(() => harness.unmount());

describe('employee arrival card and optional robot help', () => {
  it('keeps service blocked while its initial data is loading', () => {
    mocks.load.mockImplementation(() => new Promise(() => undefined));
    render();
    expect(props.onConfirmationRequiredChange).toHaveBeenLastCalledWith(true);
  });
  it('finishes a late-confirmed arrival and presents kilometres without another arrival tap', async () => {
    trips = [trip('recording')]; render(); await settle();
    expect(mocks.finish).not.toHaveBeenCalled();
    current.phase = 'arrived'; render(); const tree = await settle();
    expect(mocks.finish).toHaveBeenCalledTimes(1);
    expect(tree.find((node) => node.type === 'Modal')?.props.visible).toBe(true);
    expect(button(tree, 'Kilometer bestätigen').disabled).toBe(false);
    expect(props.onConfirmationRequiredChange).toHaveBeenLastCalledWith(true);
    button(tree, 'Kilometer bestätigen').onPress();
    await settle();
    expect(props.onConfirmationRequiredChange).toHaveBeenLastCalledWith(false);
  });
  it('recovers an active approach after an app restart in arrived phase', async () => {
    current.phase = 'arrived'; trips = [trip('recording')]; render(); await settle();
    expect(mocks.finish).toHaveBeenCalledTimes(1);
  });
  it('does not repeat a failing automatic close on each render', async () => {
    current.phase = 'arrived'; trips = [trip('recording')];
    mocks.finish.mockRejectedValue(new Error('offline'));
    render(); await settle(); await settle();
    expect(mocks.finish).toHaveBeenCalledTimes(1);
    expect(props.onConfirmationRequiredChange).toHaveBeenLastCalledWith(true);
  });
  it('preserves edited kilometres across app focus and duplicate taps', async () => {
    trips = [trip('confirmation_required')]; render(); let tree = await settle();
    tree.find((n) => n.props.label === 'Gefahrene Kilometer')!.props.onChangeText('1,5');
    tree = render();
    tree.find((n) => n.props.label?.startsWith('Korrektur'))!.props.onChangeText('Umleitung');
    mocks.focus?.('active'); tree = await settle();
    expect(tree.find((n) => n.props.label === 'Gefahrene Kilometer')?.props.value).toBe('1,5');
    const confirm = button(tree, 'Kilometer bestätigen').onPress;
    confirm(); confirm(); await settle();
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ distanceKm: 1.5, reason: 'Umleitung' }));
  });
  it('keeps the confirmation pending when its window is dismissed', async () => {
    trips = [trip('confirmation_required')]; render(); let tree = await settle();
    button(tree, 'Zur Einsatzansicht').onPress(); tree = render();
    expect(tree.find((n) => n.type === 'Modal')?.props.visible).toBe(false);
    expect(props.onConfirmationRequiredChange).toHaveBeenLastCalledWith(true);
    button(tree, 'Kilometer prüfen und bestätigen').onPress();
    expect(render().find((n) => n.type === 'Modal')?.props.visible).toBe(true);
  });
  it('shows refresh failures instead of treating stale data as no pending kilometres', async () => {
    render(); await settle(); mocks.load.mockRejectedValue(new Error('Verbindung verloren'));
    mocks.focus?.('active'); const tree = await settle();
    expect(tree.find((n) => n.props.message === 'Verbindung verloren')).toBeDefined();
    expect(props.onConfirmationRequiredChange).toHaveBeenLastCalledWith(true);
  });
  it('shows a failed confirmation inside the open kilometre dialog', async () => {
    trips = [trip('confirmation_required')]; mocks.confirm.mockRejectedValue(new Error('Keine Schreibberechtigung'));
    render(); const tree = await settle(); button(tree, 'Kilometer bestätigen').onPress();
    const after = await settle(); const modal = after.find((n) => n.type === 'Modal')!;
    expect(nodes(modal).some((n) => n.props.children === 'Keine Schreibberechtigung')).toBe(true);
    expect(props.onConfirmationRequiredChange).toHaveBeenLastCalledWith(true);
  });
  it('opens robot explanations only after tapping i, and supports closing them', () => {
    const headerProps = { clientName: 'Testklient', plannedStartAt: '2026-09-06T08:00:00Z', plannedEndAt: '2026-09-06T09:00:00Z', effectiveStatus: 'angekommen' as const, timers: null, guideMessage: 'Bitte Kilometer prüfen.' };
    const header = () => { harness.begin(); return nodes(EmployeePortalVisitStickyHeader(headerProps)); };
    let tree = header();
    expect(tree.find((n) => n.type === 'Modal')?.props.visible).toBe(false);
    tree.find((n) => n.props.testID === 'employee-visit-guide-toggle')!.props.onPress(); tree = header();
    expect(tree.find((n) => n.type === 'Modal')?.props.visible).toBe(true);
    button(tree, 'Verstanden · zurück zum Einsatz').onPress();
    expect(header().find((n) => n.type === 'Modal')?.props.visible).toBe(false);
  });
});
