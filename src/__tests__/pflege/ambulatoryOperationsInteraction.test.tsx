// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CareAdmission, CareTask } from '@/lib/pflege/ambulatoryOperationsDomain';
import { AmbulatoryOperationsScreen } from '@/screens/pflege/AmbulatoryOperationsScreen.web';

const api = vi.hoisted(() => ({
  tenant: '11111111-1111-4111-8111-111111111111', client: '55555555-5555-4555-8555-555555555555',
  actor: '11111111-1111-4111-8111-111111111122', user: '11111111-1111-4111-8111-111111111133',
  params: {} as { clientId?: string | string[] },
  supported: true, edit: true,
  read: vi.fn(), saveTask: vi.fn(), advance: vi.fn(), replace: vi.fn(), push: vi.fn(), profiles: vi.fn(),
}));

vi.mock('react-native', () => ({
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Pressable: (props: { children: ReactNode; onPress(): void; disabled: boolean; accessibilityLabel: string; 'aria-expanded': boolean }) =>
    <button disabled={props.disabled} onClick={props.onPress} aria-label={props.accessibilityLabel} aria-expanded={props['aria-expanded']}>{props.children}</button>,
  StyleSheet: { create: (styles: unknown) => styles }, AppState: {}, Platform: { OS: 'web' },
}));
vi.mock('expo-router', () => ({ useLocalSearchParams: () => api.params, useRouter: () => ({ push: api.push, replace: api.replace }) }));
vi.mock('@/components/layout', () => ({ ScreenShell: ({ title, subtitle, rightSlot, children }: { title: string; subtitle: string; rightSlot: ReactNode; children: ReactNode }) => <main><h1>{title}</h1>{subtitle}{rightSlot}{children}</main> }));
vi.mock('@/components/ui', () => ({
  EmptyState: ({ title }: { title: string }) => <p>{title}</p>,
  ErrorState: ({ message }: { message: string }) => <p>{message}</p>,
  LoadingState: ({ message }: { message: string }) => <p>{message}</p>,
  InfoBanner: ({ title, message }: { title: string; message: string }) => <p>{title}{message}</p>,
  SectionPanel: ({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) => <section><h2>{title}</h2><p>{subtitle}</p>{children}</section>,
  PremiumButton: ({ title, onPress, disabled }: { title: string; onPress(): void; disabled: boolean }) => <button onClick={onPress} disabled={disabled}>{title}</button>,
  PremiumInput: ({ label, value, onChangeText, editable, multiline }: { label: string; value: string; onChangeText(value: string): void; editable: boolean; multiline?: boolean }) =>
    multiline ? <textarea aria-label={label} value={value} readOnly={editable === false} onInput={event => onChangeText(event.currentTarget.value)} /> :
      <input aria-label={label} value={value} readOnly={editable === false} onInput={event => onChangeText(event.currentTarget.value)} />,
  FilterChipGroup: ({ options, onChange }: { options: { key: string; label: string }[]; onChange?(value: string): void }) =>
    <div>{options.map(option => <button key={option.key} disabled={!onChange} onClick={() => onChange?.(option.key)}>{option.label}</button>)}</div>,
}));
vi.mock('@/hooks/core', async () => ({ useAsyncQuery: (await import('@/hooks/core/useAsyncQuery')).useAsyncQuery }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ useLiveRefresh: () => ({}), DEFAULT_LIVE_POLL_MS: 30_000 }));
vi.mock('@/hooks/useLocalMinute', () => ({ useLocalMinute: () => new Date('2026-11-14T11:00:00Z') }));
vi.mock('@/hooks/pflege/useCareRuntimePermissions.web', () => ({
  useCareRuntimePermissions: () => {
    const grants = ['office.access', 'pflege.access', 'pflege.plans.view', 'office.clients.view'].concat(api.edit ? ['pflege.plans.manage'] : []);
    return { tenantId: api.tenant, roleKey: 'business_admin', loading: false, error: null, permissions: grants,
      can: (key: string) => api.supported && (key !== 'pflege.plans.manage' || api.edit) && grants.includes(key), hasModuleGate: () => api.supported };
  },
}));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: { id: api.actor, tenantId: api.tenant, roleKey: 'business_admin' },
  user: { id: api.user }, session: { user: { id: api.user }, accessToken: 'private-test-token', expiresAt: null },
  authReady: true, isAuthenticated: true, isLoading: false, profileBootstrapError: null, portalSession: null }) }));
