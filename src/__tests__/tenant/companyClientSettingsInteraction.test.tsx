// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ServiceScreen from '../../../app/settings/tenant/client-service-types.web';
import BudgetScreen from '../../../app/settings/tenant/client-budget.web';
import type { CompanyBudgetSettings, CompanyServiceSettings } from '@/lib/tenant/companyClientSettings.web';
const h = vi.hoisted(() => ({ tenant: 'tenant-a', allowed: true, data: null as CompanyServiceSettings | CompanyBudgetSettings | null, saveRate: vi.fn(), saveType: vi.fn(), saveBudget: vi.fn(), fetch: vi.fn(), refresh: vi.fn(), error: null as string | null }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => h.tenant }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ roleKey: 'business_admin', can: () => h.allowed }) }));
vi.mock('@/hooks/useFlowRouter', () => ({ useFlowRouter: () => ({ back: vi.fn() }) }));
vi.mock('@/hooks/usePageTab', async () => { const React = await import('react'); return { usePageTab: (_: string, initial: string) => React.useState(initial) }; });
vi.mock('@/hooks/core/useAsyncQuery', async () => {
  const React = await import('react');
  return { useAsyncQuery: (fetcher: () => unknown) => {
    const [data, setData] = React.useState(h.data);
    const initialFetch = React.useRef(fetcher);
    React.useEffect(() => { initialFetch.current(); }, []);
    return { data, setData, error: h.error, refreshError: null, loading: false, refreshing: false, refresh: h.refresh };
  } };
});
vi.mock('@/liquid-command/shell/LiquidCommandShell', () => ({ LiquidCommandShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('@/components/layout/platform/platformmodal', () => ({ PlatformModal: ({ title, children, footerContent, onClose }: { title: string; children: ReactNode; footerContent: ReactNode; onClose: () => void }) => <section role="dialog" aria-label={title}><button onClick={onClose}>Fenster schließen</button>{children}{footerContent}</section> }));
vi.mock('@/lib/tenant/companyClientSettings', async original => ({ ...await original<typeof import('@/lib/tenant/companyClientSettings.web')>(),
  fetchCompanyServiceSettings: (...args: unknown[]) => h.fetch(...args), fetchCompanyBudgetSettings: (...args: unknown[]) => h.fetch(...args),
  saveCompanyBillingRate: (...args: unknown[]) => h.saveRate(...args), saveCompanyServiceType: (...args: unknown[]) => h.saveType(...args), saveCompanyBudgetDefault: (...args: unknown[]) => h.saveBudget(...args),
}));
let host: HTMLDivElement; let root: Root;
const render = async (budget = false) => { await act(async () => root.render(budget ? <BudgetScreen /> : <ServiceScreen />)); };
const button = (title: string, container: ParentNode = host) => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(node => node.textContent === title)!;
const click = async (element: HTMLElement) => { await act(async () => element.click()); };
const input = (label: string) => { const element = Array.from(host.querySelectorAll('label')).find(node => node.textContent === label)!; return document.getElementById(element.htmlFor) as HTMLInputElement; };
const change = async (element: HTMLInputElement | HTMLSelectElement, value: string) => { await act(async () => { const proto = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(element, value); element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); }); };
function serviceData(): CompanyServiceSettings { return {
  types: [{ id: 'type-a', name: 'Alltagsbegleitung', key: 'alltagsbegleitung', description: '', active: true }, { id: 'type-b', name: 'Betreuung', key: 'betreuung', description: '', active: true }],
  rules: [{ id: 'rule-a', serviceTypeId: 'type-a', rate: 32, unit: 'hour', signature: true, approval: false, budget: true, active: true }, { id: 'rule-b', serviceTypeId: 'type-b', rate: 45, unit: 'visit', signature: true, approval: true, budget: false, active: true }],
}; }
function budgetData(): CompanyBudgetSettings { return {
  years: [{ id: 'year-old', tenantId: 'tenant-a', budgetYear: 2027, label: null, isActive: true }],
  types: [{ id: 'budget-type', tenantId: 'tenant-a', budgetTypeKey: 'relief', name: 'Entlastung', description: null, period: 'yearly', currency: 'EUR', isActive: true, sortOrder: 0 }],
  defaults: [{ id: 'default-a', tenantId: 'tenant-a', budgetYearId: 'year-old', budgetTypeId: 'budget-type', amountCents: 12345, monthlyAmountCents: null, yearlyAmountCents: null, conversionRatePct: null, notes: null }],
}; }
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2028-03-05T12:00:00Z'));
  h.tenant = 'tenant-a'; h.allowed = true; h.error = null; h.data = serviceData(); h.fetch.mockResolvedValue({ ok: true, data: h.data });
  h.saveRate.mockResolvedValue({ ok: true, data: { ...serviceData().rules[1], rate: 51.25 } });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });

describe('company client settings web interaction', () => {
  it('edits only the selected price and never submits an unchanged or empty shared draft', async () => {
    await render(); const cards = host.querySelectorAll('article'); await click(button('Preis bearbeiten', cards[1]));
    expect(input('Preis je Einsatz in Euro').value).toBe('45'); expect(button('Änderungen speichern').disabled).toBe(true);
    await click(button('Änderungen speichern')); expect(h.saveRate).not.toHaveBeenCalled();
    await change(input('Preis je Einsatz in Euro'), '51,25'); await click(button('Änderungen speichern'));
    expect(h.saveRate).toHaveBeenCalledWith('tenant-a', 'business_admin', 'rule-b', '51,25');
    expect(cards[0].textContent).toContain('32,00'); expect(host.textContent).toContain('51,25'); expect(host.querySelector('[role=dialog]')).toBeNull();
  });
  it('retains a rejected price, prevents duplicate submission, and blocks close during saving', async () => {
    await render(); await click(button('Preis bearbeiten')); await change(input('Preis je Stunde in Euro'), '40');
    let resolve: (value: unknown) => void = () => {}; h.saveRate.mockImplementation(() => new Promise(done => { resolve = done; }));
    await act(async () => { button('Änderungen speichern').click(); button('Änderungen speichern').click(); });
    expect(h.saveRate).toHaveBeenCalledOnce(); await click(button('Fenster schließen')); expect(host.querySelector('[role=dialog]')).not.toBeNull();
    await act(async () => resolve({ ok: false, error: 'Speichern abgelehnt.' }));
    expect(host.textContent).toContain('Speichern abgelehnt.'); expect(input('Preis je Stunde in Euro').value).toBe('40'); expect(button('Änderungen speichern').disabled).toBe(false);
  });
  it('requires explicit discard and restores the stored price on reopening', async () => {
    await render(); await click(button('Preis bearbeiten')); await change(input('Preis je Stunde in Euro'), '40'); await click(button('Abbrechen'));
    expect(host.textContent).toContain('Ungespeicherte Änderungen verwerfen?'); await click(button('Änderungen verwerfen'));
    await click(button('Preis bearbeiten')); expect(input('Preis je Stunde in Euro').value).toBe('32'); expect(h.saveRate).not.toHaveBeenCalled();
  });
  it('uses the current year without inventing templates and allows the stored year to be selected', async () => {
    h.data = budgetData(); await render(true);
    expect((host.querySelector('#company-budget-year') as HTMLSelectElement).value).toBe('2028');
    expect(host.textContent).toContain('Für 2028 sind keine Budgetvorlagen hinterlegt.'); expect(host.querySelector('article')).toBeNull();
    await change(host.querySelector<HTMLSelectElement>('#company-budget-year')!, '2027');
    expect(host.textContent).toContain('Entlastung'); expect(host.textContent).toContain('123,45'); expect(h.saveBudget).not.toHaveBeenCalled();
  });
  it('preserves empty optional budget limits and saves the selected template by ID', async () => {
    const data = budgetData(); h.data = data; h.saveBudget.mockResolvedValue({ ok: true, data: { ...data.defaults[0], amountCents: 15000 } });
    await render(true); await change(host.querySelector<HTMLSelectElement>('#company-budget-year')!, '2027'); await click(button('Budgetvorlage bearbeiten'));
    expect(input('Monatlicher Betrag in Euro').value).toBe(''); expect(input('Jährlicher Betrag in Euro').value).toBe('');
    await change(input('Grundbetrag in Euro *'), '150'); await click(button('Änderungen speichern'));
    expect(h.saveBudget).toHaveBeenCalledWith('tenant-a', 'business_admin', 'default-a', { amount: '150', monthly: '', yearly: '', conversion: '', notes: '' });
    expect(host.textContent).toContain('Budgetvorlage gespeichert.');
  });
  it('does not load protected settings without the company management permission', async () => {
    h.allowed = false; await render(); expect(h.fetch).not.toHaveBeenCalled(); expect(host.querySelector('article')).toBeNull();
    expect(host.textContent).toContain('Verwaltungsberechtigung');
  });
  it('discards old in-flight editor results when changing tenants', async () => {
    await render(); await click(button('Preis bearbeiten')); await change(input('Preis je Stunde in Euro'), '99');
    let resolve: (value: unknown) => void = () => {}; h.saveRate.mockImplementation(() => new Promise(done => { resolve = done; }));
    await click(button('Änderungen speichern')); h.tenant = 'tenant-b'; await render();
    await act(async () => resolve({ ok: true, data: { ...serviceData().rules[0], rate: 99 } }));
    expect(host.textContent).not.toContain('Preis gespeichert.'); expect(host.textContent).toContain('32,00'); expect(host.querySelector('[role=dialog]')).toBeNull();
  });
});
