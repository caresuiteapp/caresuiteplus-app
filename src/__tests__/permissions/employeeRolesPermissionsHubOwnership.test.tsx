// @vitest-environment happy-dom
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPermissionCatalogEntries } from '@/lib/permissions/permissionCatalogSeedData';
import { ROLE_LABELS } from '@/data/constants/roleLabels';
import type { PermissionKey, RoleKey } from '@/types';

const h = vi.hoisted(() => ({ overrides: vi.fn(), scopes: vi.fn(), effective: vi.fn(), catalog: vi.fn(), save: vi.fn(),
  handlers: new Map<string, (...args: any[]) => any>() }));
// Exercise the real hub and permission editor, replacing platform hosts and
// asynchronous service boundaries. This does not perform browser layout QA.
vi.mock('react-native', () => ({
  View: ({ children }: any) => <div>{children}</div>, Text: ({ children }: any) => <span>{children}</span>,
  Pressable: ({ children, onPress, disabled, accessibilityRole, accessibilityLabel, accessibilityState }: any) =>
    <button type="button" role={accessibilityRole} aria-label={accessibilityLabel} aria-checked={accessibilityState?.checked}
      disabled={disabled} onClick={onPress}>{children}</button>,
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
}));
vi.mock('@/hooks/usePageTab', () => ({ usePageTab: () => useState('pflege') }));
vi.mock('@/components/detail', () => ({ DetailInfoRow: ({ label, value }: any) => <p>{label}: {value}</p> }));
vi.mock('@/components/ui', () => ({
  PremiumBadge: ({ label }: any) => <span>{label}</span>, PremiumInput: () => null,
  SectionPanel: ({ title, children }: any) => <section><h2>{title}</h2>{children}</section>,
  InfoBanner: ({ title, message }: any) => <div role="status">{title} {message}</div>,
  PremiumButton: ({ title, onPress, disabled, loading }: any) => {
    h.handlers.set(title, onPress);
    return <button type="button" disabled={disabled || loading} onClick={onPress}>{title}</button>;
  },
  SegmentedTabs: ({ tabs, onSelect }: any) => <nav>{tabs.map((tab: any) =>
    <button key={tab.key} type="button" onClick={() => onSelect(tab.key)}>{tab.label}</button>)}</nav>,
  FilterChip: ({ label, onPress }: any) => <button type="button" data-chip={label} onClick={onPress}>{label}</button>,
  FilterChipGroup: ({ options, onChange }: any) => <div>{options.map((option: any) =>
    <button key={option.key} type="button" data-option={option.key} onClick={() => onChange(option.key)}>{option.label}</button>)}</div>,
}));
vi.mock('@/components/office/rbac/RbacSpecialPermissionsPanel', () => ({ RbacSpecialPermissionsPanel: () => null }));
vi.mock('@/components/office/rbac/RbacTenantRolesPanel', () => ({ RbacTenantRolesPanel: () => null }));
vi.mock('@/lib/permissions/permissionCatalogService', () => ({ fetchPermissionCatalog: h.catalog }));
vi.mock('@/lib/permissions/rbacService', () => ({
  fetchEmployeePermissionOverrides: h.overrides, fetchEmployeeDataScopes: h.scopes, resolveEffectivePermissions: h.effective,
  resolveRoleBasePermissionsSync: () => ['pflege.plans.view'], listPermissionAuditLogForEmployee: () => [],
}));
vi.mock('@/lib/modules/moduleAccessService', () => ({ getTenantModules: () => [{ productKey: 'pflege', isActive: true }] }));
vi.mock('@/lib/office/employeeHomeOfficeService', () => ({
  describeEmployeeTimeTrackingMode: () => 'Außendienst', EMPLOYEE_ASSIGNABLE_ROLE_KEYS: ['business_admin', 'nurse'],
  EMPLOYEE_TIME_TRACKING_MODE_OPTIONS: [{ key: 'field', label: 'Außendienst' }], getEmployeeHomeOfficeOverride: () => null,
  getEmployeeTimeTrackingModeOverride: () => null, resolveEmployeeTimeTrackingModeWithOverride: (_role: unknown, _home: unknown, mode: unknown) => mode ?? 'field',
  roleQualifiesForHomeOfficeSetting: () => false,
}));
vi.mock('@/design/tokens/carelightadaptive', () => ({ useAdaptiveContentStyles: () => ({
  body: {}, bodyStrong: {}, caption: {}, heading: {}, primary: { color: '#fff' }, secondary: { color: '#aaa' }, muted: { color: '#777' },
}) }));
vi.mock('@/theme', () => ({ spacing: { xs: 4, sm: 8, md: 12 } }));
import { EmployeeRolesPermissionsHub } from '@/components/office/EmployeeRolesPermissionsHub';

