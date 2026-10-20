// @vitest-environment happy-dom
// Real Web form fields, steps and guards; network services are isolated. No layout claim.
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';
import type { RoleKey } from '@/types';
const f = vi.hoisted(() => ({
  tenant: 'tenant-a', actor: 'actor-a', allowed: true, create: vi.fn(), update: vi.fn(), clients: vi.fn(), employees: vi.fn(), catalog: vi.fn(),
  roleKey: 'business_admin' as RoleKey | null, canView: true, readonly: false,
  package: vi.fn(), close: vi.fn(), saved: vi.fn(), push: vi.fn(), dispatch: vi.fn(), prevent: vi.fn(),
}));
vi.mock('react-native', () => ({ Platform: { OS: 'web' }, StyleSheet: { create: (s: unknown) => s },
  View: ({ children }: any) => <div>{children}</div>, Text: ({ children }: any) => <span>{children}</span>,
  ScrollView: ({ children }: any) => <div>{children}</div>, TouchableOpacity: ({ children, onPress, disabled }: any) => <button disabled={disabled} onClick={onPress}>{children}</button>,
}));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: f.push }), useNavigation: () => ({ dispatch: f.dispatch }) }));
vi.mock('expo-router/react-navigation', () => ({ usePreventRemove: f.prevent }));
vi.mock('@/components/layout/ScreenShell.web', () => ({ ScreenShell: ({ children }: any) => <main>{children}</main> }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => f.tenant }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ can: (key: string) => key === 'assist.assignments.view' ? f.canView : f.allowed, isReadOnly: f.readonly, roleKey: f.roleKey }) }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: { id: f.actor, roleKey: f.roleKey } }) }));
vi.mock('@/components/assist/useAssignmentFormOptions.web', () => ({ useAssignmentFormOptions: () => ({
  options: { subjects: [], assignmentTypes: [], serviceCategories: [], riskFlags: [], taskItems: [], budgetSources: [], taskPackages: [{ id: 'pkg', label: 'Paket' }] },
  loading: false, error: null, reload() {},
}) }));
vi.mock('@/lib/office/clientListService', () => ({ fetchClientList: f.clients }));
vi.mock('@/lib/assist/assignmentEmployeeListService', () => ({ fetchAssignmentEmployeeList: f.employees }));
vi.mock('@/lib/tenant/tenantServiceCatalogService', () => ({ fetchTenantServiceCatalog: f.catalog }));
vi.mock('@/lib/assist/visitService', () => ({ createVisitFromWizard: f.create, updateVisitFromWizard: f.update }));
vi.mock('@/lib/assistCatalog', () => ({ loadTaskPackageItems: f.package, mergeTaskDrafts: (items: unknown) => items }));
vi.mock('@/components/documents/DocumentModuleTemplatesPanel', () => ({ DocumentModuleTemplatesPanel: () => null }));
vi.mock('@/components/assist/AssignmentBillingBudgetPanel.web', () => ({ AssignmentClientBillingSummary: () => null, AssignmentBillingBudgetPanel: ({ onAllocationChange }: any) => <button onClick={() => onAllocationChange({ totalAmountCents: 3275, primaryCatalogKey: 'paragraph_45b', allocationProposal: [] })}>Budgetvorschau berechnen</button> }));
vi.mock('@/components/assist/AssignmentBillingBudgetPanel', () => ({ AssignmentBillingBudgetPanel: () => null }));
import { AssignmentCreateForm } from '@/components/assist/AssignmentCreateForm.web';
import { AssignmentEditForm } from '@/components/assist/AssignmentEditForm.web';

