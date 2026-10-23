// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompanyOrganizationWorkspace, type CompanyOrganizationWorkspaceProps } from '@/components/company/CompanyOrganizationWorkspace.web';
import type { CompanyLegalEntity, CompanyOrganizationPermissions, CompanyOrganizationResult, CompanyOrganizationSnapshot, CompanySite } from '@/types/tenant/companyOrganization';

const h = vi.hoisted(() => ({ load: vi.fn(), saveSite: vi.fn(), saveDepartment: vi.fn(), saveEntity: vi.fn(), savePlacement: vi.fn(), saveRelationship: vi.fn(), archive: vi.fn(), confirm: vi.fn(), changeView: vi.fn(), permissions: { view: true, manage: true, viewEmployees: true, managePlacements: true } }));
vi.mock('@/lib/tenant/companyOrganizationService', () => ({
  getCompanyOrganizationPermissions: () => h.permissions, loadCompanyOrganization: (...args: unknown[]) => h.load(...args),
  saveCompanySite: (...args: unknown[]) => h.saveSite(...args), saveCompanyDepartment: (...args: unknown[]) => h.saveDepartment(...args),
  saveCompanyLegalEntity: (...args: unknown[]) => h.saveEntity(...args), saveCompanyEmployeePlacement: (...args: unknown[]) => h.savePlacement(...args),
  saveCompanyRelationship: (...args: unknown[]) => h.saveRelationship(...args), archiveCompanyOrganization: (...args: unknown[]) => h.archive(...args),
}));
vi.mock('expo-router', () => ({ useNavigation: () => ({ dispatch: vi.fn() }) }));
vi.mock('expo-router/react-navigation', () => ({ usePreventRemove: vi.fn() }));
vi.mock('@/lib/platform/confirmAction', () => ({ confirmAction: (...args: unknown[]) => h.confirm(...args) }));
vi.mock('@/components/layout/platform/platformmodal', () => ({ PlatformModal: ({ visible, title, children, footerContent, onClose }: { visible: boolean; title: string; children: ReactNode; footerContent?: ReactNode; onClose: () => void }) => visible ? <section role="dialog" aria-label={title}><h2>{title}</h2><button type="button" aria-label="Dialog schließen" onClick={onClose}>Dialog schließen</button>{children}{footerContent}</section> : null }));
const BASE = { tenantId: 'tenant-one', version: 3, status: 'active' as const, createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-02T10:00:00Z', contactName: null, email: null, phone: null, notes: null, street: null, postalCode: null, city: null, country: 'DE', code: null, leaderEmployeeId: null };
const entity = (id: string, name: string): CompanyLegalEntity => ({ ...BASE, id, name, legalForm: 'GmbH', registrationNumber: null, taxNumber: null, vatId: null, parentEntityId: null, website: null });
const site = (id: string, name: string, entityId: string | null = null): CompanySite => ({ ...BASE, id, name, entityId, kind: 'branch', costCenterId: null, openingHours: null });
function fixture(): CompanyOrganizationSnapshot {
  return { entities: [entity('entity-one', 'Tochtergesellschaft')], sites: [site('site-main', 'Herne'), site('site-child', 'Dortmund', 'entity-one')], departments: [{ ...BASE, id: 'department-one', name: 'Verwaltung', entityId: null, siteId: 'site-main', parentDepartmentId: null, costCenterId: null }], placements: [], relationships: [], employees: [{ id: 'employee-one', firstName: 'Erika', lastName: 'Privat', status: 'active' }], employeesVisible: true, costCenters: [], audit: [], permissions: { ...h.permissions }, scopeLimited: false, canManageEntities: true };
}
let root: Root; let host: HTMLDivElement; let snapshot: CompanyOrganizationSnapshot; let props: CompanyOrganizationWorkspaceProps;
const render = async () => { await act(async () => root.render(<CompanyOrganizationWorkspace {...props} />)); };
const dialog = () => host.querySelector<HTMLElement>('[role="dialog"]');
const button = (text: string, parent: ParentNode = host) => Array.from(parent.querySelectorAll<HTMLButtonElement>('button')).find(node => node.textContent?.trim() === text);
const click = async (node: HTMLElement | null | undefined) => { expect(node).toBeTruthy(); await act(async () => node!.click()); };
const field = (name: string, parent: ParentNode = dialog()!) => {
  const label = Array.from(parent.querySelectorAll<HTMLLabelElement>('label')).find(node => node.querySelector('span')?.textContent?.startsWith(name));
  const control = label?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea'); expect(control, name).toBeTruthy(); return control!;
};
const change = async (control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) => {
  await act(async () => { const prototype = control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : control instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(control, value); control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); });
};
const submit = async (form = dialog()!.querySelector('form')!) => { await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }); };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks();
  h.permissions = { view: true, manage: true, viewEmployees: true, managePlacements: true };
  snapshot = fixture(); props = { tenantId: 'tenant-one', roleKey: 'business_admin', actorProfileId: 'profile-one', onViewChange: h.changeView };
  h.load.mockImplementation(async () => ({ ok: true, data: snapshot })); h.saveSite.mockResolvedValue({ ok: true, data: site('new', 'Bochum') }); h.savePlacement.mockResolvedValue({ ok: true, data: {} }); h.saveRelationship.mockResolvedValue({ ok: true, data: {} }); h.archive.mockResolvedValue({ ok: true, data: {} }); h.confirm.mockResolvedValue(true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('company organization interactions', () => {
  it('saves a real site with entity and employee IDs and carries the record version on edits', async () => {
    await render(); await click(button('Herne')); await click(button('Bearbeiten', dialog()!));
    await change(field('Bezeichnung'), 'Herne Zentrale'); await change(field('Leitung'), 'employee-one'); await submit();
    expect(h.saveSite).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-one' }), expect.objectContaining({ id: 'site-main', expectedVersion: 3, name: 'Herne Zentrale', leaderEmployeeId: 'employee-one', entityId: null }));
    expect(dialog()).toBeNull(); expect(host.textContent).toContain('Standort wurde gespeichert.');
  });
  it('preserves the editor when discard is declined and switches only after acceptance', async () => {
    await render(); await click(button('Standort anlegen')); await change(field('Bezeichnung'), 'Entwurf');
    h.confirm.mockResolvedValueOnce(false); await click(button('Abteilungen2') ?? Array.from(host.querySelectorAll('nav button')).find(node => node.textContent?.startsWith('Abteilungen')) as HTMLElement);
    expect(dialog()).not.toBeNull(); expect(field('Bezeichnung').value).toBe('Entwurf'); expect(h.changeView).not.toHaveBeenCalled();
    h.confirm.mockResolvedValueOnce(true); await click(Array.from(host.querySelectorAll('nav button')).find(node => node.textContent?.startsWith('Abteilungen')) as HTMLElement);
    expect(dialog()).toBeNull(); expect(h.changeView).toHaveBeenCalledWith('departments');
  });
  it('uses saved personnel and resets dependent location choices when changing entity', async () => {
    props.initialView = 'placements'; await render(); await click(button('Person zuordnen')); await change(field('Mitarbeitende Person'), 'employee-one'); await change(field('Standort'), 'site-main'); await change(field('Abteilung'), 'department-one');
    await change(field('Gesellschaft'), 'entity-one'); expect(field('Standort').value).toBe(''); expect(field('Abteilung').value).toBe('');
    expect(field('Standort').textContent).toContain('Dortmund'); expect(field('Standort').textContent).not.toContain('Herne');
    await change(field('Standort'), 'site-child'); await submit();
    expect(h.savePlacement).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ employeeId: 'employee-one', entityId: 'entity-one', siteId: 'site-child', departmentId: null }));
  });
  it('binds a relationship to a stored partner rather than a free-text duplicate', async () => {
    props.initialView = 'relationships'; await render(); await click(button('Beziehung anlegen')); await change(field('Vertragspartner'), 'entity-one'); await change(field('Gebiet / Region'), 'Ruhrgebiet'); await submit();
    expect(h.saveRelationship).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ partnerEntityId: 'entity-one', partnerName: 'Tochtergesellschaft', entityId: null, territory: 'Ruhrgebiet' }));
  });
  it('hides protected employee data and personnel editing without the separate right', async () => {
    h.permissions = { ...h.permissions, viewEmployees: false, managePlacements: false }; snapshot.permissions = { ...h.permissions }; snapshot.sites[0].leaderEmployeeId = 'employee-one';
    await render(); expect(host.textContent).not.toContain('Erika Privat'); expect(host.textContent).toContain('Personaldaten geschützt');
    expect(Array.from(host.querySelectorAll('nav button')).some(node => node.textContent?.includes('Personalzuordnung'))).toBe(false);
    await click(button('Herne')); await click(button('Bearbeiten', dialog()!)); expect(field('Leitung').disabled).toBe(true);
    await change(field('Bezeichnung'), 'Herne neu'); await submit(); expect(h.saveSite).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ leaderEmployeeId: 'employee-one' }));
  });
  it('lets scoped staff edit visible sites while protecting global entities', async () => {
    props.scopeLimited = true; snapshot.scopeLimited = true; snapshot.canManageEntities = false;
    await render(); expect(button('Bearbeiten')).toBeTruthy();
    await click(button('Herne')); expect(button('Bearbeiten', dialog()!)).toBeTruthy();
    await click(Array.from(dialog()!.querySelectorAll('button')).find(node => node.textContent?.startsWith('Verwaltung'))); expect(dialog()?.getAttribute('aria-label')).toBe('Verwaltung');
    await click(button('Schließen', dialog()!)); await click(Array.from(host.querySelectorAll('nav button')).find(node => node.textContent?.startsWith('Gesellschaften')) as HTMLElement); expect(button('Gesellschaft anlegen')).toBeUndefined(); expect(button('Bearbeiten')).toBeUndefined();
  });
  it('creates placements within a department grant without requiring protected ancestor records', async () => {
    props.scopeLimited = true; props.initialView = 'departments'; snapshot.scopeLimited = true; snapshot.canManageEntities = false; snapshot.entities = []; snapshot.sites = [];
    snapshot.departments[0] = { ...snapshot.departments[0], entityId: 'protected-entity', siteId: 'protected-site' };
    await render(); expect(button('Abteilung anlegen')).toBeUndefined();
    await click(Array.from(host.querySelectorAll('nav button')).find(node => node.textContent?.startsWith('Personalzuordnung')) as HTMLElement);
    await click(button('Person zuordnen')); expect(field('Abteilung').value).toBe('department-one'); expect(field('Gesellschaft').value).toBe('protected-entity'); expect(field('Standort').value).toBe('protected-site');
    await change(field('Mitarbeitende Person'), 'employee-one'); await submit();
    expect(h.savePlacement).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ departmentId: 'department-one', entityId: 'protected-entity', siteId: 'protected-site' }));
  });

  it('blocks duplicate saves and uncertain retries until a successful reload', async () => {
    const pending = deferred<CompanyOrganizationResult<CompanySite>>(); h.saveSite.mockReturnValueOnce(pending.promise);
    await render(); await click(button('Standort anlegen')); await change(field('Bezeichnung'), 'Bochum'); const form = dialog()!.querySelector('form')!;
    await submit(form); await submit(form); expect(h.saveSite).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve({ ok: false, error: 'Eintrag zwischenzeitlich geändert.', conflict: true, reloadRequired: true }));
    expect(dialog()?.textContent).toContain('Eintrag zwischenzeitlich geändert.'); await submit(form); expect(h.saveSite).toHaveBeenCalledTimes(1);
    await click(button('Neu laden und Entwurf schließen', dialog()!)); expect(dialog()).toBeNull(); expect(host.textContent).toContain('Die aktuellen Daten wurden geladen.');
  });
  it('discards late data from a previous tenant scope', async () => {
    const old = deferred<CompanyOrganizationResult<CompanyOrganizationSnapshot>>(); h.load.mockReturnValueOnce(old.promise); await render();
    props = { ...props, tenantId: 'tenant-two' }; snapshot = { ...fixture(), sites: [site('new-tenant-site', 'Neuer Mandant')] }; await render();
    await act(async () => old.resolve({ ok: true, data: fixture() })); expect(host.textContent).toContain('Neuer Mandant'); expect(host.textContent).not.toContain('Herne');
  });
  it('uses the separate access draft guard before changing organisation views', async () => {
    const accessGuard = vi.fn().mockResolvedValue(false); props = { ...props, initialView: 'access', canManageScopes: true, accessContent: <div>Zugriffsverwaltung</div>, accessNavigationGuard: accessGuard };
    await render(); expect(host.textContent).toContain('Zugriffsverwaltung'); await click(Array.from(host.querySelectorAll('nav button')).find(node => node.textContent?.startsWith('Standorte')) as HTMLElement);
    expect(accessGuard).toHaveBeenCalledTimes(1); expect(host.textContent).toContain('Zugriffsverwaltung'); expect(h.changeView).not.toHaveBeenCalled();
  });
  it('does not read data at all when organization access is denied', async () => {
    h.permissions = { view: false, manage: false, viewEmployees: false, managePlacements: false } as CompanyOrganizationPermissions; await render();
    expect(h.load).not.toHaveBeenCalled(); expect(host.textContent).toContain('Kein Zugriff auf die Unternehmensstruktur');
  });
});
