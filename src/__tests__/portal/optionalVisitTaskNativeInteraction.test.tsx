import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeePortalVisitTasksPanel } from '@/components/portal/EmployeePortalVisitTasksPanel';

const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, effects: [] as (() => unknown)[],
  add: vi.fn(), update: vi.fn() }));
vi.mock('react', async original => ({ ...await original<object>(),
  useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn,
  useState: (initial: any) => { const i = h.cursor++; if (!(i in h.slots)) h.slots[i] = typeof initial === 'function' ? initial() : initial;
    return [h.slots[i], (value: any) => { h.slots[i] = typeof value === 'function' ? value(h.slots[i]) : value; }]; },
  useRef: (value: unknown) => { const i = h.cursor++; return h.slots[i] ??= { current: value }; },
  useEffect: (fn: () => unknown) => h.effects.push(fn),
}));
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable',
  useWindowDimensions: () => ({ width: 390, height: 844 }), Platform: { OS: 'android' }, StyleSheet: { create: (s: unknown) => s },
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => '10000000-0000-4000-8000-000000000021' }));
vi.mock('@/components/layout/platform/platformmodal', () => ({ PlatformModal: 'TaskModal' }));
vi.mock('@/components/ui', () => ({ PremiumButton: 'Button', PremiumInput: 'Input' }));
vi.mock('@/hooks/platform/useDeviceClass', () => ({ useDeviceClass: () => 'phone' }));
vi.mock('@/lib/platform/breakpoints', () => ({ isPhoneClass: () => true }));
vi.mock('@/lib/portal/employeePortalExecutionSurface', () => ({ employeePortalExecutionSurface: {}, employeePortalExecutionText: {} }));
vi.mock('@/theme', () => ({ colors: {}, spacing: { lg: 24, sm: 8, md: 16, xs: 4 }, typography: {} }));
function nodes(value: any): any[] {
  return Array.isArray(value) ? value.flatMap(nodes) : value?.props ? [value, ...nodes(value.props.children)] : [];
}
function render(canAdd = true) {
  h.cursor = 0;
  const tree = nodes(EmployeePortalVisitTasksPanel({ tasks: [], canAdd, onAddTasks: h.add, onUpdateTask: h.update }));
  h.effects.splice(0).forEach(fn => fn()); return tree;
}
const input = (id: string) => render().find(node => node.props.testID === id);
function footer(title: string) { return render()[0].props.footerActions.find((action: any) => action.title === title); }
beforeEach(() => { vi.clearAllMocks(); h.slots = []; h.effects = [];
  h.add.mockResolvedValue({ ok: true, inserted: 1, tasks: [] }); h.update.mockResolvedValue({ ok: true }); });
describe('native optional task selection and persistence feedback', () => {
  it('opens a usable task catalog on an empty visit and filters German titles', () => {
    expect(input('optional-task-search')).toBeDefined();
    input('optional-task-search').props.onChangeText('wäsche');
    const choices = render().filter(node => node.props.testID?.startsWith('optional-task-choice-'));
    expect(choices.length).toBeGreaterThan(0);
    expect(choices.some(node => /wäsche/i.test(node.props.accessibilityLabel))).toBe(true);
  });
  it('adds a manual task using a stable UUID and clears it only on confirmed success', async () => {
    render().find(node => node.type === 'Button' && node.props.title === 'Eigene Aufgabe').props.onPress();
    input('optional-task-manual-title').props.onChangeText('  Briefkasten leeren  ');
    footer('Eigene Aufgabe hinzufügen').onPress();
    await vi.waitFor(() => expect(h.add).toHaveBeenCalledTimes(1));
    expect(h.add).toHaveBeenCalledWith([{ id: '10000000-0000-4000-8000-000000000021', title: 'Briefkasten leeren' }]);
    await vi.waitFor(() => expect(input('optional-task-manual-title').props.value).toBe(''));
  });
  it('retains manual text and id on an unconfirmed write and prevents duplicate requests', async () => {
    let finish!: (result: unknown) => void;
    h.add.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render().find(node => node.type === 'Button' && node.props.title === 'Eigene Aufgabe').props.onPress();
    input('optional-task-manual-title').props.onChangeText('Briefkasten leeren');
    const send = footer('Eigene Aufgabe hinzufügen').onPress;
    send(); send(); expect(h.add).toHaveBeenCalledTimes(1);
    finish({ ok: false, error: 'Verbindung unterbrochen' });
    await vi.waitFor(() => expect(render()[0].props.footerContent.props.children).toBe('Verbindung unterbrochen'));
    expect(input('optional-task-manual-title').props.value).toBe('Briefkasten leeren');
    h.add.mockResolvedValue({ ok: true, inserted: 0, tasks: [] });
    footer('Eigene Aufgabe hinzufügen').onPress();
    await vi.waitFor(() => expect(h.add).toHaveBeenCalledTimes(2));
    expect(h.add.mock.calls[0][0][0].id).toBe(h.add.mock.calls[1][0][0].id);
  });
  it('makes catalog choices read-only in a locked visit', () => {
    const choices = render(false).filter(node => node.props.testID?.startsWith('optional-task-choice-'));
    expect(choices.length).toBeGreaterThan(0); expect(choices.every(node => node.props.disabled)).toBe(true);
    expect(h.add).not.toHaveBeenCalled();
  });
});
