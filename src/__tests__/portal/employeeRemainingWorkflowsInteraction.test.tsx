// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ query: vi.fn(), request: vi.fn(), withdraw: vi.fn(), mobility: vi.fn(), refresh: vi.fn(), refreshWithResult: vi.fn(), save: vi.fn(), actor: { tenantId: 'tenant', employeeId: 'employee', actorId: 'user', roleKey: 'employee_portal', isReady: true } }));
vi.mock('react-native', () => ({
  View: ({ children }: any) => <div>{children}</div>, Text: ({ children }: any) => <span>{children}</span>,
  TextInput: ({ value, onChangeText, ...p }: any) => <textarea aria-label={p.placeholder} value={value} onInput={(e: any) => onChangeText(e.target.value)} />,
  StyleSheet: { create: (value: any) => value }, Linking: { openURL: vi.fn() }, Platform: { OS: 'web', select: (p: any) => p.web ?? p.default },
}));
vi.mock('@/components/ui', () => ({
  SectionPanel: ({ title, children }: any) => <section><h2>{title}</h2>{children}</section>,
  EmptyState: ({ title, message }: any) => <div>{title}: {message}</div>, LoadingState: ({ message }: any) => <div>{message}</div>,
  ErrorState: ({ title, message, onRetry, presentation }: any) => <div data-state-presentation={presentation}>{title}: {message}{onRetry ? <button onClick={onRetry}>Erneut versuchen</button> : null}</div>,
  InfoBanner: ({ title, message }: any) => <div>{title}: {message}</div>, SuccessState: ({ message }: any) => <div>{message}</div>,
  PremiumBadge: ({ label }: any) => <span>{label}</span>, PremiumKpiCard: ({ label, value }: any) => <div>{label} {value}</div>,
  PremiumButton: ({ title, onPress, disabled, loading }: any) => <button disabled={disabled} onClick={onPress} data-loading={Boolean(loading)}>{title}</button>,
  PremiumInput: ({ label, value, onChangeText }: any) => <input aria-label={label} value={value} onInput={(e: any) => onChangeText(e.target.value)} />,
  FilterChipGroup: ({ options, onChange, multiple, value }: any) => <div>{options.map((item: any) => <button key={item.key} onClick={() => onChange(multiple ? [item.key] : item.key)}>{item.label}</button>)}</div>,
}));
vi.mock('@/components/permissions', () => ({ LockedActionBanner: ({ message }: any) => <div>{message}</div> }));
vi.mock('@/screens/portal/PortalTabScreen', () => ({ PortalTabScreen: ({ children }: any) => <main>{children}</main> }));
vi.mock('@/components/inputs', () => ({ CareDateInput: ({ label, value, onChange }: any) => <input aria-label={label} value={value} onInput={(e: any) => onChange(e.target.value)} /> }));
vi.mock('@/components/ui/WorkflowToast', () => ({ WorkflowToast: ({ message }: any) => <div>{message}</div> }));
vi.mock('@/components/aurora', () => ({ AuroraSegmentedControl: () => null }));
vi.mock('@/hooks/core/useAsyncQuery', () => ({ useAsyncQuery: h.query }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ can: () => true, check: () => ({}), roleLabel: 'Mitarbeitende' }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => h.actor.tenantId }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => h.actor }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ user: { id: 'user' }, profile: { employeeId: 'employee' } }) }));
vi.mock('@/lib/wfm', () => ({ listWfmAbsencesForEmployee: vi.fn(), requestWfmAbsence: h.request, withdrawWfmAbsenceRequest: h.withdraw, getWfmTodayAmpel: vi.fn(), getWfmTimeAccountForMonth: vi.fn(), evaluateAndStoreArbzgForToday: vi.fn(), listEmployeeRuleViolationsForToday: vi.fn() }));
vi.mock('@/hooks/useEmployeeMobilitySettings', () => ({ useEmployeeMobilitySettings: h.mobility }));
vi.mock('@/design/tokens/auroraGlass', () => ({ useAuroraAdaptiveText: () => ({ primary: '#000', secondary: '#333' }) }));
vi.mock('@/theme', () => ({ typography: { body: {}, caption: {}, h3: {} }, spacing: { md: 12, sm: 8, xs: 4 } }));
import { WfmAbsencePortalScreen } from '@/components/wfm/WfmAbsencePortalScreen';
import { WfmTimeAccountPanel } from '@/components/wfm/WfmTimeAccountPanel';
import { EmployeeMobilitySettingsForm } from '@/components/portal/EmployeeMobilitySettingsForm';
import { WfmRuleWarningsPanel } from '@/components/wfm/WfmRuleWarningsPanel';
let root: Root, host: HTMLDivElement;
const query = (patch = {}) => ({ data: null, loading: false, error: null, refreshError: null, refresh: h.refresh, refreshWithResult: h.refreshWithResult, ...patch });
const settings = (patch = {}) => ({ tenantId: 'tenant', employeeId: 'employee', transportModes: ['car'], routeStartType: 'home', routeEndType: 'home', routeStartAddress: null, routeEndAddress: null, ...patch });
const mobility = (patch = {}) => ({ settings: settings(), addressContext: { employeeHome: {}, tenantOffice: {} }, loading: false, error: null, saving: false, saveError: null, save: h.save, refresh: h.refresh, ...patch });
beforeEach(() => {
  vi.clearAllMocks(); (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  h.query.mockReturnValue(query({ data: [] })); h.refresh.mockResolvedValue(undefined); h.refreshWithResult.mockResolvedValue(true); h.mobility.mockReturnValue(mobility());
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async (element: React.ReactNode) => { await act(async () => root.render(element)); };
const button = (text: string) => [...host.querySelectorAll('button')].find((e) => e.textContent === text)!;
const edit = async (label: string, value: string) => { await act(async () => { const el = host.querySelector(`[aria-label="${label}"]`) as HTMLInputElement; el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); }); };
describe('employee remaining workflows on a mounted UI', () => {
  it('shows absence read errors with a real retry instead of claiming no requests', async () => {
    h.query.mockReturnValue(query({ error: 'Netzwerkfehler' })); await render(<WfmAbsencePortalScreen />);
    expect(host.textContent).toContain('Netzwerkfehler'); expect(host.textContent).not.toContain('Es liegen keine Anträge vor');
    await act(async () => button('Erneut versuchen').click()); expect(h.refresh).toHaveBeenCalledOnce();
  });
  it('shows loading without an empty absence claim', async () => {
    h.query.mockReturnValue(query({ loading: true })); await render(<WfmAbsencePortalScreen />);
    expect(host.textContent).toContain('werden geladen'); expect(host.textContent).not.toContain('Es liegen keine Anträge vor');
  });
  it('releases absence submit controls after a thrown error and prevents simultaneous writes', async () => {
    let reject!: (e: Error) => void; h.request.mockImplementation(() => new Promise((_resolve, r) => { reject = r; }));
    await render(<WfmAbsencePortalScreen />); await edit('Von', '12.10.2026'); await edit('Bis', '13.10.2026');
    await act(async () => { button('Antrag einreichen').click(); button('Antrag einreichen').click(); });
    expect(h.request).toHaveBeenCalledOnce(); expect(button('Antrag einreichen').disabled).toBe(true);
    await act(async () => reject(new Error('Verbindung unterbrochen')));
    expect(host.textContent).toContain('Verbindung unterbrochen'); expect(button('Antrag einreichen').disabled).toBe(false);
    expect(h.refresh).not.toHaveBeenCalled();
  });
  it('keeps a persisted submission distinct from a failed list refresh', async () => {
    h.request.mockResolvedValue({ ok: true, data: { id: 'new' } }); h.refreshWithResult.mockResolvedValue(false);
    await render(<WfmAbsencePortalScreen />); await edit('Von', '12.10.2026'); await edit('Bis', '13.10.2026');
    await act(async () => button('Antrag einreichen').click());
    expect(host.textContent).toContain('Antrag wurde eingereicht. Die Übersicht konnte noch nicht aktualisiert');
    expect(h.refreshWithResult).toHaveBeenCalledOnce(); expect(h.refresh).not.toHaveBeenCalled();
  });
  it('keeps withdrawal retryable after a thrown service failure', async () => {
    h.query.mockReturnValue(query({ data: [{ id: 'absence', absenceType: 'vacation', status: 'requested', startsAt: '2026-10-12', endsAt: '2026-10-13', internalNote: '' }] }));
    h.withdraw.mockRejectedValue(new Error('Rücknahme nicht erreichbar')); await render(<WfmAbsencePortalScreen />);
    await act(async () => button('Zurückziehen').click());
    expect(host.textContent).toContain('Rücknahme nicht erreichbar'); expect(button('Zurückziehen').disabled).toBe(false);
  });
  it('shows month-account failures with retry instead of an endless calculation', async () => {
    h.query.mockReturnValue(query({ error: 'Sollzeit nicht freigegeben' }));
    await render(<WfmTimeAccountPanel tenantId="tenant" userId="user" roleKey="employee_portal" employeeId="employee" />);
    expect(host.textContent).toContain('Sollzeit nicht freigegeben'); expect(host.textContent).not.toContain('Zeitkonto wird berechnet');
    const failures = [...host.querySelectorAll('[data-state-presentation]')];
    expect(failures).toHaveLength(2);
    expect(failures.every((failure) => failure.getAttribute('data-state-presentation') === 'inline')).toBe(true);
    await act(async () => button('Zeitkonto aktualisieren').click()); expect(h.refresh).toHaveBeenCalledTimes(2);
  });
  it('does not claim a clear rule check when the required reads failed', async () => {
    h.query.mockReturnValue(query({ error: 'Regelprüfung nicht erreichbar' }));
    await render(<WfmRuleWarningsPanel tenantId="tenant" userId="user" roleKey="employee_portal" employeeId="employee" />);
    expect(host.textContent).toContain('Regelprüfung nicht erreichbar'); expect(host.textContent).not.toContain('Keine Regelverstöße');
    await act(async () => button('Erneut versuchen').click()); expect(h.refresh).toHaveBeenCalledTimes(2);
  });
  it('preserves an edited mobility draft when background reads finish', async () => {
    await render(<EmployeeMobilitySettingsForm tenantId="tenant" employeeId="employee" />);
    await act(async () => button('Eigene Adresse').click());
    await edit('Eigene Startadresse', 'Neue Adresse 1');
    h.mobility.mockReturnValue(mobility({ settings: settings({ updatedAt: 'refresh' }) }));
    await render(<EmployeeMobilitySettingsForm tenantId="tenant" employeeId="employee" />);
    expect((host.querySelector('[aria-label="Eigene Startadresse"]') as HTMLInputElement).value).toBe('Neue Adresse 1');
  });
  it('does not change mobility options in read-only mode', async () => {
    await render(<EmployeeMobilitySettingsForm tenantId="tenant" employeeId="employee" readOnly />);
    await act(async () => button('Eigene Adresse').click());
    expect(host.querySelector('[aria-label="Eigene Startadresse"]')).toBeNull(); expect(button('Speichern')).toBeUndefined();
  });
});
