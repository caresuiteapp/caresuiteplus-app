// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompanyScopeAccessPanel } from '@/components/company/CompanyScopeAccessPanel.web';
import type { CompanyAccessProfile } from '@/types/tenant/companyAccess';

const h = vi.hoisted(() => ({ load: vi.fn(), structure: vi.fn(), save: vi.fn(), confirm: vi.fn() }));
vi.mock('@/lib/tenant/companyAccessService', () => ({ loadCompanyScopeGrants: (...args: unknown[]) => h.load(...args), saveCompanyScopeGrant: (...args: unknown[]) => h.save(...args) }));
vi.mock('@/lib/tenant/companyOrganizationService', () => ({ loadCompanyOrganization: (...args: unknown[]) => h.structure(...args) }));
vi.mock('expo-router', () => ({ useNavigation: () => ({ dispatch: vi.fn() }) }));
vi.mock('expo-router/react-navigation', () => ({ usePreventRemove: vi.fn() }));
vi.mock('@/lib/platform/confirmAction', () => ({ confirmAction: (...args: unknown[]) => h.confirm(...args) }));

let root: Root; let host: HTMLDivElement; let profiles: CompanyAccessProfile[];
let guard: (() => Promise<boolean>) | null;
const onGuard = (value: typeof guard) => { guard = value; };
const render = async () => { await act(async () => root.render(<CompanyScopeAccessPanel tenantId="tenant-one" roleKey="business_admin" actorProfileId="self" effectivePermissions={['business.tenant.manage', 'office.employees.view']} onNavigationGuardChange={onGuard} />)); };
const button = (text: string) => Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(node => node.textContent?.trim() === text);
const person = (name: string) => Array.from(host.querySelectorAll<HTMLButtonElement>('nav button')).find(node => node.querySelector('strong')?.textContent === name);
const checkbox = (label: string) => Array.from(host.querySelectorAll<HTMLLabelElement>('label')).find(node => node.textContent?.trim() === label)?.querySelector<HTMLInputElement>('input');
const click = async (node: HTMLElement | null | undefined) => { expect(node).toBeTruthy(); await act(async () => node!.click()); };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true; vi.resetAllMocks(); guard = null;
  profiles = [
    { id: 'profile-erika', displayName: 'Erika Leitung', roleKey: 'business_admin', scopeLimited: false, version: 4, hasLegacyLimits: false, isCurrentProfile: false, grants: [] },
    { id: 'profile-max', displayName: 'Max Verwaltung', roleKey: 'office_manager', scopeLimited: true, version: 2, hasLegacyLimits: true, isCurrentProfile: false, grants: [{ kind: 'site', targetId: 'site-one' }] },
    { id: 'self', displayName: 'Eigener Zugang', roleKey: 'business_admin', scopeLimited: false, version: 1, hasLegacyLimits: false, isCurrentProfile: true, grants: [] },
  ];
  h.load.mockImplementation(async () => ({ ok: true, data: { profiles } }));
  h.structure.mockResolvedValue({ ok: true, data: { entities: [{ id: 'entity-one', name: 'Tochtergesellschaft', status: 'active' }], sites: [{ id: 'site-one', name: 'Herne', status: 'active' }, { id: 'site-archived', name: 'Altes Büro', status: 'archived' }], departments: [{ id: 'department-one', name: 'Verwaltung', status: 'active' }] } });
  h.save.mockResolvedValue({ ok: true, data: { profileId: 'profile-erika', scopeLimited: true, version: 5 } }); h.confirm.mockResolvedValue(true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('company scope access editor', () => {
  it('saves actual profile and structural IDs with the expected revision', async () => {
    await render(); await click(person('Erika Leitung')); await click(checkbox('Auf ausgewählte Unternehmensbereiche begrenzen')); await click(checkbox('Herne')); await click(checkbox('Verwaltung'));
    expect(checkbox('Altes Büro (archiviert)')).toBeUndefined(); await click(button('Zugriffe speichern'));
    expect(h.save).toHaveBeenCalledWith('tenant-one', { profileId: 'profile-erika', limited: true, grants: [{ kind: 'site', targetId: 'site-one' }, { kind: 'department', targetId: 'department-one' }], expectedVersion: 4 });
    expect(host.textContent).toContain('Zugriffsbereiche gespeichert.'); expect(host.textContent).toContain('Zugang auswählen');
  });
  it('protects unsaved selections when switching person or leaving the workspace', async () => {
    await render(); await click(person('Erika Leitung')); await click(checkbox('Auf ausgewählte Unternehmensbereiche begrenzen')); await click(checkbox('Herne'));
    h.confirm.mockResolvedValueOnce(false); await click(person('Max Verwaltung')); expect(host.querySelector('h3')?.textContent).toBe('Erika Leitung'); expect(checkbox('Herne')?.checked).toBe(true);
    h.confirm.mockResolvedValueOnce(false); let accepted = true; await act(async () => { accepted = await guard!(); }); expect(accepted).toBe(false);
    h.confirm.mockResolvedValueOnce(true); await click(person('Max Verwaltung')); expect(host.querySelector('h3')?.textContent).toBe('Max Verwaltung'); expect(host.textContent).toContain('zusätzlich ältere Einschränkungen');
  });
  it('makes a zero-area restriction explicit before persisting it', async () => {
    await render(); await click(person('Erika Leitung')); await click(checkbox('Auf ausgewählte Unternehmensbereiche begrenzen'));
    expect(host.textContent).toContain('Ohne ausgewählten Bereich'); await click(button('Zugriffe speichern'));
    expect(h.confirm).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('keinen Zugriff') }));
    expect(h.save).toHaveBeenCalledWith('tenant-one', expect.objectContaining({ limited: true, grants: [] }));
  });
  it('does not permit self-escalation or self-lockout', async () => {
    await render(); await click(person('Eigener Zugang')); expect(checkbox('Auf ausgewählte Unternehmensbereiche begrenzen')?.disabled).toBe(true); expect(button('Zugriffe speichern')?.disabled).toBe(true);
    await click(button('Zugriffe speichern')); expect(h.save).not.toHaveBeenCalled();
  });
  it('allows cancelling the save confirmation while retaining the chosen scopes', async () => {
    await render(); await click(person('Erika Leitung')); await click(checkbox('Auf ausgewählte Unternehmensbereiche begrenzen')); await click(checkbox('Tochtergesellschaft'));
    h.confirm.mockResolvedValueOnce(false); await click(button('Zugriffe speichern')); expect(h.save).not.toHaveBeenCalled(); expect(checkbox('Tochtergesellschaft')?.checked).toBe(true); expect(button('Zugriffe speichern')?.disabled).toBe(false);
  });
  it('locks repeated saves while pending and requires reload after an unconfirmed write', async () => {
    const pending = deferred<{ ok: false; error: string }>(); h.save.mockReturnValueOnce(pending.promise);
    await render(); await click(person('Erika Leitung')); await click(checkbox('Auf ausgewählte Unternehmensbereiche begrenzen')); await click(checkbox('Herne')); await click(button('Zugriffe speichern'));
    expect(h.save).toHaveBeenCalledTimes(1); expect(button('Wird gespeichert …')?.disabled).toBe(true);
    await act(async () => pending.resolve({ ok: false, error: 'Versionskonflikt.' })); expect(host.querySelector('[role="alert"]')?.textContent).toContain('Versionskonflikt.'); expect(button('Zugriffe speichern')?.disabled).toBe(true);
    await click(button('Neu laden')); expect(host.querySelector('[role="alert"]')).toBeNull(); expect(host.textContent).toContain('Zugang auswählen'); expect(h.save).toHaveBeenCalledTimes(1);
  });
  it('shows read failures and can retry without presenting fabricated profiles', async () => {
    h.load.mockResolvedValueOnce({ ok: false, error: 'Keine Freigabe für Zugriffe.' }); await render(); expect(host.querySelector('[role="alert"]')?.textContent).toContain('Keine Freigabe'); expect(person('Erika Leitung')).toBeUndefined();
    await click(button('Neu laden')); expect(person('Erika Leitung')).toBeTruthy();
  });
});
