// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientFullDetail, ClientPortalAccess } from '@/types/modules/client';

const f = vi.hoisted(() => ({ modules: vi.fn(), saveModules: vi.fn(), setup: vi.fn(), regenerate: vi.fn(), access: vi.fn(), copy: vi.fn(), settingsSave: vi.fn(), review: vi.fn(), refresh: vi.fn(), readOnly: false, tenant: 'tenant-a', queryError: null as string | null }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: { id: 'actor-a', roleKey: 'business_admin' } }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ isReadOnly: f.readOnly }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => f.tenant }));
vi.mock('@/lib/portal/clientModuleAssignmentService', () => ({ fetchClientModuleAssignments: f.modules, saveClientModuleAssignments: f.saveModules }));
vi.mock('@/lib/clients/clientPortalAccessService', () => ({ fetchClientPortalAccess: f.access, setupClientPortalAccess: f.setup, regenerateClientPortalAccessCode: f.regenerate }));
vi.mock('@/lib/clients/academyFamilyAccessService', () => ({ listAcademyFamilyAccess: async () => ({ accesses: [], ready: true }), manageAcademyFamilyAccess: vi.fn() }));
vi.mock('@/lib/platform/clipboard', () => ({ copyTextToClipboard: f.copy }));
vi.mock('@/components/office/PortalRequestsOfficePanel', () => ({ PortalRequestsOfficePanel: () => null }));
vi.mock('@/components/office/PortalUploadsOfficePanel', () => ({ PortalUploadsOfficePanel: () => null }));
vi.mock('@/components/office/OfficePortalApprovalsInbox', () => ({ OfficePortalApprovalsInbox: () => null }));
vi.mock('@/components/office/ClientPortalEmployeeVisibility.web', () => ({ ClientPortalEmployeeVisibility: () => null }));
vi.mock('@/components/office/PortalSyncChainPanel.web', () => ({ PortalSyncChainPanel: () => null }));
vi.mock('@/lib/clients/clientDocumentsService', () => ({ syncClientDocumentPortalReleaseIfEnabled: vi.fn(async () => ({ ok: true, data: { synced: true, updated: 0 } })) }));
vi.mock('@/lib/portal/portalSyncChainService', () => ({ listPortalSyncRowsForClient: vi.fn() }));
vi.mock('@/lib/client/clientPortalSettingsService', () => ({ fetchClientPortalSettingsResolved: vi.fn(), listClientPortalAccessRequests: vi.fn(), listVisiblePortalFeatures: vi.fn(), reviewClientPortalAccessRequest: f.review, upsertClientPortalSettings: f.settingsSave }));
vi.mock('@/hooks/core/useAsyncQuery', () => ({ useAsyncQuery: (_fetch: unknown, _deps: unknown, options: { queryKey: string }) => ({
  data: options.queryKey.startsWith('settings:') ? { portalEnabled: true, inheritTenantDefaults: true, showAppointments: true, showMessages: true, showDocuments: false, showProofs: true } : options.queryKey.startsWith('features:') ? ['appointments', 'messages', 'proofs'] : [],
  loading: false, error: null, refreshError: f.queryError, refreshing: false, refresh: f.refresh, refreshWithResult: f.refresh,
}) }));
import { ClientPortalAccessPanel } from '@/components/clients/ClientPortalAccessPanel.web';
import { ClientPortalCorePanel } from '@/components/office/ClientPortalCorePanel.web';

