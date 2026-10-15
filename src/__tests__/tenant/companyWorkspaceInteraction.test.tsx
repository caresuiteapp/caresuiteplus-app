// @vitest-environment happy-dom
import { act, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompanyWorkspace } from '@/liquid-command/screens/CompanyWorkspace.web';
import type { PermissionKey, RoleKey, ServiceResult } from '@/types';
import type { CompanyTab } from '@/lib/tenant/companyWorkspaceModel.web';
import {
  DEFAULT_TENANT_MODULES, EMPTY_TENANT_BRANDING, EMPTY_TENANT_COMPANY, EMPTY_TENANT_LEGAL,
  EMPTY_TENANT_PAYMENT, EMPTY_TENANT_REGISTER, EMPTY_TENANT_TAX,
  type TenantCenterSnapshot, type TenantCenterSectionKey,
} from '@/types/tenant/tenantCenter';

const h = vi.hoisted(() => ({ fetch: vi.fn(), push: vi.fn(), setParams: vi.fn(), copy: vi.fn(), manage: true, inventory: true, documents: true, assist: true, allowInventoryLeave: true, allowStructureLeave: true, allowResourcesLeave: true, scopeLimited: false, canManageScopes: true, accessLoading: false, accessError: null as string | null, refreshAccess: vi.fn(), params: {} as Record<string, string> }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: h.push, setParams: h.setParams }), useLocalSearchParams: () => h.params }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({
  can: (permission: string) => permission === 'business.tenant.manage' ? h.manage : permission === 'inventory.view' ? h.inventory : h.documents,
  hasModuleGate: () => h.assist,
}) }));
vi.mock('@/hooks/useCompanyAccess.web', () => ({ useCompanyAccess: () => ({
  data: h.accessError ? null : { permissions: [h.manage && 'business.tenant.manage', h.inventory && 'inventory.view', h.documents && 'office.documents.view'].filter(Boolean) as PermissionKey[], scopeLimited: h.scopeLimited, canManageScopes: h.canManageScopes },
  loading: h.accessLoading, error: h.accessError, refresh: h.refreshAccess,
}) }));
vi.mock('@/components/company/CompanyOrganizationWorkspace.web', () => ({
  CompanyOrganizationWorkspace: ({ tenantId, initialView, scopeLimited, canManageScopes, onViewChange, onNavigationGuardChange }: { tenantId: string; initialView?: string; scopeLimited?: boolean; canManageScopes?: boolean; onViewChange?: (view: string) => void; onNavigationGuardChange?: (guard: (() => Promise<boolean>) | null) => void }) => {
    useEffect(() => { onNavigationGuardChange?.(() => Promise.resolve(h.allowStructureLeave)); return () => onNavigationGuardChange?.(null); }, [onNavigationGuardChange]);
    return <section data-testid="structure-content"><span>{tenantId}:{initialView}:{scopeLimited ? 'limited' : 'full'}:{canManageScopes ? 'scopes' : 'no-scopes'}</span><input aria-label="Strukturentwurf" defaultValue="" /><button type="button" onClick={() => onViewChange?.('departments')}>Abteilungen anzeigen</button></section>;
  },
}));
vi.mock('@/components/company/CompanyResourcesWorkspace.web', () => ({
  CompanyResourcesWorkspace: ({ tenantId, initialView, scopeLimited, initialItemId, onViewChange, onNavigationGuardChange }: { tenantId: string; initialView?: string; scopeLimited?: boolean; initialItemId?: string; onViewChange?: (view: string) => void; onNavigationGuardChange?: (guard: (() => Promise<boolean>) | null) => void }) => {
    useEffect(() => { onNavigationGuardChange?.(() => Promise.resolve(h.allowResourcesLeave)); return () => onNavigationGuardChange?.(null); }, [onNavigationGuardChange]);
    return <section data-testid="resources-content"><span>{tenantId}:{initialView}:{scopeLimited ? 'limited' : 'full'}:{initialItemId ?? ''}</span><input aria-label="Ressourcenentwurf" defaultValue="" /><button type="button" onClick={() => onViewChange?.('insurance')}>Versicherungen anzeigen</button></section>;
  },
}));
vi.mock('@/components/company/CompanyScopeAccessPanel.web', () => ({ CompanyScopeAccessPanel: () => <section data-testid="scope-access-panel" /> }));
vi.mock('@/components/company/CompanyCostCentersPanel.web', () => ({ CompanyCostCentersPanel: () => <section data-testid="cost-centers-panel" /> }));
vi.mock('@/components/company/CompanyCustomValuesPanel.web', () => ({ CompanyCustomValuesPanel: () => <section data-testid="custom-values-panel" /> }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ DEFAULT_LIVE_POLL_MS: 60_000, useLiveRefresh: () => ({ isLiveConnected: false }) }));
vi.mock('@/lib/tenant/tenantCenterService', () => ({ fetchTenantCenter: (...args: unknown[]) => h.fetch(...args) }));
vi.mock('@/liquid-command/components/LiquidPrimitives', () => ({
  LiquidState: ({ title, message, actionLabel, onAction }: { title: string; message: string; actionLabel?: string; onAction?: () => void }) =>
    <section><h2>{title}</h2><p>{message}</p>{actionLabel ? <button onClick={onAction}>{actionLabel}</button> : null}</section>,
}));
vi.mock('@/components/tenant/TenantCenterSectionModals.web', () => ({
  TenantCenterSectionModals: ({ activeSection, tenantId, onClose }: { activeSection: TenantCenterSectionKey; tenantId: string; onClose: () => void }) =>
    <section role="dialog" aria-label={activeSection}><span>{tenantId}</span><input aria-label="Entwurf" defaultValue="" /><button onClick={onClose}>Editor schließen</button></section>,
}));
vi.mock('@/components/tenant/TenantServiceCatalogModal.web', () => ({
  TenantServiceCatalogModal: ({ initialCategory }: { initialCategory: string }) => <section role="dialog" aria-label="Katalog">{initialCategory}</section>,
}));
vi.mock('@/components/tenant/TenantCustomFieldWizardModal.web', () => ({
  TenantCustomFieldWizardModal: () => <section role="dialog" aria-label="Eigene Angabe" />,
}));
vi.mock('@/components/company/CompanyInventoryWorkspace.web', () => ({
  CompanyInventoryWorkspace: ({ tenantId, initialView, onNavigationGuardChange }: {
    tenantId: string;
    initialView?: string;
    onNavigationGuardChange?: (guard: (() => Promise<boolean>) | null) => void;
  }) => {
    useEffect(() => {
      onNavigationGuardChange?.(() => Promise.resolve(h.allowInventoryLeave));
      return () => onNavigationGuardChange?.(null);
    }, [onNavigationGuardChange]);
    return <section data-testid="inventory-content"><span>{tenantId}:{initialView}</span><input aria-label="Inventarentwurf" defaultValue="" /></section>;
  },
}));
// Tabs are local here; the production query hook and company view remain real.
vi.mock('@/hooks/usePageTab', () => ({ usePageTab: (_key: string, initial: string) => useState(initial) }));

