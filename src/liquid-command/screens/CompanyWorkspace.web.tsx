import { useCallback, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePageTab } from '@/hooks/usePageTab';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useCompanyAccess } from '@/hooks/useCompanyAccess.web';
import type { CompanyAccess } from '@/types/tenant/companyAccess';
import { CompanyOrganizationWorkspace, type CompanyOrganizationView } from '@/components/company/CompanyOrganizationWorkspace.web';
import { CompanyResourcesWorkspace, type CompanyResourcesView } from '@/components/company/CompanyResourcesWorkspace.web';
import { CompanyCostCentersPanel } from '@/components/company/CompanyCostCentersPanel.web';
import { CompanyCustomValuesPanel } from '@/components/company/CompanyCustomValuesPanel.web';
import { CompanyScopeAccessPanel } from '@/components/company/CompanyScopeAccessPanel.web';
import { fetchTenantCenter } from '@/lib/tenant/tenantCenterService';
import { TENANT_SETTINGS_PERMISSION } from '@/lib/tenant/tenantSettingsRoute';
import { COMPANY_TABS, type CompanyTab } from '@/lib/tenant/companyWorkspaceModel.web';
import { CompanyWorkspaceView } from '@/components/company/CompanyWorkspaceView.web';
import { CompanyInventoryWorkspace, type CompanyInventoryView } from '@/components/company/CompanyInventoryWorkspace.web';
import { companyWorkspaceCss } from '@/components/company/companyWorkspaceCss.web';
import { INVENTORY_VIEW } from '@/lib/inventory/inventoryPermissions';
import { TenantCenterSectionModals } from '@/components/tenant/TenantCenterSectionModals.web';
import { TenantServiceCatalogModal } from '@/components/tenant/TenantServiceCatalogModal.web';
import { TenantCustomFieldWizardModal } from '@/components/tenant/TenantCustomFieldWizardModal.web';
import type { RoleKey } from '@/types';
import type { ServiceCatalogCategory, TenantCenterSectionKey, TenantCenterSnapshot, TenantCustomFieldDefinition } from '@/types/tenant/tenantCenter';
import { LiquidState } from '../components/LiquidPrimitives';

const DIRECT_ROUTES: Partial<Record<TenantCenterSectionKey, string>> = {
  dataManagement: '/business/office/settings/csv-import-export',
  clientServiceTypes: '/settings/tenant/client-service-types',
  clientBudgetDefaults: '/settings/tenant/client-budget',
};

/** A tenant/role change remounts the entire editor scope, including every open draft. */
type CompanyWorkspaceProps = {
  tenantId: string;
  roleKey: RoleKey | null;
  initialTab?: CompanyTab;
  initialView?: string;
  actorProfileId?: string | null;
};