let host: HTMLDivElement;
let root: Root;
const client = (id = 'client-a') => ({ id, firstName: 'Test', lastName: 'Person', portalAccess: [] }) as unknown as ClientFullDetail;
const accessRecord = (status: ClientPortalAccess['status'] = 'aktiv') => ({ id: 'access-a', clientId: 'client-a', tenantId: 'tenant-a', portalUsername: 'test.person', portalEnabled: true, status, updatedAt: '2026-10-14T12:00:00Z' }) as ClientPortalAccess;
const setupReceipt = () => ({ ok: true, data: { access: accessRecord(), credentials: { username: 'test.person', accessCode: '927341' } } });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
function button(text: string) { const found = [...host.querySelectorAll('button')].find((item) => item.textContent?.includes(text)); if (!found) throw new Error(`Button fehlt: ${text}`); return found; }
const click = async (text: string) => { await act(async () => button(text).click()); };
const accessPanel = async (id = 'client-a', readOnly = false) => { await act(async () => root.render(<ClientPortalAccessPanel client={client(id)} tenantId={f.tenant} isReadOnly={readOnly} />)); };
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); f.readOnly = false; f.tenant = 'tenant-a'; f.queryError = null;
  f.modules.mockResolvedValue({ ok: true, data: [{ moduleKey: 'assist' }] });
  f.saveModules.mockResolvedValue({ ok: true, data: { saved: ['assist', 'pflege'] } });
  f.access.mockResolvedValue({ ok: true, data: [] });
  f.setup.mockResolvedValue({ ok: false, error: 'Einrichtung verweigert' });
  f.regenerate.mockResolvedValue({ ok: false, error: 'Code konnte nicht bestätigt werden' });
  f.copy.mockResolvedValue(false); f.settingsSave.mockResolvedValue({ ok: true, data: {} }); f.refresh.mockResolvedValue(true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('Client portal web access interactions', () => {
  it('reloads failed assignments and blocks editing until the persisted state is known', async () => {
    f.modules.mockResolvedValueOnce({ ok: false, error: 'Abruf fehlgeschlagen' });
    await accessPanel(); expect(button('Ambulante Pflege').disabled).toBe(true);
    await click('Erneut laden'); expect(f.modules).toHaveBeenCalledTimes(2);
    expect(button('Ambulante Pflege').disabled).toBe(false);
  });
  it('serializes rapid assignment edits and shows success only after persistence', async () => {
    const pending = deferred<unknown>(); f.saveModules.mockReturnValue(pending.promise); await accessPanel();
    await act(async () => { button('Ambulante Pflege').click(); button('Stationäre Versorgung').click(); });
    expect(f.saveModules).toHaveBeenCalledOnce(); expect(host.textContent).not.toContain('Betreuungsbereiche gespeichert.');
    expect(button('Stationäre Versorgung').disabled).toBe(true);
    await act(async () => pending.resolve({ ok: true, data: { saved: ['assist', 'pflege'] } }));
    expect(button('Ambulante Pflege').getAttribute('aria-pressed')).toBe('true'); expect(host.textContent).toContain('Betreuungsbereiche gespeichert.');
  });
  it('requires a fresh read after a failed replacement, because the service may have partially persisted', async () => {
    f.saveModules.mockResolvedValue({ ok: false, error: 'Zuordnung fehlgeschlagen' }); await accessPanel(); await click('Ambulante Pflege');
    expect(host.querySelector('[role=alert]')?.textContent).toContain('gespeicherten Stand erneut'); expect(button('Stationäre Versorgung').disabled).toBe(true);
    f.modules.mockResolvedValue({ ok: true, data: [{ moduleKey: 'pflege' }] }); await click('Erneut laden');
    expect(button('Ambulante Pflege').getAttribute('aria-pressed')).toBe('true'); expect(button('Alltagsbegleitung').getAttribute('aria-pressed')).toBe('false');
  });
  it('does not expose late credentials from the previous client', async () => {
    const pending = deferred<unknown>(); f.setup.mockReturnValue(pending.promise); await accessPanel(); await click('Zugang einrichten');
    await accessPanel('client-b'); await act(async () => pending.resolve({ ok: true, data: { access: { portalUsername: 'previous-person', status: 'aktiv', portalEnabled: true }, credentials: { username: 'previous-person', accessCode: '123456' } } }));
    expect(host.textContent).not.toContain('previous-person'); expect(host.textContent).not.toContain('123456'); expect(f.access).not.toHaveBeenCalled();
  });
  it('hides write actions and disables assignment cards for read-only access', async () => {
    await accessPanel('client-a', true); expect(host.textContent).not.toContain('Zugang einrichten'); expect(button('Ambulante Pflege').disabled).toBe(true);
  });
  it('announces clipboard failures as errors instead of successful copies', async () => {
    await act(async () => root.render(<ClientPortalAccessPanel tenantId={f.tenant} client={{ ...client(), portalAccess: [{ portalEnabled: true, status: 'aktiv', portalUsername: 'test.person' }] } as ClientFullDetail} />));
    await click('Benutzername kopieren'); expect(host.querySelector('[role=alert]')?.textContent).toContain('Kopieren fehlgeschlagen');
  });
  it('accepts refreshed server access status without discarding a confirmed one-time code on ordinary refresh', async () => {
    f.setup.mockResolvedValue(setupReceipt()); f.access.mockResolvedValue({ ok: true, data: [accessRecord()] });
    await accessPanel(); await click('Zugang einrichten'); expect(host.textContent).toContain('927341');
    await act(async () => root.render(<ClientPortalAccessPanel tenantId={f.tenant} client={{ ...client(), portalAccess: [accessRecord()] }} />));
    expect(host.textContent).toContain('927341'); expect(host.textContent).toContain('Eingegangene Dateien und Anliegen');
    await act(async () => root.render(<ClientPortalAccessPanel tenantId={f.tenant} client={{ ...client(), portalAccess: [accessRecord('gesperrt')] }} />));
    expect(host.textContent).toContain('Gesperrt'); expect(host.textContent).not.toContain('Eingegangene Dateien und Anliegen');
  });
  it('does not overwrite newer blocked server props with a late access refresh', async () => {
    const refresh = deferred<unknown>(); f.setup.mockResolvedValue(setupReceipt()); f.access.mockReturnValue(refresh.promise);
    await accessPanel(); await click('Zugang einrichten');
    await act(async () => root.render(<ClientPortalAccessPanel tenantId={f.tenant} client={{ ...client(), portalAccess: [accessRecord('gesperrt')] }} />));
    await act(async () => refresh.resolve({ ok: true, data: [accessRecord()] }));
    expect(host.textContent).toContain('Gesperrt'); expect(host.textContent).not.toContain('Eingegangene Dateien und Anliegen');
  });
  it('removes the previous code as soon as rotation starts and keeps it unavailable after an unconfirmed write', async () => {
    const rotation = deferred<unknown>(); f.setup.mockResolvedValue(setupReceipt()); f.access.mockResolvedValue({ ok: true, data: [accessRecord()] }); f.regenerate.mockReturnValue(rotation.promise);
    await accessPanel(); await click('Zugang einrichten'); const oldCopyButton = button('Code kopieren');
    await act(async () => { button('Neuen Code erstellen').click(); oldCopyButton.click(); });
    expect(host.textContent).not.toContain('927341'); expect(f.copy).not.toHaveBeenCalled();
    await act(async () => rotation.resolve({ ok: false, error: 'Code konnte nicht bestätigt werden' }));
    expect(host.textContent).not.toContain('927341'); expect([...host.querySelectorAll('button')].some((item) => item.textContent === 'Code kopieren')).toBe(false);
    expect(host.querySelector('[role=alert]')?.textContent).toContain('Code konnte nicht bestätigt werden');
  });
  it('keeps the old code hidden when rotation throws before returning a confirmed receipt', async () => {
    f.setup.mockResolvedValue(setupReceipt()); f.access.mockResolvedValue({ ok: true, data: [accessRecord()] }); f.regenerate.mockRejectedValue(new Error('transport interrupted'));
    await accessPanel(); await click('Zugang einrichten'); await click('Neuen Code erstellen');
    expect(host.textContent).not.toContain('927341'); expect(host.querySelector('[role=alert]')?.textContent).toContain('nicht vollständig bestätigt');
  });
});

describe('Client portal web content permissions', () => {
  it('preserves the existing patch semantics and locks all switches during a write', async () => {
    const pending = deferred<unknown>(); f.settingsSave.mockReturnValue(pending.promise);
    await act(async () => root.render(<ClientPortalCorePanel clientId="client-a" />));
    await act(async () => { (host.querySelector('[aria-label="Nachrichten"]') as HTMLInputElement).click(); (host.querySelector('[aria-label="Dokumente"]') as HTMLInputElement).click(); });
    expect(f.settingsSave).toHaveBeenCalledOnce(); expect(f.settingsSave).toHaveBeenCalledWith('tenant-a', 'client-a', { inheritTenantDefaults: false, showMessages: false });
    expect([...host.querySelectorAll<HTMLInputElement>('[role=switch]')].every((item) => item.disabled)).toBe(true);
    await act(async () => pending.resolve({ ok: false, error: 'Speichern verweigert' })); expect(host.querySelector('[role=alert]')?.textContent).toContain('Speichern verweigert');
  });
  it('does not claim a refreshed state when the write succeeded but verification failed', async () => {
    f.refresh.mockResolvedValue(false); await act(async () => root.render(<ClientPortalCorePanel clientId="client-a" />));
    await act(async () => (host.querySelector('[aria-label="Nachrichten"]') as HTMLInputElement).click());
    expect(host.querySelector('[role=alert]')?.textContent).toContain('Änderung wurde gespeichert'); expect(host.textContent).not.toContain('Nachrichten gespeichert.');
  });
  it('does not display credential controls for a stale full-client result', async () => {
    await act(async () => root.render(<ClientPortalCorePanel clientId="client-b" fullClient={client('client-a')} />));
    expect(host.textContent).toContain('Zugangsdaten noch nicht verfügbar'); expect(host.textContent).not.toContain('Zugang einrichten');
  });
});

it('describes proof release precisely without claiming that the client portal itself is enabled', async () => {
  const { PortalSyncChainPanel } = await vi.importActual<typeof import('@/components/office/PortalSyncChainPanel.web')>('@/components/office/PortalSyncChainPanel.web');
  await act(async () => root.render(<PortalSyncChainPanel rows={[{ visitId: 'visit-a', portalVisible: true, officeReleaseStatus: 'released' }, { visitId: 'visit-b', portalVisible: false }]} />));
  expect(host.textContent).toContain('Nachweis zur Portalansicht freigegeben');
  expect(host.textContent).toContain('Nachweis noch nicht zur Portalansicht freigegeben');
  expect(host.textContent).not.toContain('Im Klientenportal sichtbar');
});