const id = '27be8d4e-e6e1-4b2a-bccb-918ade0ad1ab';
const visit = { id, tenantId: 'tenant-a', clientId: 'client', employeeId: 'employee', clientName: 'Anna Test', employeeName: 'Tom Test',
  title: 'Haushalt', serviceName: 'Betreuung', assignmentDate: '2026-10-16', scheduledStart: '2026-10-16T07:00:00Z', scheduledEnd: '2026-10-16T08:00:00Z',
  assignmentStatus: 'geplant', planningStatus: 'scheduled', executionStatus: 'pending', documentationStatus: 'none', proofStatus: 'none',
  tasks: [{ id: 'task', title: 'Einkauf', status: 'open', isRequired: true, notDoneReason: null }], recurrenceJson: { pattern: 'none' },
} as unknown as VisitDispositionDetail;
const deferred = () => { let resolve!: (value: any) => void; const promise = new Promise<any>(r => { resolve = r; }); return { promise, resolve }; };
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); f.tenant = 'tenant-a'; f.actor = 'actor-a'; f.allowed = true; f.roleKey = 'business_admin'; f.canView = true; f.readonly = false;
  f.clients.mockResolvedValue({ ok: true, data: [{ id: 'client', firstName: 'Anna', lastName: 'Test' }] });
  f.employees.mockResolvedValue({ ok: true, data: [{ id: 'employee', firstName: 'Tom', lastName: 'Test' }] });
  f.catalog.mockResolvedValue({ ok: true, data: { items: [] } });
  f.create.mockResolvedValue({ ok: false, error: 'Verweigert' }); f.update.mockResolvedValue({ ok: false, error: 'Verweigert' });
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
async function create(visible = true) { await act(async () => root.render(<AssignmentCreateForm visible={visible} initialClientId="client" onClose={f.close} onCreated={f.saved}/>)); }
async function edit(initialVisit = visit) { await act(async () => root.render(<AssignmentEditForm visitId={initialVisit.id} initialVisit={initialVisit} onCancel={f.close} onSaved={f.saved}/>)); }
function button(label: string) { const match = [...document.body.querySelectorAll('button')].find(b => b.textContent === label); expect(match, label).toBeTruthy(); return match!; }
async function click(label: string) { await act(async () => button(label).click()); }
async function step(label: string) { const match = [...document.body.querySelectorAll('nav button')].find(b => b.textContent?.endsWith(label)); expect(match, label).toBeTruthy(); await act(async () => (match as HTMLButtonElement).click()); }
function field(label: string) { const match = [...document.body.querySelectorAll('label')].find(l => l.querySelector('span')?.textContent === label)?.querySelector<HTMLInputElement>('input,textarea,select'); expect(match, label).toBeTruthy(); return match!; }
async function fill(label: string, value: string) {
  const input = field(label); const prototype = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); });
}

