import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubscriptionWorkspaceSnapshot } from '@/lib/business/subscriptionWorkspaceService.web';

// This suite verifies the actual JSX state transitions and event wiring. It does
// not substitute for browser layout, focus management or visual acceptance.
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0 }));
vi.mock('react', () => ({
  useId: () => 'subscription-test',
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.slots)) hooks.slots[index] = initial;
    return [hooks.slots[index], (next: unknown) => {
      hooks.slots[index] = typeof next === 'function' ? next(hooks.slots[index]) : next;
    }];
  },
}));
vi.mock('react/jsx-runtime', () => ({
  jsx: (type: unknown, props: unknown) => ({ type, props }),
  jsxs: (type: unknown, props: unknown) => ({ type, props }),
  Fragment: 'fragment',
}));
vi.mock('@/liquid-command/components/DesktopCatalogArtwork.web', () => ({ DesktopCatalogArtwork: () => null }));
vi.mock('@/liquid-command/components/DesktopCatalogIcon.web', () => ({ DesktopCatalogIcon: () => null }));
import { SubscriptionWorkspace, type SubscriptionWorkspaceProps } from '@/screens/business/SubscriptionWorkspace.web';

type Element = { type: unknown; props: Record<string, unknown> & { children?: unknown } };
function isElement(value: unknown): value is Element {
  return Boolean(value && typeof value === 'object' && 'type' in value && 'props' in value);
}
function nodes(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  return isElement(value) ? [value, ...nodes(value.props.children)] : [];
}
function text(value: unknown): string {
  if (value == null || typeof value === 'boolean') return '';
  if (Array.isArray(value)) return value.map(text).join('');
  if (isElement(value)) return text(value.props.children);
  return String(value);
}
function findButton(tree: unknown, label: string): Element {
  const found = nodes(tree).find(node => node.type === 'button' && text(node) === label);
  if (!found) throw new Error(`Button not found: ${label}`);
  return found;
}
function click(button: Element) {
  expect(button.props.disabled).not.toBe(true);
  (button.props.onClick as () => void)();
}
const data: SubscriptionWorkspaceSnapshot = {
  tenantId: 'company-a', tenantName: 'Sonnenweg', source: 'live', loadedAt: '2026-10-20T09:00:00.000Z', monthlyTotal: 0,
  activeModuleCount: 3, totalModuleCount: 6, platformFeatureCount: 6, preparedModuleCount: 1, inactiveModuleCount: 1, blockedModuleCount: 1,
  modules: [
    { key: 'office', status: 'active', reason: 'Basis enthalten.', route: '/office', canOpen: true },
    { key: 'assist', status: 'active', reason: 'Freigegeben.', route: '/assist', canOpen: true },
    { key: 'pflege', status: 'active', reason: 'Freigegeben.', route: '/pflege', canOpen: false },
    { key: 'beratung', status: 'inactive', reason: 'Nicht aktiviert.', route: '/beratung', canOpen: false },
    { key: 'stationaer', status: 'prepared', reason: 'Noch nicht veröffentlicht.', route: '/stationaer', canOpen: false },
    { key: 'akademie', status: 'blocked', reason: 'Durch Verwaltung gesperrt.', route: '/akademie', canOpen: false },
  ],
};
function setup(overrides: Partial<SubscriptionWorkspaceProps> = {}) {
  const props: SubscriptionWorkspaceProps = {
    data, loading: false, error: null, roleLabel: 'Verwaltung', onRefresh: vi.fn(), onOpenApps: vi.fn(),
    moduleActions: { office: vi.fn(), assist: vi.fn() }, ...overrides,
  };
  const render = () => { hooks.cursor = 0; return SubscriptionWorkspace(props); };
  return { props, render };
}
beforeEach(() => { hooks.slots = []; hooks.cursor = 0; });

