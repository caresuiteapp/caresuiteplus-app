// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientAssignmentProfile } from '@/types/modules/clientAssignmentProfile';

const f = vi.hoisted(() => ({
  tenant: 'tenant-a', client: 'client-a', allowed: true, os: 'android',
  profiles: [] as ClientAssignmentProfile[], refreshError: null as string | null,
  refresh: vi.fn(), save: vi.fn(), archive: vi.fn(), schedule: vi.fn(), package: vi.fn(),
  modal: {} as Record<string, any>, inputs: {} as Record<string, any>,
}));
vi.mock('react-native', () => ({
  Platform: { get OS() { return f.os; } }, useWindowDimensions: () => ({ width: 390, height: 800 }),
  StyleSheet: { create: (s: unknown) => s },
  View: ({ children }: any) => <div>{children}</div>, Text: ({ children }: any) => <span>{children}</span>,
  Pressable: ({ children, onPress, disabled, accessibilityLabel }: any) => <button aria-label={accessibilityLabel} disabled={disabled} onClick={onPress}>{children}</button>,
  TouchableOpacity: ({ children, onPress, disabled }: any) => <button disabled={disabled} onClick={onPress}>{children}</button>,
  TextInput: ({ value, onChangeText }: any) => <input value={value} onChange={(e) => onChangeText(e.target.value)} />,
  Switch: ({ value, onValueChange, disabled, accessibilityLabel }: any) => <input type="checkbox" aria-label={accessibilityLabel} checked={value} disabled={disabled} onChange={(e) => onValueChange(e.target.checked)} />,
}));
vi.mock('@/components/ui', () => ({
  PremiumInput: (props: any) => { f.inputs[props.label] = props; return <input aria-label={props.label} value={props.value} readOnly={!props.editable} onChange={(e) => props.onChangeText(e.target.value)} />; },
  PremiumButton: ({ title, onPress, disabled }: any) => <button disabled={disabled} onClick={onPress}>{title}</button>,
  PremiumCard: ({ children }: any) => <div>{children}</div>, SectionPanel: ({ children }: any) => <div>{children}</div>,
  PremiumBadge: ({ label }: any) => <span>{label}</span>, LoadingState: ({ message }: any) => <span>{message}</span>,
  ErrorState: ({ message, onRetry }: any) => <div>{message}<button onClick={onRetry}>Neu laden</button></div>,
  EmptyState: ({ title, actionLabel, onAction }: any) => <div>{title}{actionLabel ? <button onClick={onAction}>{actionLabel}</button> : null}</div>,
}));
vi.mock('@/components/layout/platform/AppGlassModal', () => ({ AppGlassModal: (props: any) => {
  f.modal = props;
  return props.visible ? <div role="dialog">{props.children}{props.footerActions.map((a: any) => <button key={a.title} disabled={a.disabled} onClick={a.onPress}>{a.title}</button>)}</div> : null;
} }));
vi.mock('@/components/inputs/CareTimeInput', () => ({ CareTimeInput: (props: any) => <input aria-label="Startzeit" value={props.value} onChange={(e) => props.onChange(e.target.value)} /> }));
vi.mock('@/components/office/assistCatalog/AssistCatalogGroupedChipSelect', () => ({ AssistCatalogGroupedChipSelect: () => null }));
vi.mock('@/components/office/assistCatalog/AssistCatalogMultiSelect', () => ({ AssistCatalogMultiSelect: () => null }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => f.tenant }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ isReadOnly: false, can: () => f.allowed }) }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: { id: 'actor-a', roleKey: 'manager' } }) }));
vi.mock('@/hooks/useEmployeeList', () => ({ useEmployeeList: () => ({ allItems: [{ id: 'employee-a', firstName: 'Anna', lastName: 'Test', status: 'aktiv' }], error: null }) }));
vi.mock('@/hooks/assistCatalog/useAssistCatalog', () => ({ useAssistAssignmentOptions: () => ({
  options: { subjects: [], assignmentTypes: [], serviceCategories: [], riskFlags: [], taskItems: [], budgetSources: [], taskPackages: [{ id: 'package-a', label: 'Paket' }] }, loading: false, error: null,
}) }));
vi.mock('@/hooks/core/useAsyncQuery', () => ({ useAsyncQuery: () => ({
  data: f.profiles.filter((p) => p.tenantId === f.tenant), loading: false, error: null, refreshError: f.refreshError,
  refresh: f.refresh, refreshWithResult: f.refresh,
}) }));
vi.mock('@/lib/realtime', () => ({ subscribeToClientRecordChanges: vi.fn(), subscribeToClientAssignmentProfileChanges: vi.fn() }));
vi.mock('@/lib/tenant/tenantServiceCatalogService', () => ({ fetchTenantServiceCatalog: vi.fn(async () => ({ ok: true, data: [] })) }));
vi.mock('@/lib/platform/confirmAction', () => ({ confirmAction: vi.fn(async () => true) }));
vi.mock('@/lib/assistCatalog', () => ({ loadTaskPackageItems: f.package, mergeTaskDrafts: (tasks: unknown) => tasks }));
vi.mock('@/lib/office/clientAssignmentProfileService', async (original) => ({
  ...await original<typeof import('@/lib/office/clientAssignmentProfileService')>(),
  listClientAssignmentProfiles: vi.fn(), saveClientAssignmentProfile: f.save,
  archiveClientAssignmentProfile: f.archive, scheduleClientAssignmentProfile: f.schedule,
}));
import { ClientAssignmentProfilesPanel } from '@/components/office/ClientAssignmentProfilesPanel';
import { OfficeAssignmentProfileCalendarPlanner } from '@/components/calendar/OfficeAssignmentProfileCalendarPlanner';