describe('Web assignment forms use actual controls and preserve write boundaries', () => {
  it('saves the selected tour day and employee through the actual create form', async () => {
    await act(async () => root.render(<AssignmentCreateForm visible initialClientId="client" initialAssignmentDate="2026-11-03" initialEmployeeId="employee" onClose={f.close} onCreated={f.saved}/>));
    await step('Prüfen'); await click('Entwurf speichern');
    expect(f.create).toHaveBeenCalledOnce();
    expect(f.create.mock.calls[0][1]).toMatchObject({ clientId: 'client', assignmentDate: '2026-11-03', employeeId: 'employee', saveAsDraft: true });
  });
  it('does not save a preselected employee who is absent from the current permitted options', async () => {
    await act(async () => root.render(<AssignmentCreateForm visible initialClientId="client" initialAssignmentDate="2026-11-03" initialEmployeeId="foreign-employee" onClose={f.close} onCreated={f.saved}/>));
    await step('Prüfen'); await click('Entwurf speichern');
    expect(f.create).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('aus den aktuellen Auswahllisten wählen');
  });
  it('lets dispatch save a draft with positive assignment permissions while Office master data is read-only', async () => {
    f.roleKey = 'dispatch'; f.readonly = true; await create(); await step('Prüfen'); await click('Entwurf speichern');
    expect(f.create).toHaveBeenCalledOnce();
    expect(f.create.mock.calls[0][1]).toMatchObject({ clientId: 'client', saveAsDraft: true });
  });
  it.each([
    { label: 'missing manage', roleKey: 'dispatch', canView: true, allowed: false },
    { label: 'missing view', roleKey: 'dispatch', canView: false, allowed: true },
    { label: 'employee portal', roleKey: 'employee_portal', canView: true, allowed: true },
    { label: 'client portal', roleKey: 'client_portal', canView: true, allowed: true },
    { label: 'family portal', roleKey: 'family_portal', canView: true, allowed: true },
    { label: 'no role', roleKey: null, canView: true, allowed: true },
  ] as const)('does not load or mutate the create form for $label', async ({ roleKey, canView, allowed }) => {
    f.roleKey = roleKey; f.canView = canView; f.allowed = allowed; await create();
    expect(document.body.textContent).toContain('Keine Berechtigung zum Anlegen');
    expect(f.clients).not.toHaveBeenCalled(); expect(f.employees).not.toHaveBeenCalled(); expect(f.catalog).not.toHaveBeenCalled();
    expect(f.create).not.toHaveBeenCalled();
    expect([...document.body.querySelectorAll('button')].some(b => b.textContent === 'Entwurf speichern')).toBe(false);
  });
  it('lets dispatch edit the same visit while Office master data is read-only', async () => {
    f.roleKey = 'dispatch'; f.readonly = true; await edit(); await fill('Bezeichnung *', 'Geänderte Planung'); await click('Änderungen speichern');
    expect(f.update).toHaveBeenCalledOnce();
    expect(f.update).toHaveBeenCalledWith('tenant-a', id, expect.objectContaining({ title: 'Geänderte Planung' }), 'dispatch', 'this_only');
  });
  it.each([
    { label: 'missing manage', roleKey: 'dispatch', canView: true, allowed: false },
    { label: 'missing view', roleKey: 'dispatch', canView: false, allowed: true },
    { label: 'employee portal', roleKey: 'employee_portal', canView: true, allowed: true },
    { label: 'client portal', roleKey: 'client_portal', canView: true, allowed: true },
    { label: 'family portal', roleKey: 'family_portal', canView: true, allowed: true },
    { label: 'no role', roleKey: null, canView: true, allowed: true },
  ] as const)('does not load or mutate the edit form for $label', async ({ roleKey, canView, allowed }) => {
    f.roleKey = roleKey; f.canView = canView; f.allowed = allowed; await edit();
    expect(document.body.textContent).toContain('Keine Berechtigung zum Bearbeiten');
    expect(f.clients).not.toHaveBeenCalled(); expect(f.employees).not.toHaveBeenCalled(); expect(f.catalog).not.toHaveBeenCalled();
    expect(f.update).not.toHaveBeenCalled();
    expect([...document.body.querySelectorAll('button')].some(b => b.textContent === 'Änderungen speichern')).toBe(false);
  });
  it('creates one draft for two synchronous save clicks', async () => {
    const pending = deferred(); f.create.mockReturnValue(pending.promise); await create(); await step('Prüfen');
    const save = button('Entwurf speichern'); await act(async () => { save.click(); save.click(); });
    expect(f.create).toHaveBeenCalledOnce(); expect(f.create.mock.calls[0][1]).toMatchObject({ clientId: 'client', employeeId: '', saveAsDraft: true });
    await act(async () => pending.resolve({ ok: false, error: 'Verweigert' })); expect(button('Entwurf speichern').disabled).toBe(false);
  });
  it('retains entered text after a thrown create error and protects closing the unsaved form', async () => {
    f.create.mockRejectedValue(new Error('Speichern abgelehnt')); await create(); await fill('Titel (optional)', 'Lokaler Plan');
    await click('Abbrechen'); expect(window.confirm).toHaveBeenCalledOnce(); expect(f.close).not.toHaveBeenCalled();
    await step('Prüfen'); await click('Entwurf speichern'); expect(document.body.textContent).toContain('Speichern abgelehnt');
    await step('Grunddaten'); expect(field('Titel (optional)').value).toBe('Lokaler Plan');
  });
  it('never inserts twice after partial creation and opens its concrete saved record', async () => {
    f.create.mockResolvedValue({ ok: false, persistedVisitId: id, error: 'Kalender nicht bestätigt' });
    await create(); await step('Prüfen'); await click('Entwurf speichern');
    expect(document.body.textContent).toContain('Kalender nicht bestätigt'); expect(button('Entwurf speichern').disabled).toBe(true);
    await click('Entwurf speichern'); expect(f.create).toHaveBeenCalledOnce();
    await click('Gespeicherten Einsatz prüfen'); expect(f.push).toHaveBeenCalledWith(`/assist/assignments/${id}`); expect(f.saved).not.toHaveBeenCalled();
  });
  it('shows persisted conflict warnings before releasing the saved result', async () => {
    f.create.mockResolvedValue({ ok: true, data: { id, conflicts: ['Mitarbeitende:r doppelt verplant.'] } });
    await create(); await step('Prüfen'); await click('Entwurf speichern');
    expect(document.body.textContent).toContain('Mitarbeitende:r doppelt verplant.'); expect(f.saved).not.toHaveBeenCalled(); expect(f.close).not.toHaveBeenCalled();
    expect(button('Entwurf speichern').disabled).toBe(true); await click('Gespeicherten Einsatz prüfen');
    expect(f.saved).toHaveBeenCalledWith(id); expect(f.close).toHaveBeenCalledOnce();
  });
  it('does not reuse a client absent from the newly selected company', async () => {
    await create(); f.tenant = 'tenant-b'; f.clients.mockResolvedValue({ ok: true, data: [{ id: 'other', firstName: 'Andere', lastName: 'Person' }] });
    await create(); await step('Prüfen'); await click('Entwurf speichern');
    expect(f.create).not.toHaveBeenCalled(); expect(document.body.textContent).toContain('aktuellen Auswahllisten');
  });
  it('ignores old success after closing/reopening while the new save stays locked', async () => {
    const old = deferred(), current = deferred(); f.create.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    await create(); await step('Prüfen'); await click('Entwurf speichern'); await create(false); await create(); await step('Prüfen'); await click('Entwurf speichern');
    await act(async () => old.resolve({ ok: true, data: { id: 'old-id' } })); expect(f.saved).not.toHaveBeenCalled();
    expect([...document.body.querySelectorAll('button')].filter(b => b.textContent === 'Wird gespeichert…').every(b => b.disabled)).toBe(true);
    await act(async () => current.resolve({ ok: true, data: { id } })); expect(f.saved).toHaveBeenCalledWith(id);
  });
  it('preserves an edited draft and one save lock across repeated detail snapshots', async () => {
    const pending = deferred(); f.update.mockReturnValue(pending.promise); await edit(); await fill('Bezeichnung *', 'Lokaler Entwurf');
    const save = button('Änderungen speichern'); await act(async () => { save.click(); save.click(); }); await edit({ ...visit, title: 'Polling Snapshot' });
    expect(f.update).toHaveBeenCalledOnce(); expect(f.update.mock.calls[0][2].title).toBe('Lokaler Entwurf'); expect(field('Bezeichnung *').value).toBe('Lokaler Entwurf');
    await act(async () => pending.resolve({ ok: true, data: { id } })); expect(f.saved).toHaveBeenCalledWith(id);
  });
  it('keeps an edit failure visible without leaving or hiding the draft', async () => {
    f.update.mockRejectedValue(new Error('Änderung abgelehnt')); await edit(); await fill('Bezeichnung *', 'Lokale Änderung'); await click('Änderungen speichern');
    expect(document.body.textContent).toContain('Änderung abgelehnt'); expect(field('Bezeichnung *').value).toBe('Lokale Änderung');
    expect(button('Änderungen speichern').disabled).toBe(false); expect(f.saved).not.toHaveBeenCalled(); expect(f.close).not.toHaveBeenCalled();
  });
  it('blocks replaying a partially persisted edit', async () => {
    f.update.mockResolvedValue({ ok: false, persistedVisitId: id, error: 'Status nicht bestätigt' });
    await edit(); await click('Änderungen speichern'); expect(document.body.textContent).toContain('Status nicht bestätigt');
    expect(button('Änderungen speichern').disabled).toBe(true); await click('Änderungen speichern'); expect(f.update).toHaveBeenCalledOnce();
  });
  it('rejects stale edit callbacks after an actor switch', async () => {
    const pending = deferred(); f.update.mockReturnValue(pending.promise); await edit(); await click('Änderungen speichern'); f.actor = 'actor-b'; await edit();
    await act(async () => pending.resolve({ ok: true, data: { id } })); expect(f.saved).not.toHaveBeenCalled(); expect(button('Änderungen speichern').disabled).toBe(false);
  });
  it('clears an old budget preview when the planned time changes', async () => {
    await create(); await step('Budget'); await click('Budgetvorschau berechnen'); await step('Termin & Serie');
    await fill('Beginn *', '09:30'); await step('Prüfen'); await click('Entwurf speichern');
    expect(f.create).toHaveBeenCalledOnce(); expect(f.create.mock.calls[0][1].budgetAllocation).toBeNull();
  });
  it('requires the service to calculate series budgets even after opening the preview', async () => {
    await create(); await step('Termin & Serie'); await fill('Wiederholung', 'weekly'); await step('Budget'); await click('Budgetvorschau berechnen');
    await step('Prüfen'); await click('Entwurf speichern');
    expect(f.create).toHaveBeenCalledOnce(); expect(f.create.mock.calls[0][1]).toMatchObject({ recurrencePattern: 'weekly', budgetAllocation: null });
  });
  it('ignores a save result after write permission is revoked and releases the lock on regrant', async () => {
    const pending = deferred(); f.create.mockReturnValueOnce(pending.promise); await create(); await step('Prüfen'); await click('Entwurf speichern');
    f.allowed = false; await create(); await act(async () => pending.resolve({ ok: true, data: { id } })); expect(f.saved).not.toHaveBeenCalled(); expect(f.close).not.toHaveBeenCalled();
    f.allowed = true; await create(); await step('Prüfen'); expect(button('Entwurf speichern').disabled).toBe(false);
  });
});