describe('Subscription workspace interactions', () => {
  it('filters actual module states and restores all modules', () => {
    const { render } = setup();
    let tree = render();
    expect(nodes(tree).filter(node => node.type === 'article')).toHaveLength(6);
    click(findButton(tree, 'Freigeschaltet3')); tree = render();
    expect(nodes(tree).filter(node => node.type === 'article')).toHaveLength(3);
    expect(findButton(tree, 'Freigeschaltet3').props['aria-pressed']).toBe(true);
    click(findButton(tree, 'Weitere3')); tree = render();
    expect(nodes(tree).filter(node => node.type === 'article').map(text).join(' ')).not.toContain('CareSuite+ Office');
    click(findButton(tree, 'Alle6')); tree = render();
    expect(nodes(tree).filter(node => node.type === 'article')).toHaveLength(6);
  });

  it('combines case-insensitive search with filters and resets an empty result', () => {
    const { render } = setup();
    let tree = render();
    const search = () => nodes(tree).find(node => node.type === 'input')!;
    (search().props.onChange as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value: '  bErAtUnG  ' } });
    tree = render();
    expect(nodes(tree).filter(node => node.type === 'article')).toHaveLength(1);
    expect(nodes(tree).filter(node => node.type === 'article').map(text).join('')).toContain('CareSuite+ Beratung');
    click(findButton(tree, 'Freigeschaltet3')); tree = render();
    expect(nodes(tree).filter(node => node.type === 'article')).toHaveLength(0);
    expect(text(tree)).toContain('Keine passenden Module');
    click(findButton(tree, 'Filter zurücksetzen')); tree = render();
    expect(nodes(tree).filter(node => node.type === 'article')).toHaveLength(6);
    expect(search().props.value).toBe('');
  });

  it('opens only active destinations whose action was supplied', () => {
    const blocked = vi.fn();
    const { props, render } = setup({ moduleActions: { office: vi.fn(), akademie: blocked } });
    const tree = render();
    const open = nodes(tree).filter(node => node.type === 'button' && node.props['aria-label'] === 'Office öffnen');
    expect(open).toHaveLength(1);
    click(open[0]); expect(props.moduleActions.office).toHaveBeenCalledTimes(1);
    expect(nodes(tree).some(node => node.type === 'button' && node.props['aria-label'] === 'Akademie öffnen')).toBe(false);
    expect(blocked).not.toHaveBeenCalled();
    expect(text(tree)).toContain('Für Ihre Rolle ist hier kein direkter Zugang verfügbar.');
  });

  it('wires refresh and Apps & Widgets to their supplied actions', () => {
    const { props, render } = setup(); const tree = render();
    click(findButton(tree, 'Aktualisieren')); click(findButton(tree, 'Apps & Widgets'));
    expect(props.onRefresh).toHaveBeenCalledTimes(1); expect(props.onOpenApps).toHaveBeenCalledTimes(1);
  });

  it('keeps available actions visible but disabled while refreshing', () => {
    const { render } = setup({ loading: true }); const tree = render();
    expect(findButton(tree, 'Wird aktualisiert…').props.disabled).toBe(true);
    expect(findButton(tree, 'Apps & Widgets').props.disabled).toBe(true);
    const office = nodes(tree).find(node => node.type === 'button' && node.props['aria-label'] === 'Office öffnen');
    expect(office?.props.disabled).toBe(true);
    expect(text(tree)).toContain('Status wird aktualisiert…');
  });

  it('announces stale data after refresh failure and still permits retry', () => {
    const { props, render } = setup({ error: 'Verbindung unterbrochen.' }); const tree = render();
    const alert = nodes(tree).find(node => node.props.role === 'alert');
    expect(text(alert)).toContain('letzten erfolgreichen Abruf');
    expect(text(alert)).toContain('Verbindung unterbrochen.');
    expect(findButton(tree, 'Apps & Widgets').props.disabled).toBe(true);
    expect(nodes(tree).find(node => node.type === 'button' && node.props['aria-label'] === 'Office öffnen')?.props.disabled).toBe(true);
    click(findButton(tree, 'Aktualisieren')); expect(props.onRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not offer Apps & Widgets when no action is provided', () => {
    const { render } = setup({ onOpenApps: null });
    expect(nodes(render()).some(node => node.type === 'button' && text(node) === 'Apps & Widgets')).toBe(false);
  });

  it('labels demo snapshots and tolerates an unavailable timestamp', () => {
    const { render } = setup({ data: { ...data, source: 'demo', loadedAt: 'invalid' } }); const tree = render();
    expect(text(tree)).toContain('Demo'); expect(text(tree)).toContain('Status abgerufen · Beispieldaten');
  });
});
