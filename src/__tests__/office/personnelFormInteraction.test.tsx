// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { EmployeeCreateForm } from '@/components/office/employeecreateform.web';
import { EmployeeEditForm } from '@/components/office/employeeeditform.web';
import { PersonnelDialog } from '@/components/office/PersonnelDialog.web';
import { EMPTY_EMPLOYEE_EDIT_FORM } from '@/types/forms/employeeEditForm';

const h = vi.hoisted(() => ({ tenantId: 'tenant-a', write: true, create: vi.fn(), fetch: vi.fn(), save: vi.fn(), created: vi.fn(), updated: vi.fn(), cancel: vi.fn(), dispatch: vi.fn(), preventRemoval: false, onRemoval: (_event: { data: { action: object } }) => {} }));
vi.mock('expo-router', () => ({ useNavigation: () => ({ dispatch: h.dispatch }) }));
vi.mock('expo-router/react-navigation', () => ({ usePreventRemove: (prevent: boolean, callback: typeof h.onRemoval) => { h.preventRemoval = prevent; h.onRemoval = callback; } }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => h.tenantId }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: { id: 'profile', roleKey: 'business_admin' }, user: { id: 'actor' } }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ can: () => h.write, isReadOnly: !h.write }) }));
vi.mock('@/lib/office/createPersonnelProfile.web', () => ({ createPersonnelProfile: h.create }));
vi.mock('@/lib/office/employeeEditService', () => ({ fetchEmployeeEditData: h.fetch, saveEmployeeEdit: h.save }));
vi.mock('@/components/office/PersonalWorkspaceSurface', () => ({ PersonalWorkspaceSurface: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/office/EmployeeProfilePhotoPicker', () => ({ EmployeeProfilePhotoPicker: () => <span>Profilfoto</span> }));
vi.mock('@/hooks/templates/useDropdownOptions', () => ({ useDropdownOptions: (catalog: string) => ({ loading: false, error: null, refresh: vi.fn(), options: catalog === 'employee_role' ? [{ value: 'pflegefachkraft', label: 'Pflegefachkraft' }] : catalog === 'employee_department' ? [{ value: 'pflege', label: 'Pflege' }] : [{ value: 'aktiv', label: 'Aktiv' }] }) }));

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); h.updated.mockReset(); h.tenantId = 'tenant-a'; h.write = true;
  h.create.mockResolvedValue({ ok: true, data: { id: 'new-employee' } });
  h.fetch.mockResolvedValue({ ok: true, data: { employee: { avatarUrl: null }, form: { ...EMPTY_EMPLOYEE_EDIT_FORM, firstName: 'Mara', lastName: 'Sommer', roleKey: 'pflegefachkraft', email: 'mara@example.invalid' } } });
  h.save.mockResolvedValue({ ok: true, data: { avatarUrl: null } });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
const renderCreate = () => act(async () => root.render(<EmployeeCreateForm onCreated={h.created} onCancel={h.cancel} />));
const renderEdit = (id = 'employee') => act(async () => root.render(<EmployeeEditForm employeeId={id} onUpdated={h.updated} onCancel={h.cancel} />));
function button(text: string) { return [...(document.querySelector('.pe-dialog') ?? host).querySelectorAll<HTMLButtonElement>('button')].find(el => el.textContent?.trim() === text)!; }
const click = (text: string) => act(async () => button(text).click());
async function field(label: string, value: string) {
  const el = [...(document.querySelector('.pe-dialog') ?? host).querySelectorAll<HTMLLabelElement>('label')].find(item => item.textContent?.replace(' *', '') === label)!;
  const control = document.getElementById(el.htmlFor) as HTMLInputElement | HTMLSelectElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(control.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(control, value);
    control.dispatchEvent(new Event(control.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  });
}
async function completeCreate() {
  await field('Vorname', 'Mara'); await field('Nachname', 'Sommer'); await field('E-Mail', 'mara@example.invalid');
  await click('Weiter'); await field('Funktion / Berufsbezeichnung', 'pflegefachkraft'); await click('Weiter');
}
describe('personnel form workflows', () => {
  it('requires valid contact and function, then persists one draft despite repeated submission', async () => {
    let finish!: (value: unknown) => void;
    h.create.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    await renderCreate(); await click('Weiter');
    expect(host.querySelectorAll('[aria-invalid="true"]')).toHaveLength(3);
    expect(h.create).not.toHaveBeenCalled();
    await field('Vorname', 'Mara'); await field('Nachname', 'Sommer'); await field('E-Mail', 'mara@example.invalid');
    await click('Weiter'); await click('Weiter');
    expect(host.querySelector('select[aria-invalid="true"]')).not.toBeNull();
    await field('Funktion / Berufsbezeichnung', 'pflegefachkraft'); await click('Weiter');
    await act(async () => {
      const form = host.querySelector('form')!;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(h.create).toHaveBeenCalledOnce();
    expect(h.create).toHaveBeenCalledWith('tenant-a', expect.objectContaining({ firstName: 'Mara', jobTitle: 'pflegefachkraft', status: 'entwurf' }), 'business_admin');
    expect(button('Abbrechen').disabled).toBe(true);
    await act(async () => finish({ ok: true, data: { id: 'new-employee' } }));
    expect(h.created).toHaveBeenCalledExactlyOnceWith('new-employee');
  });
  it('shows optional-photo partial success and opens the existing record without creating again', async () => {
    h.create.mockResolvedValue({ ok: true, data: { id: 'saved-employee', warning: 'Das Profilfoto konnte nicht gespeichert werden.' } });
    await renderCreate(); await completeCreate(); await click('Entwurf anlegen');
    expect(host.textContent).toContain('Die Personalakte ist angelegt');
    expect(host.textContent).toContain('Das Profilfoto konnte nicht gespeichert werden.');
    expect(h.created).not.toHaveBeenCalled();
    await click('Personalakte öffnen'); await click('Personalakte öffnen');
    expect(h.created).toHaveBeenCalledExactlyOnceWith('saved-employee'); expect(h.create).toHaveBeenCalledOnce();
  });
  it('protects unsaved input and resets it when the tenant changes', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await renderCreate(); await field('Vorname', 'Mara'); await click('Abbrechen');
    expect(h.cancel).not.toHaveBeenCalled(); expect(window.confirm).toHaveBeenCalledOnce();
    h.tenantId = 'tenant-b'; await renderCreate();
    expect(host.querySelector<HTMLInputElement>('input')?.value).toBe('');
    expect(host.querySelector('form')?.getAttribute('data-personnel-dirty')).toBe('false');
  });
  it('retains edits after a rejected save and permits one successful retry', async () => {
    h.save.mockRejectedValueOnce(new Error('offline'));
    await renderEdit(); await field('Vorname', 'Maria');
    await click('Beschäftigung & Adresse'); await field('Wochenstunden', '32,5');
    await click('Änderungen speichern');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('nicht bestätigt');
    expect(h.updated).not.toHaveBeenCalled(); expect(button('Änderungen speichern').disabled).toBe(false);
    await click('Änderungen speichern');
    expect(h.save).toHaveBeenLastCalledWith('employee', 'tenant-a', expect.objectContaining({ firstName: 'Maria', weeklyHours: '32,5' }), 'business_admin', null);
    expect(h.updated).toHaveBeenCalledOnce(); expect(button('Änderungen speichern').disabled).toBe(true);
  });
  it('returns to the invalid field and never saves invalid hours', async () => {
    await renderEdit(); await click('Beschäftigung & Adresse'); await field('Wochenstunden', '80');
    await click('Qualifikationen'); await click('Änderungen speichern');
    expect(host.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Beschäftigung & Adresse');
    expect(host.textContent).toContain('Wochenstunden zwischen 0 und 60'); expect(h.save).not.toHaveBeenCalled();
  });
  it('does not leak the previous record while the next record fails to load', async () => {
    await renderEdit(); expect(host.textContent).toContain('Mara Sommer');
    h.fetch.mockRejectedValueOnce(new Error('offline')); await renderEdit('other-employee');
    expect(host.textContent).toContain('Personalakte nicht verfügbar'); expect(host.textContent).not.toContain('Mara Sommer');
    expect(host.querySelector('form')).toBeNull();
  });
  it('shows no create or edit controls without write permission', async () => {
    h.write = false; await renderCreate(); expect(host.querySelector('form')).toBeNull();
    await renderEdit(); expect(host.querySelector('form')).toBeNull();
    expect(h.create).not.toHaveBeenCalled(); expect(h.save).not.toHaveBeenCalled();
  });
  it('protects route removal and confirms a deliberate cancel only once', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await renderCreate(); await field('Vorname', 'Mara');
    const action = { type: 'GO_BACK' };
    expect(h.preventRemoval).toBe(true);
    await act(async () => h.onRemoval({ data: { action } }));
    expect(h.dispatch).not.toHaveBeenCalled();
    confirm.mockReturnValue(true); await click('Abbrechen');
    await act(async () => h.onRemoval({ data: { action } }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(h.dispatch).toHaveBeenCalledExactlyOnceWith(action);
  });
  it('allows navigation immediately after a successful save without a discard prompt', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const action = { type: 'GO_BACK' };
    h.updated.mockImplementation(() => h.onRemoval({ data: { action } }));
    await renderEdit(); await field('Vorname', 'Maria'); await click('Änderungen speichern');
    expect(confirm).not.toHaveBeenCalled(); expect(h.dispatch).toHaveBeenCalledExactlyOnceWith(action);
  });
  it('uses the same discard decision when closing a modal and removing its route', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const action = { type: 'GO_BACK' };
    await act(async () => root.render(<PersonnelDialog visible title="Neue Personalakte" form onClose={() => h.onRemoval({ data: { action } })}><EmployeeCreateForm onCancel={h.cancel} onCreated={h.created} /></PersonnelDialog>));
    await field('Vorname', 'Mara');
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Neue Personalakte schließen"]')!.click());
    expect(confirm).toHaveBeenCalledOnce(); expect(h.dispatch).toHaveBeenCalledExactlyOnceWith(action);
  });
});
