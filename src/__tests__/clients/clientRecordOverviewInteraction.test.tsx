// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientFullDetail } from '@/types/modules/client';
import { helgaSchneiderFull } from '@/data/demo/clients/helga-schneider';
import { buildClientRecordOverview } from '@/lib/clients/clientRecordOverview.web';

const mocks = vi.hoisted(() => ({
  query: vi.fn(), fetch: vi.fn(), refresh: vi.fn(), queryResult: { data: null, loading: false, error: null, refreshError: null } as Record<string, unknown>,
}));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => 'tenant-current' }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: { id: 'profile-current', roleKey: 'business_admin', employeeId: null } }) }));
vi.mock('@/hooks/core/useAsyncQuery', () => ({ useAsyncQuery: (...args: unknown[]) => { mocks.query(...args); return { ...mocks.queryResult, refresh: mocks.refresh }; } }));
vi.mock('@/lib/assist/assignmentListService', () => ({ fetchClientAssignments: mocks.fetch }));
vi.mock('@/components/documents/DocumentRecommendations', () => ({ DocumentRecommendations: () => null }));
import { ClientRecordOverviewPanel } from '@/components/office/ClientRecordOverviewPanel.web';

let host: HTMLDivElement;
let root: Root;
const client: ClientFullDetail = { ...helgaSchneiderFull, phone: null, primaryContactPhone: null, contracts: [], consents: [], documents: [], tasks: [], timeline: [], history: [] };
const data = buildClientRecordOverview(client, [], ['uebersicht', 'stammdaten', 'dokumente', 'einsaetze', 'verlauf']);
const render = async (onNavigateTab = vi.fn(), overview = data) => {
  await act(async () => root.render(<ClientRecordOverviewPanel clientId="client-current" overview={overview} onNavigateTab={onNavigateTab} />));
};
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.queryResult = { data: [], loading: false, error: null, refreshError: null };
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('client overview actions and data states', () => {
  it('opens the relevant section from a review item and queries only the current client scope', async () => {
    const navigate = vi.fn(); await render(navigate);
    const review = host.querySelector('[aria-label="Prüfen und ergänzen"]')!;
    expect(review.textContent).toContain('Telefonnummer ergänzen');
    await act(async () => (review.querySelector('button') as HTMLButtonElement).click());
    expect(navigate).toHaveBeenCalledWith('stammdaten');
    const [fetcher, , options] = mocks.query.mock.calls[0]!;
    await fetcher();
    expect(mocks.fetch).toHaveBeenCalledWith('tenant-current', 'client-current', 'business_admin', { userId: 'profile-current', employeeId: null });
    expect(options.queryKey).toBe('client-assignments:tenant-current:client-current:profile-current:business_admin');
  });

  it('distinguishes a failed appointment fetch from having no scheduled appointment and allows retry', async () => {
    mocks.queryResult = { data: null, loading: false, error: 'connection', refreshError: null }; await render();
    const appointment = host.querySelector('[aria-label="Nächster Einsatz"]')!;
    expect(appointment.textContent).toContain('Einsatzplanung gerade nicht verfügbar');
    expect(appointment.textContent).not.toContain('Kein aktueller oder zukünftiger Einsatz');
    const retry = [...appointment.querySelectorAll('button')].find((button) => button.textContent === 'Erneut laden')!;
    await act(async () => retry.click()); expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it('shows a failed refresh even when the previously loaded schedule was empty', async () => {
    mocks.queryResult = { data: [], loading: false, error: null, refreshError: 'connection' }; await render();
    const appointment = host.querySelector('[aria-label="Nächster Einsatz"]')!;
    expect(appointment.querySelector('[role="alert"]')?.textContent).toContain('Die letzte Aktualisierung ist fehlgeschlagen');
    expect(appointment.textContent).toContain('Im zuletzt geladenen Stand kein anstehender Einsatz');
    expect(appointment.textContent).not.toContain('Die gespeicherten Einsätze enthalten derzeit keinen anstehenden Termin.');
    const retry = [...appointment.querySelectorAll('button')].find((button) => button.textContent === 'Erneut laden')!;
    await act(async () => retry.click()); expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it('hides links to unavailable sections and does not repeat the client name', async () => {
    await render(vi.fn(), { ...data, availableTabs: ['uebersicht'], quickLinks: [] });
    expect(host.querySelector('[aria-label="Nächster Einsatz"]')).toBeNull();
    expect(host.querySelectorAll('button')).toHaveLength(0);
    expect(host.textContent).not.toContain(`${client.firstName} ${client.lastName}`);
  });
});