let host: HTMLDivElement; let root: Root; let drop: (id: string, date: Date, time: string) => void;
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const profile = (tenant = 'tenant-a', id = 'profile-a') => ({ id, tenantId: tenant, clientId: 'client-a', employeeId: 'employee-a', employeeName: 'Anna Test', clientName: 'Klient A', profileName: 'Haushalt', taskTitles: ['Einkaufen'], durationMinutes: 60 }) as ClientAssignmentProfile;
const receipt = { ok: true, data: { assignmentId: 'assignment-a', profileId: 'profile-a', status: 'confirmed', startAt: '2026-10-12T08:00:00Z', endAt: '2026-10-12T09:00:00Z' } };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); f.tenant = 'tenant-a'; f.client = 'client-a'; f.allowed = true; f.os = 'android'; f.profiles = []; f.refreshError = null; f.inputs = {}; f.modal = {};
  f.refresh.mockResolvedValue(true); f.save.mockResolvedValue({ ok: false, error: 'Speicherung verweigert' }); f.archive.mockResolvedValue({ ok: true }); f.schedule.mockResolvedValue(receipt);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const click = async (text: string) => { await act(async () => { const b = [...host.querySelectorAll('button')].find((b) => b.textContent === text); if (!b) throw new Error(`Button fehlt: ${text}`); b.click(); }); };
const panel = async (address?: string) => { await act(async () => root.render(<ClientAssignmentProfilesPanel clientId={f.client} fullClient={address ? { addresses: [{ isPrimary: true, street: address }] } as any : undefined} />)); };
const change = async (label: string, value: string) => { await act(async () => f.inputs[label].onChangeText(value)); };
const fill = async () => { await click('Erstes Einsatzprofil erstellen'); await change('Profilname', 'Montag'); await click('Anna Test'); await change('Aufgaben (vollständige Einsatzliste)', 'Einkaufen'); };
const planner = async (onScheduled = vi.fn(async () => true), readOnly = false) => { await act(async () => root.render(<OfficeAssignmentProfileCalendarPlanner onScheduled={onScheduled} readOnly={readOnly}>{(state) => { drop = state.onProfileDrop; return <div>Kalender</div>; }}</OfficeAssignmentProfileCalendarPlanner>)); return onScheduled; };
const selectDay = async (id = 'profile-a') => { await act(async () => drop(id, new Date('2026-10-12T12:00:00'), '10:00')); };