function fixture(tenantId = 'tenant-one', name = 'Beispiel GmbH'): TenantCenterSnapshot {
  return {
    tenantId, updatedAt: '2026-10-15T05:00:00Z',
    company: { ...EMPTY_TENANT_COMPANY, name, legalForm: 'GmbH', street: 'Hauptstraße', houseNumber: '12', zip: '10115', city: 'Berlin', email: 'info@example.test', phone: '+49 (30) 123-456', website: 'example.test' },
    legal: { ...EMPTY_TENANT_LEGAL }, tax: { ...EMPTY_TENANT_TAX, taxOffice: 'Finanzamt Seestadt' }, register: { ...EMPTY_TENANT_REGISTER },
    contact: { billingEmail: 'rechnung@example.test', supportEmail: '', supportPhone: '', contactPersons: [] },
    representatives: [], bankAccounts: [{ id: 'bank-one', label: 'Geschäftskonto', accountHolder: name, bankName: 'Beispielbank', iban: 'DE89370400440532013000', bic: '', isPrimary: true, sortOrder: 0 }],
    payment: { ...EMPTY_TENANT_PAYMENT, paymentTermsDays: '0' }, branding: { ...EMPTY_TENANT_BRANDING },
    modules: { ...DEFAULT_TENANT_MODULES }, catalogSummary: '', catalogItems: [], customFields: [], auditLogs: [], sections: [], assistDefaultHourlyRate: '',
  };
}

