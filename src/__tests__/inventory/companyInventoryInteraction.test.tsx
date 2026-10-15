// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompanyInventoryWorkspace, type CompanyInventoryWorkspaceProps } from '@/components/company/CompanyInventoryWorkspace.web';
import type { CompanyInventoryResult, CompanyInventorySnapshot } from '@/lib/inventory/companyInventoryService.web';
import type { InventoryAssignment, InventoryItem } from '@/types/inventory';
import type { PermissionKey } from '@/types';

const h = vi.hoisted(() => ({
  load: vi.fn(), saveItem: vi.fn(), saveCategory: vi.fn(), saveLocation: vi.fn(), issue: vi.fn(),
  returnItem: vi.fn(), reportDamage: vi.fn(), resolveDamage: vi.fn(), acknowledge: vi.fn(), requestReturn: vi.fn(),
  offboarding: vi.fn(), confirm: vi.fn(), dispatch: vi.fn(), preventRemove: vi.fn(), changeView: vi.fn(),
}));
vi.mock('@/lib/inventory/companyInventoryService.web', async original => ({
  ...await original<typeof import('@/lib/inventory/companyInventoryService.web')>(),
  loadCompanyInventory: (...args: unknown[]) => h.load(...args),
  saveCompanyInventoryItem: (...args: unknown[]) => h.saveItem(...args),
  saveCompanyInventoryCategory: (...args: unknown[]) => h.saveCategory(...args),
  saveCompanyInventoryLocation: (...args: unknown[]) => h.saveLocation(...args),
  issueCompanyInventoryItem: (...args: unknown[]) => h.issue(...args),
  returnCompanyInventoryItem: (...args: unknown[]) => h.returnItem(...args),
  reportCompanyInventoryDamage: (...args: unknown[]) => h.reportDamage(...args),
  resolveCompanyInventoryDamage: (...args: unknown[]) => h.resolveDamage(...args),
  acknowledgeCompanyInventoryAssignment: (...args: unknown[]) => h.acknowledge(...args),
  requestCompanyInventoryReturn: (...args: unknown[]) => h.requestReturn(...args),
  checkCompanyInventoryOffboarding: (...args: unknown[]) => h.offboarding(...args),
}));
vi.mock('expo-router', () => ({ useNavigation: () => ({ dispatch: h.dispatch }) }));
vi.mock('expo-router/react-navigation', () => ({ usePreventRemove: (...args: unknown[]) => h.preventRemove(...args) }));
vi.mock('@/lib/platform/confirmAction', () => ({ confirmAction: (...args: unknown[]) => h.confirm(...args) }));
vi.mock('@/components/layout/platform/platformmodal', () => ({
  PlatformModal: ({ visible, title, children, footerContent, onClose }: {
    visible?: boolean; title: string; children: ReactNode; footerContent?: ReactNode; onClose: () => void;
  }) => visible ? <section role="dialog" aria-label={title}><h2>{title}</h2><button type="button" aria-label="Dialog schließen" onClick={onClose}>Schließen</button>{children}{footerContent}</section> : null,
}));