vi.mock('@/lib/careAssessment', () => ({ fetchEligibleCareClients: api.profiles }));
vi.mock('@/lib/pflege/ambulatoryOperationsService', () => ({ fetchCareOperationsQueue: api.read, saveCareTask: api.saveTask,
  advanceCareAdmission: api.advance, createCareTariff: vi.fn(), saveCareAdmission: vi.fn() }));
vi.mock('@/lib/pflege/careTourPlanningService', () => ({ fetchCareTourResources: async () => ({ ok: true, data: { employees: [] } }) }));
vi.mock('@/design/tokens/carelightadaptive', () => ({ useCareLightPalette: () => ({ c: {} }) }));
vi.mock('@/theme', () => ({ spacing: {}, typography: { body: {}, bodyStrong: {} }, radius: {} }));

let root: Root;
let host: HTMLDivElement;
const version = '2026-11-14T09:00:00Z';
const task: CareTask = { id: 'task', clientId: api.client, title: 'Angehörige zurückrufen', description: 'Bestätigung erfragen', status: 'open', dueOn: '2026-11-13', priority: 'urgent', resolution: '', assignedEmployeeId: '', updatedAt: version };
const admission: CareAdmission = { id: 'admission', clientId: api.client, clientName: '', status: 'draft', startsOn: '2026-11-14', endsOn: '', basis: 'private', payerName: '', payerIk: '', contractReference: 'Vertrag', costInformationReference: 'Kosteninformation', consentReference: '', emergencyContact: '', accessNotes: '', notes: '', updatedAt: version };
const render = (area: 'tasks' | 'admissions') => act(async () => root.render(<AmbulatoryOperationsScreen area={area} />));
const button = (name: string) => Array.from(host.querySelectorAll('button')).find(element => (element.getAttribute('aria-label') ?? element.textContent) === name);
const click = async (name: string) => {
  expect(button(name)).toBeDefined();
  await act(async () => button(name)?.click());
};
const enter = (name: string, value: string) => act(async () => {
  const field = host.querySelector<HTMLInputElement>(`[aria-label="${name}"]`)!;
  field.value = value; field.dispatchEvent(new Event('input', { bubbles: true }));
});
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); api.params = { clientId: api.client }; api.supported = true; api.edit = true;
  api.profiles.mockResolvedValue({ ok: true, data: [{ id: api.client, firstName: 'Marie', lastName: 'Müller', careLevel: null, dateOfBirth: null }] });
  api.read.mockResolvedValue({ ok: true, data: { tasks: [task], admissions: [admission], tariffs: [] } });
  api.saveTask.mockResolvedValue({ ok: true, data: { id: task.id } });
  api.advance.mockResolvedValue({ ok: true, data: { id: admission.id } });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('Aufnahme und Aufgaben interaction', () => {
  it('keeps a case link, filters overdue items, and submits required outcome to the scoped confirmed task', async () => {
    await render('tasks');
    expect(api.read).toHaveBeenCalledWith(api.tenant, 'business_admin', 'tasks', api.client, expect.any(Function));
    await click('Aufnahme & Versorgung');
    expect(api.push).toHaveBeenCalledWith(`/pflege/aufnahme?clientId=${api.client}`);
    await click('Heute fällig');
    expect(host.textContent).not.toContain(task.title);
    await click('Überfällig');
    await click(`Details öffnen: ${task.title}`);
    await click('Ergebnis dokumentieren');
    expect(button('Aufgabe als erledigt speichern')?.disabled).toBe(true);
    await enter('Ergebnis *', 'Rückruf bestätigt');
    await click('Aufgabe als erledigt speichern');
    expect(api.saveTask).toHaveBeenCalledExactlyOnceWith(api.tenant, 'business_admin', { status: 'done', resolution: 'Rückruf bestätigt' }, task);
  });

  it('does not dispatch a release after write permission disappears and never loads an invalid case scope', async () => {
    await render('admissions');
    await click('Freigabebereit');
    await click('Details öffnen: Marie Müller');
    await click('Versorgung freigeben');
    expect(api.advance).not.toHaveBeenCalled();
    api.edit = false;
    await render('admissions');
    expect(button('Versorgung freigeben')).toBeUndefined();
    expect(api.advance).not.toHaveBeenCalled();
    api.params = { clientId: [api.client, 'anderer-pflegefall'] };
    api.read.mockClear();
    await render('admissions');
    expect(host.textContent).toContain('Pflegefalllink ist ungültig');
    expect(api.read).not.toHaveBeenCalled();
  });
});