type Props = Parameters<typeof EmployeeRolesPermissionsHub>[0];
let props: Props, root: Root, host: HTMLDivElement;
const catalog = buildPermissionCatalogEntries();
const result = (tenantId: string, employeeId: string, role: RoleKey, permissions: PermissionKey[] = ['pflege.plans.view']) => ({ ok: true as const, data: {
  tenantId, employeeId, primaryRoleKey: role, roleKeys: [role], roleTemplateIds: [], permissions, overrides: [], scopes: [], sources: {},
} });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const render = async () => { await act(async () => root.render(<EmployeeRolesPermissionsHub {...props} />)); };
const button = (label: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === label);
const checkbox = (key: PermissionKey) => [...host.querySelectorAll<HTMLButtonElement>('[role="checkbox"]')]
  .find(item => item.getAttribute('aria-label') === catalog.find(entry => entry.key === key)!.label);
const click = async (item: HTMLButtonElement) => { await act(async () => item.click()); };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); h.handlers.clear();
  h.catalog.mockResolvedValue({ ok: true, data: catalog }); h.overrides.mockResolvedValue({ ok: true, data: [] });
  h.scopes.mockResolvedValue({ ok: true, data: [] }); h.effective.mockImplementation((tenant, employee, role) => Promise.resolve(result(tenant, employee, role)));
  h.save.mockResolvedValue(undefined);
  props = { tenantId: 'tenant-a', employeeId: 'employee-a', employeeName: 'Person A', actorProfileId: 'actor-a',
    employmentStatus: 'active', roleKey: 'business_admin', portalActive: false, lastLoginAt: null, canEdit: true, saving: false, onSave: h.save };
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('confirmed person-owned permission hub', () => {
  it('waits for all reads and then saves the actual returned permissions plus the explicit checkbox change', async () => {
    const pending = deferred<ReturnType<typeof result>>(); h.effective.mockReturnValue(pending.promise);
    await render(); expect(button('Rollen & Rechte speichern')).toBeUndefined(); expect(checkbox('pflege.plans.view')).toBeUndefined();
    expect(host.textContent).toContain('werden geladen');
    await act(async () => pending.resolve(result('tenant-a', 'employee-a', 'business_admin', ['pflege.wounds.view'])));
    expect(checkbox('pflege.wounds.view')!.getAttribute('aria-checked')).toBe('true');
    expect(checkbox('pflege.plans.view')!.getAttribute('aria-checked')).toBe('false');
    await click(checkbox('pflege.access')!); await click(button('Rollen & Rechte speichern')!);
    expect(h.save).toHaveBeenCalledWith(expect.objectContaining({ desiredPermissions: ['pflege.access', 'pflege.wounds.view'] }));
  });

  it('does not admit a late person-A response into the new person-B frame', async () => {
    const pendingA = deferred<ReturnType<typeof result>>();
    h.effective.mockImplementation((tenant, employee, role) => employee === 'employee-a' ? pendingA.promise : Promise.resolve(result(tenant, employee, role, ['pflege.medications.view'])));
    await render(); props = { ...props, employeeId: 'employee-b', employeeName: 'Person B' }; await render();
    expect(host.textContent).toContain('Person B'); expect(host.textContent).not.toContain('Person A');
    expect(checkbox('pflege.medications.view')!.getAttribute('aria-checked')).toBe('true');
    await act(async () => pendingA.resolve(result('tenant-a', 'employee-a', 'business_admin', ['pflege.wounds.manage'])));
    expect(checkbox('pflege.wounds.manage')!.getAttribute('aria-checked')).toBe('false');
    await click(button('Rollen & Rechte speichern')!);
    expect(h.save).toHaveBeenCalledWith(expect.objectContaining({ desiredPermissions: ['pflege.medications.view'] }));
  });

  it.each(['employee', 'tenant', 'actor', 'role'] as const)('clears the role body and denies a held save immediately after a %s change', async kind => {
    await render(); const oldSave = h.handlers.get('Rollen & Rechte speichern')!;
    const pending = deferred<ReturnType<typeof result>>(); h.effective.mockReturnValue(pending.promise);
    const original = props;
    props = { ...props, ...(kind === 'employee' ? { employeeId: 'employee-b' } : kind === 'tenant' ? { tenantId: 'tenant-b' } :
      kind === 'actor' ? { actorProfileId: 'actor-b' } : { roleKey: 'nurse' as const }) };
    await render(); expect(button('Rollen & Rechte speichern')).toBeUndefined(); expect(checkbox('pflege.plans.view')).toBeUndefined();
    await act(async () => oldSave()); expect(h.save).not.toHaveBeenCalled();
    props = original; await render(); await act(async () => oldSave()); expect(h.save).not.toHaveBeenCalled();
  });

  it.each(['overrides', 'scopes', 'effective'] as const)('keeps the editor and save closed when the %s read fails', async kind => {
    h[kind].mockResolvedValue({ ok: false, error: 'Serverzugriff fehlgeschlagen' });
    await render(); expect(host.textContent).toContain('Serverzugriff fehlgeschlagen');
    expect(button('Rollen & Rechte speichern')).toBeUndefined(); expect(checkbox('pflege.access')).toBeUndefined(); expect(h.save).not.toHaveBeenCalled();
  });

  it('retries a failed load and opens the editor only after all new reads succeed', async () => {
    h.scopes.mockResolvedValueOnce({ ok: false, error: 'Netzwerkfehler' }); await render();
    expect(button('Erneut laden')).toBeDefined(); expect(button('Rollen & Rechte speichern')).toBeUndefined();
    const pending = deferred<ReturnType<typeof result>>(); h.effective.mockReturnValue(pending.promise);
    await click(button('Erneut laden')!); expect(button('Erneut laden')).toBeUndefined(); expect(checkbox('pflege.access')).toBeUndefined();
    await act(async () => pending.resolve(result('tenant-a', 'employee-a', 'business_admin', ['pflege.access'])));
    expect(checkbox('pflege.access')!.getAttribute('aria-checked')).toBe('true'); expect(button('Rollen & Rechte speichern')).toBeDefined();
    expect(h.scopes).toHaveBeenCalledTimes(2);
  });

  it('hides the old selection while an explicitly changed role set is being read again', async () => {
    await render(); const oldSave = h.handlers.get('Rollen & Rechte speichern')!;
    await click(button('Systemrolle')!);
    const pending = deferred<ReturnType<typeof result>>(); h.effective.mockReturnValue(pending.promise);
    await click([...host.querySelectorAll<HTMLButtonElement>('[data-chip]')].find(item => item.dataset.chip === ROLE_LABELS.nurse)!);
    expect(button('Rollen & Rechte speichern')).toBeUndefined(); expect(host.textContent).toContain('werden geladen');
    await act(async () => oldSave()); expect(h.save).not.toHaveBeenCalled();
    await act(async () => pending.resolve(result('tenant-a', 'employee-a', 'business_admin', ['pflege.medications.view'])));
    await click(button('Pflege')!); expect(checkbox('pflege.medications.view')!.getAttribute('aria-checked')).toBe('true');
    expect(checkbox('pflege.plans.view')!.getAttribute('aria-checked')).toBe('false');
    await click(button('Rollen & Rechte speichern')!);
    expect(h.save).toHaveBeenCalledWith(expect.objectContaining({ additionalRoleKeys: ['business_admin', 'nurse'], desiredPermissions: ['pflege.medications.view'] }));
  });

  it('denies held saves after edit loss, saving state or unmount and does not revive them after regrant', async () => {
    await render(); const oldSave = h.handlers.get('Rollen & Rechte speichern')!;
    props = { ...props, canEdit: false }; await render(); await act(async () => oldSave()); expect(h.save).not.toHaveBeenCalled();
    props = { ...props, canEdit: true }; await render(); await act(async () => oldSave()); expect(h.save).not.toHaveBeenCalled();
    const fresh = h.handlers.get('Rollen & Rechte speichern')!;
    props = { ...props, saving: true }; await render(); await act(async () => fresh()); expect(h.save).not.toHaveBeenCalled();
    props = { ...props, saving: false }; await render(); const current = h.handlers.get('Rollen & Rechte speichern')!;
    await act(async () => root.unmount()); await act(async () => current()); expect(h.save).not.toHaveBeenCalled();
  });

  it('rejects a successful response belonging to another person', async () => {
    h.effective.mockResolvedValue(result('tenant-a', 'foreign-person', 'business_admin'));
    await render(); expect(host.textContent).toContain('gehören nicht zu dieser Personalakte');
    expect(button('Rollen & Rechte speichern')).toBeUndefined(); expect(checkbox('pflege.access')).toBeUndefined();
  });
});
