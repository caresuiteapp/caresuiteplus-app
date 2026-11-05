// @vitest-environment happy-dom
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PermissionKey } from '@/types';
import type { PermissionCatalogEntry } from '@/types/permissions/rbac';
import { buildPermissionCatalogEntries } from '@/lib/permissions/permissionCatalogSeedData';
import { findPermissionKeyForAreaAction } from '@/lib/permissions/permissionChangeHelpers';

const { retained } = vi.hoisted(() => ({ retained: new Map<string, () => void>() }));
// Render the actual editor with platform/style hosts replaced. These interaction
// tests do not claim browser layout or native accessibility acceptance.
vi.mock('react-native', () => ({
  View: ({ children }: any) => <div>{children}</div>,
  Text: ({ children }: any) => <span>{children}</span>,
  Pressable: ({ children, onPress, disabled, accessibilityRole, accessibilityLabel, accessibilityState }: any) => {
    retained.set(accessibilityLabel, onPress);
    return <button type="button" role={accessibilityRole} aria-label={accessibilityLabel}
      aria-checked={accessibilityState?.checked} disabled={disabled} onClick={onPress}>{children}</button>;
  },
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
}));
vi.mock('@/components/ui', () => ({
  PremiumBadge: ({ label }: any) => <span>{label}</span>,
  PremiumInput: () => null,
}));
vi.mock('@/design/tokens/carelightadaptive', () => ({
  useAdaptiveContentStyles: () => ({ body: {}, caption: {}, primary: { color: '#fff' }, secondary: { color: '#aaa' }, muted: { color: '#777' } }),
}));
vi.mock('@/theme', () => ({ spacing: { xs: 4, sm: 8 } }));
import { RbacModulePermissionEditor } from '@/components/office/rbac/RbacModulePermissionEditor';