let host: HTMLDivElement;
let root: Root;
let snapshot: TenantCenterSnapshot;
let tenantId: string;
let roleKey: RoleKey;
let initialTab: CompanyTab;
let initialView: string | undefined;
const render = async () => { await act(async () => root.render(<CompanyWorkspace tenantId={tenantId} roleKey={roleKey} initialTab={initialTab} initialView={initialView} />)); };
const button = (text: string) => Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(node => node.textContent?.trim() === text)!;
const click = async (node: HTMLElement) => { expect(node).toBeTruthy(); await act(async () => node.click()); };
const search = async (value: string) => {
  await act(async () => {
    const input = host.querySelector<HTMLInputElement>('input[type="search"]')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); h.manage = true; h.inventory = true; h.documents = true; h.assist = true;
  h.allowInventoryLeave = true; h.allowStructureLeave = true; h.allowResourcesLeave = true; h.scopeLimited = false; h.canManageScopes = true; h.accessLoading = false; h.accessError = null; h.params = {}; initialTab = 'overview'; initialView = undefined;
  snapshot = fixture(); tenantId = snapshot.tenantId; roleKey = 'business_admin';
  h.fetch.mockImplementation(async () => ({ ok: true, data: snapshot }));
  h.copy.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: h.copy } });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('company workspace Web interactions', () => {
  it('searches saved values across tabs, opens the matching editor, and clears search when navigating', async () => {
    await render(); await search('  SEESTADT  ');
    expect(host.querySelectorAll('[data-testid^="company-section-"]')).toHaveLength(1);
    expect(host.querySelector('[data-testid="company-section-tax"]')).not.toBeNull();
    await click(button('Steuerdaten bearbeiten'));
    expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('tax');
    await click(button('Editor schließen')); await click(button('Unternehmensprofil'));
    expect(host.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe('');
    expect(host.querySelector('[data-testid="company-section-company"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="company-section-tax"]')).toBeNull();
  });

  it('shows a useful empty search state and restores the current view after reset', async () => {
    await render(); await search('keinepassendenangaben');
    expect(host.textContent).toContain('Kein passender Bereich gefunden');
    expect(host.querySelectorAll('[data-testid^="company-section-"]')).toHaveLength(0);
    await click(button('Suche zurücksetzen'));
    expect(host.textContent).toContain('Ihr Unternehmen im Überblick');
  });

  it('links genuine contact details and copies the saved company identity', async () => {
    await render();
    expect(host.querySelector('a[href^="mailto:"]')?.getAttribute('href')).toBe('mailto:info%40example.test');
    expect(host.querySelector('a[href^="tel:"]')?.getAttribute('href')).toBe('tel:+4930123456');
    const website = host.querySelector<HTMLAnchorElement>('a[target="_blank"]')!;
    expect(website.href).toBe('https://example.test/'); expect(website.rel).toContain('noopener');
    await click(button('Kontaktdaten kopieren'));
    expect(h.copy).toHaveBeenCalledWith(expect.stringContaining('Hauptstraße 12 · 10115 Berlin'));
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Kontaktdaten kopiert.');
  });

  it('does not turn an unsafe website into a link and handles clipboard rejection visibly', async () => {
    snapshot.company.website = 'javascript:alert(1)'; h.copy.mockRejectedValue(new Error('blocked'));
    await render(); expect(host.querySelector('a[target="_blank"]')).toBeNull();
    await click(button('Kontaktdaten kopieren'));
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Kopieren ist in diesem Browser nicht möglich');
  });

  it('masks bank account numbers and keeps a zero-day deadline visible', async () => {
    await render(); await click(button('Abrechnung öffnen'));
    const bank = host.querySelector('[data-testid="company-section-bank"]')!;
    expect(bank.textContent).toContain('DE •••• •••• 3000');
    expect(host.textContent).not.toContain(snapshot.bankAccounts[0].iban);
    expect(host.querySelector('[data-testid="company-section-payment"]')?.textContent).toContain('0 Tage');
  });

  it('opens real budget and service-type routes and passes the travel category to the catalog', async () => {
    await render(); await click(button('Abrechnung öffnen'));
    await click(button('Leistungsarten öffnen')); expect(h.push).toHaveBeenLastCalledWith('/settings/tenant/client-service-types');
    await click(button('Budgetvorlagen öffnen')); expect(h.push).toHaveBeenLastCalledWith('/settings/tenant/client-budget');
    await click(button('Fahrtkosten öffnen'));
    expect(host.querySelector('[role="dialog"][aria-label="Katalog"]')?.textContent).toBe('travel');
  });

  it('preserves loaded data on refresh failure and recovers through the retry action', async () => {
    await render(); h.fetch.mockResolvedValueOnce({ ok: false, error: 'Leseberechtigung abgelehnt.' });
    await click(host.querySelector<HTMLButtonElement>('[aria-label="Unternehmensdaten aktualisieren"]')!);
    expect(host.querySelector('h1')?.textContent).toBe('Beispiel GmbH');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Die zuletzt geladenen Angaben bleiben sichtbar');
    const fresh = fixture('tenant-one', 'Aktualisierte Firma'); h.fetch.mockResolvedValueOnce({ ok: true, data: fresh });
    await click(button('Erneut versuchen'));
    expect(host.querySelector('h1')?.textContent).toBe('Aktualisierte Firma');
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it('does not fetch or show company data without management permission', async () => {
    h.manage = false; await render();
    expect(h.fetch).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Unternehmensdaten sind geschützt');
    expect(host.querySelector('h1')).toBeNull(); expect(button('Stammdaten bearbeiten')).toBeUndefined();
  });

  it('removes a previous company and its open draft immediately when switching tenant', async () => {
    await render(); await click(button('Stammdaten bearbeiten'));
    const draft = host.querySelector<HTMLInputElement>('[aria-label="Entwurf"]')!; draft.value = 'Alter Entwurf';
    let finish: (value: ServiceResult<TenantCenterSnapshot>) => void = () => {};
    h.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    tenantId = 'tenant-two'; await render();
    expect(host.querySelector('[role="dialog"]')).toBeNull(); expect(host.textContent).not.toContain('Beispiel GmbH');
    expect(host.textContent).toContain('Unternehmensakte wird geladen');
    await act(async () => finish({ ok: true, data: fixture('tenant-two', 'Zweites Unternehmen') }));
    expect(host.querySelector('h1')?.textContent).toBe('Zweites Unternehmen');
    await click(button('Stammdaten bearbeiten'));
    expect(host.querySelector<HTMLInputElement>('[aria-label="Entwurf"]')?.value).toBe('');
  });

  it('clears an open editor and visible data when management permission is withdrawn', async () => {
    await render(); await click(button('Stammdaten bearbeiten'));
    h.manage = false; await render();
    expect(host.querySelector('[role="dialog"]')).toBeNull(); expect(host.textContent).not.toContain('Beispiel GmbH');
    expect(host.textContent).toContain('Unternehmensdaten sind geschützt');
    expect(h.fetch).toHaveBeenCalledTimes(1);
  });

  it('ignores a late response from the previous tenant', async () => {
    let finishOld: (value: ServiceResult<TenantCenterSnapshot>) => void = () => {};
    h.fetch.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
    await render(); tenantId = 'tenant-two';
    h.fetch.mockResolvedValueOnce({ ok: true, data: fixture('tenant-two', 'Aktueller Mandant') });
    await render(); expect(host.querySelector('h1')?.textContent).toBe('Aktueller Mandant');
    await act(async () => finishOld({ ok: true, data: fixture('tenant-one', 'Veraltete Antwort') }));
    expect(host.querySelector('h1')?.textContent).toBe('Aktueller Mandant');
    expect(host.textContent).not.toContain('Veraltete Antwort');
  });

  it('keeps document navigation behind its own permission', async () => {
    h.documents = false; await render(); expect(host.querySelector('.co-documents')).toBeNull();
    h.documents = true; await render(); await click(host.querySelector<HTMLButtonElement>('.co-documents')!);
    expect(h.push).toHaveBeenLastCalledWith('/business/office/document-catalog');
  });

  it('opens inventory in its canonical company route and hides the tab without its own permission', async () => {
    await render(); await click(button('Inventar'));
    expect(h.push).toHaveBeenLastCalledWith('/unternehmen/inventar');
    h.inventory = false; await render();
    expect(button('Inventar')).toBeUndefined();
  });

  it('loads inventory without fetching protected company settings for inventory-only users', async () => {
    initialTab = 'inventory'; h.manage = false; h.params = { ansicht: 'assignments' };
    await render();
    expect(h.fetch).not.toHaveBeenCalled();
    expect(host.querySelector('[data-testid="inventory-content"]')?.textContent).toBe('tenant-one:assignments');
    expect(button('Stammdaten bearbeiten')).toBeUndefined();
    expect(host.textContent).not.toContain('Beispiel GmbH');
  });

  it('blocks the inventory route independently of company-management rights', async () => {
    initialTab = 'inventory'; h.inventory = false;
    await render();
    expect(host.querySelector('[data-testid="inventory-content"]')).toBeNull();
    expect(host.textContent).toContain('Inventar ist geschützt');
  });

  it('respects the inventory draft guard when switching back to company sections', async () => {
    initialTab = 'inventory'; h.allowInventoryLeave = false;
    await render(); await click(button('Unternehmensprofil'));
    expect(h.push).not.toHaveBeenCalled();
    h.allowInventoryLeave = true; await click(button('Unternehmensprofil'));
    expect(h.push).toHaveBeenLastCalledWith('/unternehmen?csPage_CompanyWorkspace_view=identity');
  });

  it('loads inventory independently of a slow company-profile query and keeps its draft on parent updates', async () => {
    initialTab = 'inventory'; h.fetch.mockImplementation(() => new Promise(() => {}));
    await render();
    expect(h.fetch).not.toHaveBeenCalled();
    const draft = host.querySelector<HTMLInputElement>('[aria-label="Inventarentwurf"]')!;
    expect(draft).not.toBeNull(); draft.value = 'Ungespeicherter Lagerort';
    await render();
    expect(host.querySelector('[aria-label="Inventarentwurf"]')).toBe(draft);
    expect(draft.value).toBe('Ungespeicherter Lagerort');
  });
  it('waits for authoritative access before loading company data and exposes retry on failure', async () => {
    h.accessLoading = true; await render(); expect(h.fetch).not.toHaveBeenCalled(); expect(host.textContent).toContain('Unternehmenszugriff wird geprüft');
    h.accessLoading = false; h.accessError = 'Rechte nicht verfügbar.'; await render(); expect(h.fetch).not.toHaveBeenCalled(); expect(host.textContent).toContain('Rechte nicht verfügbar.');
    await click(button('Erneut versuchen')); expect(h.refreshAccess).toHaveBeenCalledTimes(1);
  });

  it('opens structural and resource routes without loading unrelated corporate profile data', async () => {
    initialTab = 'structure'; initialView = 'departments'; await render();
    expect(h.fetch).not.toHaveBeenCalled(); expect(host.querySelector('[data-testid="structure-content"]')?.textContent).toContain('tenant-one:departments:full:scopes');
    await click(button('Abteilungen anzeigen')); expect(h.setParams).toHaveBeenCalledWith({ ansicht: 'departments' });
    initialTab = 'resources'; initialView = 'fleet'; h.params = { itemId: 'vehicle-one' }; await render();
    expect(h.fetch).not.toHaveBeenCalled(); expect(host.querySelector('[data-testid="resources-content"]')?.textContent).toContain('tenant-one:fleet:full:vehicle-one');
    await click(button('Versicherungen anzeigen')); expect(h.setParams).toHaveBeenCalledWith({ ansicht: 'insurance' });
  });

  it('limits scoped staff to operational areas and never fetches global company settings', async () => {
    h.scopeLimited = true; h.canManageScopes = false; await render();
    expect(h.fetch).not.toHaveBeenCalled(); expect(host.querySelector('[data-testid="structure-content"]')?.textContent).toContain('tenant-one:sites:limited:no-scopes');
    expect(button('Unternehmensprofil')).toBeUndefined(); expect(button('Zur Unternehmensakte')).toBeUndefined();
    expect(host.textContent).not.toContain('Beispiel GmbH');
    await click(button('Inventar')); expect(h.push).toHaveBeenLastCalledWith('/unternehmen/inventar');
  });

  it('checks structure and resource guards before opening another workspace', async () => {
    initialTab = 'structure'; h.allowStructureLeave = false; await render(); await click(button('Inventar')); expect(h.push).not.toHaveBeenCalled();
    h.allowStructureLeave = true; await click(button('Inventar')); expect(h.push).toHaveBeenLastCalledWith('/unternehmen/inventar');
    h.push.mockClear(); initialTab = 'resources'; h.allowResourcesLeave = false; await render(); await click(button('Unternehmensprofil')); expect(h.push).not.toHaveBeenCalled();
    h.allowResourcesLeave = true; await click(button('Unternehmensprofil')); expect(h.push).toHaveBeenLastCalledWith('/unternehmen?csPage_CompanyWorkspace_view=identity');
  });

  it('remounts operational drafts when authoritative scopes change', async () => {
    initialTab = 'structure'; await render(); const oldDraft = host.querySelector<HTMLInputElement>('[aria-label="Strukturentwurf"]')!; oldDraft.value = 'Nicht übernehmen';
    h.scopeLimited = true; h.canManageScopes = false; await render(); const newDraft = host.querySelector<HTMLInputElement>('[aria-label="Strukturentwurf"]')!;
    expect(newDraft).not.toBe(oldDraft); expect(newDraft.value).toBe(''); expect(h.fetch).not.toHaveBeenCalled();
  });

});