export function CompanyWorkspace(props: CompanyWorkspaceProps) {
  const access = useCompanyAccess(props.tenantId, props.actorProfileId, props.roleKey);
  if (access.loading) return <LiquidState kind="loading" title="Unternehmenszugriff wird geprüft" message="Ihre verfügbaren Bereiche werden geladen." />;
  if (!access.data) return <LiquidState kind="error" title="Unternehmenszugriff konnte nicht geprüft werden" message={access.error ?? 'Bitte erneut versuchen.'} actionLabel="Erneut versuchen" onAction={access.refresh} />;
  const fingerprint = `${access.data.permissions.join(',')}:${access.data.scopeLimited}:${access.data.canManageScopes}`;
  return <ScopedCompanyWorkspace key={`${props.tenantId}:${props.actorProfileId ?? ''}:${props.roleKey}:${props.initialTab ?? 'overview'}:${fingerprint}`} {...props} access={access.data} />;
}
function ScopedCompanyWorkspace({ tenantId, roleKey, initialTab = 'overview', initialView, actorProfileId, access }: CompanyWorkspaceProps & { access: CompanyAccess }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ ansicht?: string | string[]; employeeId?: string | string[]; itemId?: string | string[] }>();
  const modulePermissions = usePermissions();
  const canStructure = access.permissions.includes(TENANT_SETTINGS_PERMISSION);
  const canManage = canStructure && !access.scopeLimited;
  const canInventory = access.permissions.includes(INVENTORY_VIEW);
  const [rawTab, setTab] = usePageTab<CompanyTab>('CompanyWorkspace.view', 'overview');
  const requestedTab = initialTab !== 'overview' ? initialTab : COMPANY_TABS.some(item => item.id === rawTab) ? rawTab : 'overview';
  const tab = access.scopeLimited && !['structure', 'resources', 'inventory'].includes(requestedTab) ? (canStructure ? 'structure' : 'inventory') : requestedTab;
  const operational = ['inventory', 'structure', 'resources'].includes(tab);
  const childGuard = useRef<(() => Promise<boolean>) | null>(null);
  const accessGuard = useRef<(() => Promise<boolean>) | null>(null);
  const setChildGuard = useCallback((guard: (() => Promise<boolean>) | null) => { childGuard.current = guard; }, []);
  const setAccessGuard = useCallback((guard: (() => Promise<boolean>) | null) => { accessGuard.current = guard; }, []);
  const customValuesGuard = useRef<(() => Promise<boolean>) | null>(null);
  const costCentersGuard = useRef<(() => Promise<boolean>) | null>(null);
  const checkSettingsGuard = useCallback(async () => {
    for (const guard of [customValuesGuard.current, costCentersGuard.current]) if (guard && !(await guard())) return false;
    return true;
  }, []);
  const setCustomValuesGuard = useCallback((guard: (() => Promise<boolean>) | null) => { customValuesGuard.current = guard; childGuard.current = customValuesGuard.current || costCentersGuard.current ? checkSettingsGuard : null; }, [checkSettingsGuard]);
  const setCostCentersGuard = useCallback((guard: (() => Promise<boolean>) | null) => { costCentersGuard.current = guard; childGuard.current = customValuesGuard.current || costCentersGuard.current ? checkSettingsGuard : null; }, [checkSettingsGuard]);
  const checkAccessGuard = useCallback(async () => accessGuard.current ? accessGuard.current() : true, []);
  const [activeSection, setActiveSection] = useState<TenantCenterSectionKey | null>(null);
  const [catalog, setCatalog] = useState<ServiceCatalogCategory | null>(null);
  const [custom, setCustom] = useState<{ field: TenantCustomFieldDefinition | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<'success' | 'error'>('success');
  const query = useAsyncQuery(() => fetchTenantCenter(tenantId, roleKey), [tenantId, roleKey], {
    enabled: Boolean(tenantId && canManage && !operational), queryKey: `company:${tenantId}:${actorProfileId ?? ''}:${roleKey}:${canManage}:${operational}`,
  });
  const selectTab = async (next: CompanyTab) => {
    if (next === tab || childGuard.current && !(await childGuard.current())) return;
    if (next === 'inventory') { if (canInventory) router.push('/unternehmen/inventar' as never); return; }
    if (next === 'structure' || next === 'resources') {
      if (canStructure) router.push((next === 'structure' ? '/unternehmen/standorte' : '/unternehmen/ressourcen') as never);
      return;
    }
    if (!canManage) return;
    if (initialTab !== 'overview') { router.push(`/unternehmen?csPage_CompanyWorkspace_view=${next}` as never); return; }
    setTab(next);
  };
  const requestedView = typeof params.ansicht === 'string' ? params.ansicht : initialView;
  const inventoryView = requestedView && ['stock', 'assignments', 'locations', 'damage', 'offboarding', 'history'].includes(requestedView) ? requestedView as CompanyInventoryView : 'stock';
  const organizationView = requestedView && ['sites', 'departments', 'entities', 'relationships', 'placements', 'access'].includes(requestedView) ? requestedView as CompanyOrganizationView : 'sites';
  const resourceView = requestedView && ['overview', 'insurance', 'contracts', 'fleet', 'assets'].includes(requestedView) ? requestedView as CompanyResourcesView : 'overview';
  const itemId = typeof params.itemId === 'string' ? params.itemId : undefined;
  const shared = { tenantId, roleKey, actorProfileId, effectivePermissions: access.permissions, onNavigationGuardChange: setChildGuard };
  const inventoryContent = tab === 'inventory' && canInventory ? <CompanyInventoryWorkspace {...shared} scopeLimited={access.scopeLimited} initialView={inventoryView}
    initialEmployeeId={typeof params.employeeId === 'string' ? params.employeeId : undefined} initialItemId={itemId}
    onViewChange={view => router.setParams({ ansicht: view })} /> : null;
  if (operational) {
    if (tab === 'inventory' ? !canInventory : !canStructure) return <LiquidState kind="locked" title={tab === 'inventory' ? 'Inventar ist geschützt' : 'Unternehmensbereich ist geschützt'} message="Für diesen Bereich fehlt Ihnen die Berechtigung." />;
    const visibleTabs = COMPANY_TABS.filter(item => item.id === 'inventory' ? canInventory : item.id === 'structure' || item.id === 'resources' ? canStructure : canManage);
    return <div className="co-workspace" data-cs-company-surface="light">
      <style>{companyWorkspaceCss}</style>
      <div className="co-topline"><span>Office <b>/</b> Unternehmen <b>/</b> {COMPANY_TABS.find(item => item.id === tab)?.label}</span></div>
      <header className="co-content-heading"><div><h1>Unternehmen</h1><p>Menschen, Standorte und Ausstattung gemeinsam organisieren.</p></div>
        {canManage ? <button type="button" className="co-text-action" onClick={() => void selectTab('overview')}>Zur Unternehmensakte</button> : null}
      </header>
      <div className="co-navigation"><nav aria-label="Bereiche der Unternehmensakte">{visibleTabs.map(item => <button type="button" key={item.id} aria-pressed={item.id === tab} onClick={() => void selectTab(item.id)}>{item.label}</button>)}</nav></div>
      <main className="co-content">{tab === 'inventory' ? inventoryContent : tab === 'structure' ? <CompanyOrganizationWorkspace {...shared}
        initialView={organizationView} scopeLimited={access.scopeLimited} canManageScopes={access.canManageScopes}
        onViewChange={view => router.setParams({ ansicht: view })} accessNavigationGuard={checkAccessGuard}
        accessContent={access.canManageScopes ? <CompanyScopeAccessPanel tenantId={tenantId} roleKey={roleKey} actorProfileId={actorProfileId} effectivePermissions={access.permissions} onNavigationGuardChange={setAccessGuard} /> : null}
      /> : <CompanyResourcesWorkspace {...shared} initialView={resourceView} initialItemId={itemId} scopeLimited={access.scopeLimited} onViewChange={view => router.setParams({ ansicht: view })} />}</main>
    </div>;
  }
  if (!canManage) return <LiquidState kind="locked" title="Unternehmensdaten sind geschützt" message="Für diesen Bereich benötigen Sie die Berechtigung zur Verwaltung der Unternehmensdaten." />;
  if (query.loading && !query.data) return <LiquidState kind="loading" title="Unternehmensakte wird geladen" message="Ihre Unternehmensdaten werden abgerufen." />;
  if (query.error && !query.data) return <LiquidState kind="error" title="Unternehmensdaten konnten nicht geladen werden" message={query.error} actionLabel="Erneut versuchen" onAction={() => void query.refresh()} />;
  if (!query.data) return <LiquidState kind="empty" title="Unternehmensdaten nicht verfügbar" message="Für Ihren Unternehmenszugang wurden keine Stammdaten gefunden." actionLabel="Erneut laden" onAction={() => void query.refresh()} />;
  const snapshot = query.data;
  const openSection = async (section: TenantCenterSectionKey) => {
    if (!canManage || childGuard.current && !(await childGuard.current())) return;
    setNotice(null);
    if (DIRECT_ROUTES[section]) { router.push(DIRECT_ROUTES[section] as never); return; }
    if (section === 'catalog' || section === 'travelSurcharges') { setCatalog(section === 'catalog' ? 'service' : 'travel'); return; }
    if (section === 'customFields') { setCustom({ field: null }); return; }
    if (section === 'audit') { void selectTab('history'); return; }
    if (section === 'locations') { router.push('/unternehmen/standorte' as never); return; }
    setActiveSection(section === 'supervisory' || section === 'ikNumbers' ? 'register' : section);
  };
  const guarded = async (action: () => void) => { if (!childGuard.current || await childGuard.current()) action(); };
  const saved = (next?: TenantCenterSnapshot) => {
    if (next?.tenantId === tenantId) query.setData(next);
    setNoticeTone('success');
    setNotice('Änderungen gespeichert.');
    void query.refresh();
  };
  const copy = async (value: string, message: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value);
      setNoticeTone('success');
      setNotice(message);
    } catch { setNoticeTone('error'); setNotice('Kopieren ist in diesem Browser nicht möglich. Sie können die Angaben direkt markieren und kopieren.'); }
  };
  return <>
    <CompanyWorkspaceView snapshot={snapshot} tab={tab} onTab={next => void selectTab(next)} activeAreas={['Office', ...(snapshot.modules.assistEnabled && modulePermissions.hasModuleGate('assist') ? ['Assist'] : [])]} canEdit={canManage} canDocuments={access.permissions.includes('office.documents.view')} canInventory={canInventory} inventoryContent={inventoryContent} settingsContent={<><CompanyCostCentersPanel tenantId={tenantId} roleKey={roleKey} effectivePermissions={access.permissions} onNavigationGuardChange={setCostCentersGuard} /><CompanyCustomValuesPanel tenantId={tenantId} roleKey={roleKey} effectivePermissions={access.permissions} fields={snapshot.customFields} onNavigationGuardChange={setCustomValuesGuard} /></>} refreshing={query.refreshing} refreshError={query.refreshError} notice={notice} noticeTone={noticeTone} onRefresh={() => void guarded(() => { setNotice(null); void query.refresh(); })} onOpen={section => void openSection(section)} onCustomField={field => void guarded(() => setCustom({ field }))} onCopy={(value, message) => void copy(value, message)} onDocuments={() => void guarded(() => router.push('/business/office/document-catalog' as never))} />
    {activeSection ? <TenantCenterSectionModals key={`${tenantId}:${activeSection}`} activeSection={activeSection} snapshot={snapshot} tenantId={tenantId} effectivePermissions={access.permissions} onClose={() => setActiveSection(null)} onSaved={saved} onReloaded={next => { if (next.tenantId === tenantId) query.setData(next); }} /> : null}
    {catalog ? <TenantServiceCatalogModal key={`${tenantId}:${catalog}`} visible tenantId={tenantId} effectivePermissions={access.permissions} initialCategory={catalog} onClose={() => setCatalog(null)} onSaved={() => saved()} /> : null}
    {custom ? <TenantCustomFieldWizardModal key={`${tenantId}:${custom.field?.id ?? 'new'}`} visible tenantId={tenantId} effectivePermissions={access.permissions} field={custom.field} onClose={() => setCustom(null)} onSaved={fields => { if (fields) query.setData({ ...snapshot, customFields: fields }); saved(); }} /> : null}
  </>;
}