const catalog = buildPermissionCatalogEntries();
const pflegeCatalog = catalog.filter(entry => entry.module === 'pflege');
const capture = vi.fn();
let root: Root, host: HTMLDivElement, selected: PermissionKey[];
let config: { scope: string; tab: string; canEdit: boolean; search: string; risk: string | null; initial: PermissionKey[]; catalog: PermissionCatalogEntry[] };
function Harness() {
  const [desired, setDesired] = useState<PermissionKey[]>(config.initial);
  selected = desired;
  return <RbacModulePermissionEditor scopeKey={config.scope} tabKey={config.tab} catalog={config.catalog}
    desiredPermissions={desired} onChange={next => { capture(next); setDesired(next); }}
    canEdit={config.canEdit} search={config.search} riskFilter={config.risk} />;
}
const render = async () => { await act(async () => root.render(<Harness />)); };
const controls = () => [...host.querySelectorAll<HTMLButtonElement>('[role="checkbox"]')];
const byLabel = (label: string) => controls().find(button => button.getAttribute('aria-label') === label)!;
const forKey = (key: PermissionKey) => byLabel(catalog.find(entry => entry.key === key)!.label);
const click = async (button: HTMLButtonElement) => { await act(async () => button.click()); };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  config = { scope: JSON.stringify(['tenant', 'employee-a', 'actor', 'business_admin']), tab: 'pflege', canEdit: true, search: '', risk: null, initial: [], catalog };
  capture.mockClear(); retained.clear();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('explicit Pflege permission editor', () => {
  it('shows all 42 ungranted rights, permits the first grant and keeps the last removed right available', async () => {
    await render();
    expect(pflegeCatalog).toHaveLength(42); expect(controls()).toHaveLength(42);
    expect(controls().every(button => button.getAttribute('aria-checked') === 'false')).toBe(true);
    expect(capture).not.toHaveBeenCalled();
    await click(forKey('pflege.access'));
    expect(selected).toEqual(['pflege.access']); expect(forKey('pflege.access').getAttribute('aria-checked')).toBe('true');
    await click(forKey('pflege.access'));
    expect(selected).toEqual([]); expect(controls()).toHaveLength(42);
  });

  it('keeps reading, managing, signing, reviewing, administering and releasing distinct exact rights', async () => {
    config.initial = ['office.access']; await render();
    const keys: PermissionKey[] = ['pflege.plans.view', 'pflege.plans.manage', 'pflege.documentation.sign',
      'pflege.proofs.review', 'pflege.medications.administer', 'pflege.billing.release', 'pflege.md.readiness'];
    const expected: PermissionKey[] = ['office.access'];
    for (const key of keys) {
      await click(forKey(key)); expected.push(key);
      expect(selected).toEqual([...expected].sort()); expect(forKey(key).getAttribute('aria-checked')).toBe('true');
    }
    await click(forKey('pflege.plans.manage'));
    expect(selected).toContain('pflege.plans.view'); expect(selected).not.toContain('pflege.plans.manage');
    expect(selected).toContain('pflege.documentation.sign'); expect(selected).not.toContain('pflege.proofs.sign');
  });

  it('renders actual selected state read-only and blocks a retained editable handler after permission loss', async () => {
    config.initial = ['pflege.plans.view']; await render();
    const old = retained.get(catalog.find(entry => entry.key === 'pflege.plans.manage')!.label)!;
    config.canEdit = false; await render();
    expect(controls()).toHaveLength(42); expect(controls().every(button => button.disabled)).toBe(true);
    expect(forKey('pflege.plans.view').getAttribute('aria-checked')).toBe('true');
    await click(forKey('pflege.plans.manage')); await act(async () => old());
    expect(selected).toEqual(['pflege.plans.view']); expect(capture).not.toHaveBeenCalled();
    config.canEdit = true; await render(); await act(async () => old());
    expect(capture).not.toHaveBeenCalled();
    await click(forKey('pflege.plans.manage'));
    expect(selected).toEqual(['pflege.plans.manage', 'pflege.plans.view']);
  });

  it('filters labels and risk without removing hidden grants or granting unrelated rights', async () => {
    config.initial = ['office.access', 'pflege.plans.view']; config.search = 'Medikamentengaben'; config.risk = 'high';
    await render(); expect(controls()).toHaveLength(1);
    expect(forKey('pflege.medications.administer')).toBeDefined();
    await click(forKey('pflege.medications.administer'));
    expect(selected).toEqual(['office.access', 'pflege.medications.administer', 'pflege.plans.view']);
    config.search = 'nicht vorhanden'; await render(); expect(controls()).toHaveLength(0);
    expect(host.textContent).toContain('Keine bearbeitbaren Rechte'); expect(selected).toHaveLength(3);
  });

  it('prevents a retained control from adding a right after its tab or visible catalogue changed', async () => {
    await render(); const old = retained.get(catalog.find(entry => entry.key === 'pflege.access')!.label)!;
    config.search = 'Vitalwerte'; await render(); await act(async () => old());
    expect(capture).not.toHaveBeenCalled();
    config.search = ''; config.tab = 'assist'; await render(); await act(async () => old());
    expect(capture).not.toHaveBeenCalled();
    config.tab = 'pflege'; await render(); await act(async () => old());
    expect(capture).not.toHaveBeenCalled();
  });

  it('never transfers held employee-A actions to B or revives them after returning to A', async () => {
    await render(); const scopeA = config.scope;
    const label = catalog.find(entry => entry.key === 'pflege.access')!.label;
    const actionA = retained.get(label)!;
    config.scope = JSON.stringify(['tenant', 'employee-b', 'actor', 'business_admin']); await render();
    const actionB = retained.get(label)!;
    await act(async () => actionA()); expect(selected).toEqual([]); expect(capture).not.toHaveBeenCalled();
    config.scope = scopeA; await render();
    await act(async () => { actionA(); actionB(); });
    expect(selected).toEqual([]); expect(capture).not.toHaveBeenCalled();
    await click(forKey('pflege.access')); expect(selected).toEqual(['pflege.access']);
  });

  it('rejects held actions after the editor is unmounted', async () => {
    await render(); const old = retained.get(catalog.find(entry => entry.key === 'pflege.access')!.label)!;
    await act(async () => root.unmount());
    await act(async () => old());
    expect(selected).toEqual([]); expect(capture).not.toHaveBeenCalled();
  });

  it('keeps the current mounted controls usable during the React StrictMode lifecycle', async () => {
    await act(async () => root.render(<React.StrictMode><Harness /></React.StrictMode>));
    await click(forKey('pflege.access'));
    expect(selected).toEqual(['pflege.access']); expect(capture).toHaveBeenCalledTimes(1);
  });

  it('offers ungranted areas in other module matrices while disabling nonexistent actions', async () => {
    config.tab = 'office'; config.catalog = catalog.filter(entry => ['office.clients.view', 'office.clients.edit'].includes(entry.key));
    await render(); expect(controls()).toHaveLength(6);
    const available = controls().filter(button => !button.disabled);
    expect(available).toHaveLength(2); expect(available.every(button => button.getAttribute('aria-checked') === 'false')).toBe(true);
    await click(available[0]); expect(selected).toEqual(['office.clients.view']);
    await click(controls().filter(button => !button.disabled)[1]);
    expect(selected).toEqual(['office.clients.edit', 'office.clients.view']);
  });
});

describe('area/action lookup', () => {
  it('does not substitute a first or nested permission for an unsupported action', () => {
    const entries = catalog.filter(entry => ['office.clients.edit', 'office.clients.manage_contacts'].includes(entry.key));
    entries.push({ ...catalog.find(entry => entry.key === 'office.clients.view')!, key: 'office.clients.contacts.view' as PermissionKey });
    const keys = entries.map(entry => entry.key);
    for (const action of ['read', 'create', 'delete', 'approve', 'export'] as const)
      expect(findPermissionKeyForAreaAction('office.clients', action, entries, keys)).toBeNull();
    expect(findPermissionKeyForAreaAction('office.clients', 'edit', entries, keys)).toBe('office.clients.edit');
    expect(findPermissionKeyForAreaAction('office.unknown', 'read', entries, keys)).toBeNull();
    expect(findPermissionKeyForAreaAction('office.clients', 'edit', entries, [])).toBeNull();
  });
  it('retains direct registered view, create, edit and sign mappings', () => {
    const keys = catalog.map(entry => entry.key);
    expect(findPermissionKeyForAreaAction('office.clients', 'read', catalog, keys)).toBe('office.clients.view');
    expect(findPermissionKeyForAreaAction('office.clients', 'create', catalog, keys)).toBe('office.clients.create');
    expect(findPermissionKeyForAreaAction('office.clients', 'edit', catalog, keys)).toBe('office.clients.edit');
    expect(findPermissionKeyForAreaAction('pflege.documentation', 'approve', catalog, keys)).toBe('pflege.documentation.sign');
  });
});