const DATE = '2026-10-01T12:00:00.000Z';
const ALL: PermissionKey[] = ['inventory.view', 'inventory.manage_items', 'inventory.issue', 'inventory.return_manage', 'inventory.report_damage', 'inventory.offboarding', 'inventory.audit_view', 'office.employees.view'];
function item(id: string, name: string, status: InventoryItem['status'] = 'available'): InventoryItem {
  return { id, name, tenantId: 'tenant-one', categoryId: 'devices', categoryGroup: 'devices', status, condition: 'good', requiresReturnOnExit: true, portalVisibleToEmployee: true, createdAt: DATE, updatedAt: DATE };
}
function assignment(id: string, itemId: string, employeeId: string): InventoryAssignment {
  return { id, itemId, recipientEmployeeId: employeeId, responsibleEmployeeId: employeeId, tenantId: 'tenant-one', status: 'issued', issueCondition: 'good', returnRequired: true, issuedAt: DATE, createdAt: DATE, updatedAt: DATE };
}
function fixture(): CompanyInventorySnapshot {
  return {
    items: [item('phone', 'Diensttelefon Erika', 'assigned'), item('key', 'Dienstschlüssel Max', 'assigned'), item('spare', 'Reservegerät')],
    categories: [{ id: 'devices', tenantId: 'tenant-one', group: 'devices', label: 'Geräte', requiresReturnOnExit: true, portalVisibleToEmployee: true, barcodeEnabled: false, createdAt: DATE, updatedAt: DATE }],
    locations: [], assignments: [assignment('a-erika', 'phone', 'erika'), assignment('a-max', 'key', 'max')],
    returns: [], damageReports: [], audit: [], employeesVisible: true,
    employees: [{ id: 'erika', firstName: 'Erika', lastName: 'Vertraulich', status: 'active' }, { id: 'max', firstName: 'Max', lastName: 'Geschützt', status: 'active' }],
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(finish => { resolve = finish; });
  return { promise, resolve };
}
let host: HTMLDivElement;
let root: Root;
let snapshot: CompanyInventorySnapshot;
let props: CompanyInventoryWorkspaceProps;
const render = async () => { await act(async () => root.render(<CompanyInventoryWorkspace {...props} />)); };
const dialog = () => host.querySelector<HTMLElement>('[role="dialog"]');
const button = (text: string, parent: ParentNode = host) => Array.from(parent.querySelectorAll<HTMLButtonElement>('button')).find(node => node.textContent?.trim() === text);
const click = async (node: HTMLElement | null | undefined) => { expect(node).toBeTruthy(); await act(async () => node!.click()); };
const field = (label: string, parent: ParentNode = dialog()!) => {
  const wrapper = Array.from(parent.querySelectorAll<HTMLLabelElement>('label')).find(node => node.querySelector('span')?.textContent?.startsWith(label));
  const control = wrapper?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea');
  expect(control, label).toBeTruthy();
  return control!;
};
const change = async (control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) => {
  await act(async () => {
    const prototype = control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : control instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(control, value);
    control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
};
const submit = async (form = dialog()!.querySelector<HTMLFormElement>('form')!) => {
  await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
};
const newDraft = async () => {
  await click(button('Inventar anlegen'));
  await change(field('Bezeichnung'), 'Neues Gerät');
  await change(field('Kategorie'), 'devices');
  await change(field('Zustand'), 'good');
};

beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  vi.resetAllMocks(); snapshot = fixture();
  props = { tenantId: 'tenant-one', roleKey: 'business_admin', actorProfileId: 'profile-one', effectivePermissions: [...ALL], onViewChange: h.changeView };
  h.load.mockImplementation(async () => ({ ok: true, data: snapshot }));
  h.saveItem.mockResolvedValue({ ok: true, data: item('new', 'Neues Gerät') });
  h.returnItem.mockResolvedValue({ ok: true, data: {} });
  h.confirm.mockResolvedValue(true);
  h.offboarding.mockImplementation(async (_scope, employeeId) => ({ ok: true, data: {
    employeeId, canCompleteOffboarding: false, openAssignments: snapshot.assignments.filter(entry => entry.recipientEmployeeId === employeeId), returnTasksSuggested: [], portalLockPrepared: false, deviceAccessDeactivatePrepared: false,
  } }));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('company inventory real Web interactions', () => {
  it('protects recipient names and issue actions without the separate employee permission', async () => {
    props.effectivePermissions = ALL.filter(permission => permission !== 'office.employees.view');
    props.initialView = 'assignments'; await render();
    expect(host.textContent).not.toContain('Erika Vertraulich');
    expect(host.textContent).not.toContain('Max Geschützt');
    expect(host.textContent).toContain('Personaldaten geschützt');
    expect(button('Empfang bestätigen')).toBeUndefined();
    expect(button('Personalrückgaben')).toBeUndefined();
    await click(button('Bestand', host.querySelector('nav')!));
    await click(button('Reservegerät'));
    expect(button('Ausgeben', dialog()!)).toBeUndefined();
  });

  it('restores the employee context for personnel returns and the assignment filter', async () => {
    props.initialView = 'offboarding'; props.initialEmployeeId = 'erika'; await render();
    expect(field('Mitarbeitende Person', host).value).toBe('erika');
    expect(h.offboarding).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-one' }), 'erika');
    expect(host.textContent).toContain('1 offene Rückgaben für Erika Vertraulich');
    await click(button('Ausgaben & Rückgaben'));
    expect(field('Person', host).value).toBe('erika');
    const rows = host.querySelector('tbody')!.textContent;
    expect(rows).toContain('Erika Vertraulich'); expect(rows).not.toContain('Max Geschützt');
  });

  it('blocks uncertain saves until reload and closes the creation draft before allowing another write', async () => {
    h.saveItem.mockResolvedValueOnce({ ok: false, error: 'Speicherstand unklar.', reloadRequired: true });
    await render(); await newDraft(); const oldForm = dialog()!.querySelector<HTMLFormElement>('form')!;
    await submit();
    expect(h.saveItem).toHaveBeenCalledTimes(1);
    expect(dialog()?.textContent).toContain('Speicherstand unklar.');
    expect(button('Inventar anlegen', dialog()!)!.disabled).toBe(true);
    await submit(oldForm); expect(h.saveItem).toHaveBeenCalledTimes(1);
    snapshot = { ...snapshot, items: [...snapshot.items, item('saved-despite-error', 'Neues Gerät')] };
    await click(button('Bestand neu laden und Entwurf schließen', dialog()!));
    expect(dialog()).toBeNull();
    expect(host.textContent).toContain('Der vorherige Entwurf wurde geschlossen.');
    expect(button('Neues Gerät')).toBeTruthy();
    await submit(oldForm); expect(h.saveItem).toHaveBeenCalledTimes(1);
    expect(button('Inventar anlegen')!.disabled).toBe(false);
    await click(button('Inventar anlegen')); expect(field('Bezeichnung').value).toBe('');
  });

  it('does not permit another creation when saving succeeds but its confirming reload fails', async () => {
    await render(); await newDraft();
    h.load.mockResolvedValueOnce({ ok: false, error: 'Bestand nicht erreichbar.' });
    await submit();
    expect(h.saveItem).toHaveBeenCalledTimes(1); expect(dialog()).toBeNull();
    expect(host.textContent).toContain('Inventar wurde angelegt. Die aktualisierte Liste konnte noch nicht geladen werden.');
    expect(button('Inventar anlegen')!.disabled).toBe(true);
    await click(button('Inventar anlegen')); expect(dialog()).toBeNull();
    snapshot = { ...snapshot, items: [...snapshot.items, item('new', 'Neues Gerät')] };
    await click(button('Bestand neu laden'));
    expect(button('Inventar anlegen')!.disabled).toBe(false); expect(h.saveItem).toHaveBeenCalledTimes(1);
  });

  it.each(['tenant', 'permissions'] as const)('removes drafts on %s changes and ignores late mutation responses', async changeScope => {
    const pending = deferred<CompanyInventoryResult<InventoryItem>>();
    h.saveItem.mockReturnValueOnce(pending.promise);
    await render(); await newDraft(); await submit();
    expect(h.saveItem).toHaveBeenCalledTimes(1);
    expect(dialog()).not.toBeNull();
    if (changeScope === 'tenant') {
      props.tenantId = 'tenant-two'; snapshot = { ...fixture(), items: [item('second-tenant', 'Neuer Mandant Bestand')], assignments: [] };
    } else props.effectivePermissions = ['inventory.view'];
    await render(); expect(dialog()).toBeNull();
    const callsAfterSwitch = h.load.mock.calls.length;
    await act(async () => pending.resolve({ ok: true, data: item('late', 'Veralteter Speicherstand') }));
    expect(h.load).toHaveBeenCalledTimes(callsAfterSwitch);
    expect(host.textContent).not.toContain('Inventar wurde angelegt.');
    expect(host.textContent).not.toContain('Veralteter Speicherstand');
    if (changeScope === 'tenant') expect(host.textContent).toContain('Neuer Mandant Bestand');
    else expect(button('Inventar anlegen')).toBeUndefined();
  });

  it('keeps dirty editors open when navigation is declined and discards them only after confirmation', async () => {
    let guard: (() => Promise<boolean>) | null = null;
    props.onNavigationGuardChange = next => { guard = next; };
    await render(); await newDraft(); h.confirm.mockResolvedValue(false);
    await click(button('Lagerorte & Kategorien'));
    expect(field('Bezeichnung').value).toBe('Neues Gerät'); expect(h.changeView).not.toHaveBeenCalled();
    expect(h.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Ungespeicherte Eingaben' }));
    let allowed = true; await act(async () => { allowed = await guard!(); }); expect(allowed).toBe(false);
    h.confirm.mockResolvedValue(true); await click(button('Lagerorte & Kategorien'));
    expect(dialog()).toBeNull(); expect(h.changeView).toHaveBeenCalledWith('locations');
  });

  it('requires actual return decisions and a reason for missing returns instead of preconfirming them', async () => {
    props.initialView = 'assignments'; await render(); await click(button('Rücknahme'));
    expect(field('Gegenstand zurückgegeben?').value).toBe(''); await submit(); expect(h.returnItem).not.toHaveBeenCalled();
    await change(field('Gegenstand zurückgegeben?'), 'yes');
    expect(field('Rückgabe vollständig?').value).toBe(''); expect(field('Daten gelöscht?').value).toBe('');
    await submit(); expect(h.returnItem).not.toHaveBeenCalled();
    await change(field('Gegenstand zurückgegeben?'), 'no'); await submit();
    expect(dialog()?.textContent).toContain('Bitte die fehlende Rückgabe beschreiben.'); expect(h.returnItem).not.toHaveBeenCalled();
    await change(field('Hinweise zur Rücknahme'), 'Gerät fehlt; Rückgabe vereinbart.'); await submit();
    expect(h.returnItem).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-one' }), expect.objectContaining({
      assignmentId: 'a-erika', capture: expect.objectContaining({ returned: false, complete: false, condition: 'unknown', dataDeleted: null, notes: 'Gerät fehlt; Rückgabe vereinbart.' }),
    }));
  });
});