describe('Einsatzprofile editor scope and mutation interactions', () => {
  it('preserves entered tasks and profile name when the client address arrives, and closes the editor when the client changes', async () => {
    await panel(); await fill(); await panel('Neue Straße');
    expect(f.inputs.Profilname.value).toBe('Montag'); expect(f.inputs['Aufgaben (vollständige Einsatzliste)'].value).toBe('Einkaufen'); expect(f.inputs.Einsatzort.value).toBe('Neue Straße');
    f.client = 'client-b'; await panel(); expect(host.querySelector('[role=dialog]')).toBeNull();
    await click('Erstes Einsatzprofil erstellen'); expect(f.inputs.Profilname.value).toBe('');
  });
  it('sends one save for two synchronous presses and prevents edits while it is pending', async () => {
    const pending = deferred<any>(); f.save.mockReturnValue(pending.promise); await panel(); await fill();
    const save = f.modal.footerActions[1].onPress;
    await act(async () => { void save(); void save(); });
    expect(f.save).toHaveBeenCalledOnce(); expect(f.inputs.Profilname.editable).toBe(false);
    await change('Profilname', 'Während Speicherung geändert'); expect(f.inputs.Profilname.value).toBe('Montag');
    await act(async () => pending.resolve({ ok: false, error: 'Verweigert' })); expect(f.modal.footerActions[1].loading).toBe(false);
  });
  it('releases busy state after a thrown save and shows an unconfirmed-write message', async () => {
    f.save.mockRejectedValue(new Error('transport')); await panel(); await fill(); await click('Einsatzprofil speichern');
    expect(f.modal.footerActions[1].loading).toBe(false); expect(host.textContent).toContain('Speicherung konnte nicht bestätigt');
  });
  it('does not apply a late task package to a closed and reopened editor', async () => {
    const pending = deferred<any>(); f.package.mockReturnValue(pending.promise); await panel(); await click('Erstes Einsatzprofil erstellen'); await click('Paket'); await click('Abbrechen'); await click('Erstes Einsatzprofil erstellen');
    await change('Aufgaben (vollständige Einsatzliste)', 'Neue Aufgabe');
    await act(async () => pending.resolve({ ok: true, data: [{ itemKey: 'old', title: 'Alte Aufgabe' }] }));
    expect(f.inputs['Aufgaben (vollständige Einsatzliste)'].value).toBe('Neue Aufgabe'); expect(f.modal.footerActions[1].loading).toBe(false);
  });
  it('hides mutation entry points without assignment manage permission', async () => {
    f.allowed = false; await panel(); expect(host.textContent).not.toContain('Erstes Einsatzprofil erstellen');
  });
});

describe('Native profile calendar release interactions', () => {
  it('shows confirmed release feedback on Android', async () => {
    f.profiles = [profile()]; const refresh = await planner(); await selectDay(); await click('Einsatz direkt freigeben');
    expect(refresh).toHaveBeenCalledOnce(); expect(host.textContent).toContain('1 Einsatz um 10:00 Uhr freigegeben.'); expect(host.querySelector('[role=dialog]')).toBeNull();
  });
  it('keeps saved assignments acknowledged when the following calendar refresh returns false', async () => {
    f.profiles = [profile()]; await planner(vi.fn(async () => false)); await selectDay(); await click('Einsatz direkt freigeben');
    expect(host.textContent).toContain('bereits bestätigte Einsätze bleiben gespeichert'); expect(f.schedule).toHaveBeenCalledOnce();
  });
  it('prevents duplicate releases and hides the editable native time during persistence', async () => {
    const pending = deferred<any>(); f.schedule.mockReturnValue(pending.promise); f.profiles = [profile()]; await planner(); await selectDay(); const release = f.modal.footerActions[1].onPress;
    await act(async () => { void release(); void release(); });
    expect(f.schedule).toHaveBeenCalledOnce(); expect(host.querySelector('[aria-label=Startzeit]')).toBeNull();
    await act(async () => pending.resolve(receipt));
  });
  it('allows a new tenant batch while rejecting the old batch response and its unlock', async () => {
    const old = deferred<any>(); const current = deferred<any>(); f.schedule.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise); f.profiles = [profile()]; const refresh = await planner(); await selectDay(); await click('Einsatz direkt freigeben');
    f.tenant = 'tenant-b'; f.profiles = [profile('tenant-b', 'profile-b')]; await planner(refresh); await selectDay('profile-b'); await click('Einsatz direkt freigeben');
    expect(f.schedule).toHaveBeenCalledTimes(2); await act(async () => old.resolve(receipt));
    expect(f.modal.footerActions[1].loading).toBe(true); await act(async () => { void f.modal.footerActions[1].onPress(); }); expect(f.schedule).toHaveBeenCalledTimes(2); expect(refresh).not.toHaveBeenCalled();
    await act(async () => current.resolve({ ...receipt, data: { ...receipt.data, profileId: 'profile-b' } })); expect(refresh).toHaveBeenCalledOnce();
  });
  it('rejects release entry without write permission and invalid date drops', async () => {
    f.profiles = [profile()]; await planner(undefined, true); await selectDay(); expect(host.querySelector('[role=dialog]')).toBeNull(); expect(host.textContent).toContain('für Ihre Rolle nicht verfügbar');
    await planner(); await act(async () => drop('profile-a', new Date(NaN), '10:00')); expect(host.querySelector('[role=dialog]')).toBeNull(); expect(f.schedule).not.toHaveBeenCalled();
  });
  it('surfaces a cached-list refresh failure with a working retry action', async () => {
    f.profiles = [profile()]; f.refreshError = 'Profilabruf fehlgeschlagen'; await planner(); expect(host.textContent).toContain('Profilabruf fehlgeschlagen'); await click('Neu laden'); expect(f.refresh).toHaveBeenCalledOnce();
  });
});
