import { useCallback, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePageTab } from '@/hooks/usePageTab';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
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
  actorProfileId?: string | null;
};

export function CompanyWorkspace(props: CompanyWorkspaceProps) {
  return <ScopedCompanyWorkspace key={`${props.tenantId}:${props.roleKey}:${props.initialTab ?? 'overview'}`} {...props} />;
}
function ScopedCompanyWorkspace({ tenantId, roleKey, initialTab = 'overview', actorProfileId }: CompanyWorkspaceProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{ ansicht?: string | string[]; employeeId?: string | string[]; itemId?: string | string[] }>();
  const permissions = usePermissions();
  const canManage = permissions.can(TENANT_SETTINGS_PERMISSION);
  const canInventory = permissions.can(INVENTORY_VIEW);
  const [rawTab, setTab] = usePageTab<CompanyTab>('CompanyWorkspace.view', 'overview');
  const tab = initialTab === 'inventory' ? 'inventory' : COMPANY_TABS.some(item => item.id === rawTab) ? rawTab : 'overview';
  const inventoryGuard = useRef<(() => Promise<boolean>) | null>(null);
  const setInventoryGuard = useCallback((guard: (() => Promise<boolean>) | null) => {
    inventoryGuard.current = guard;
  }, []);
  const [activeSection, setActiveSection] = useState<TenantCenterSectionKey | null>(null);
  const [catalog, setCatalog] = useState<ServiceCatalogCategory | null>(null);
  const [custom, setCustom] = useState<{ field: TenantCustomFieldDefinition | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<'success' | 'error'>('success');
  const query = useAsyncQuery(() => fetchTenantCenter(tenantId, roleKey), [tenantId, roleKey], {
    enabled: Boolean(tenantId && canManage && tab !== 'inventory'), queryKey: `company:${tenantId}:${roleKey}:${canManage}:${tab === 'inventory'}`,
  });
  const selectTab = async (next: CompanyTab) => {
    if (next === tab) return;
    if (tab === 'inventory' && inventoryGuard.current && !(await inventoryGuard.current())) return;
    if (next === 'inventory') {
      if (canInventory) router.push('/unternehmen/inventar' as never);
      return;
    }
    if (!canManage) return;
    if (initialTab === 'inventory') {
      router.push(`/unternehmen?csPage_CompanyWorkspace_view=${next}` as never);
      return;
    }
    setTab(next);
  };
  const requestedView = typeof params.ansicht === 'string' ? params.ansicht : 'stock';
  const inventoryView = ['stock', 'assignments', 'locations', 'damage', 'offboarding', 'history'].includes(requestedView)
    ? requestedView as CompanyInventoryView : 'stock';
  const inventoryContent = tab === 'inventory' && canInventory ? (
    <CompanyInventoryWorkspace
      tenantId={tenantId}
      roleKey={roleKey}
      actorProfileId={actorProfileId}
      effectivePermissions={permissions.permissions}
      initialView={inventoryView}
      initialEmployeeId={typeof params.employeeId === 'string' ? params.employeeId : undefined}
      initialItemId={typeof params.itemId === 'string' ? params.itemId : undefined}
      onViewChange={view => router.setParams({ ansicht: view })}
      onNavigationGuardChange={setInventoryGuard}
    />
  ) : null;
  if (tab === 'inventory' && !canInventory) {
    return <LiquidState kind="locked" title="Inventar ist geschützt" message="Für diesen Bereich benötigen Sie die Berechtigung zur Inventarverwaltung." />;
  }
  // Keep inventory mounted independently of company-profile access, latency and refreshes.
  if (tab === 'inventory') {
    return <div className="co-workspace" data-cs-company-surface="dark">
      <style>{companyWorkspaceCss}</style>
      <div className="co-topline"><span>Office <b>/</b> Unternehmen <b>/</b> Inventar</span></div>
      <header className="co-content-heading">
        <div><h1>Unternehmen</h1><p>Ausstattung und Rückgaben zentral verwalten.</p></div>
        {canManage ? <button type="button" className="co-text-action" onClick={() => void selectTab('overview')}>Zur Unternehmensakte</button> : null}
      </header>
      {canManage ? <div className="co-navigation"><nav aria-label="Bereiche der Unternehmensakte">
        {COMPANY_TABS.map(item => <button type="button" key={item.id} aria-pressed={item.id === 'inventory'} onClick={() => void selectTab(item.id)}>{item.label}</button>)}
      </nav></div> : null}
      <main className="co-content">{inventoryContent}</main>
    </div>;
  }
  if (!canManage) return <LiquidState kind="locked" title="Unternehmensdaten sind geschützt" message="Für diesen Bereich benötigen Sie die Berechtigung zur Verwaltung der Unternehmensdaten." />;
  if (query.loading && !query.data) return <LiquidState kind="loading" title="Unternehmensakte wird geladen" message="Ihre Unternehmensdaten werden abgerufen." />;
  if (query.error && !query.data) return <LiquidState kind="error" title="Unternehmensdaten konnten nicht geladen werden" message={query.error} actionLabel="Erneut versuchen" onAction={() => void query.refresh()} />;
  if (!query.data) return <LiquidState kind="empty" title="Unternehmensdaten nicht verfügbar" message="Für Ihren Unternehmenszugang wurden keine Stammdaten gefunden." actionLabel="Erneut laden" onAction={() => void query.refresh()} />;
  const snapshot = query.data;
  const openSection = (section: TenantCenterSectionKey) => {
    if (!canManage) return;
    setNotice(null);
    if (DIRECT_ROUTES[section]) { router.push(DIRECT_ROUTES[section] as never); return; }
    if (section === 'catalog' || section === 'travelSurcharges') { setCatalog(section === 'catalog' ? 'service' : 'travel'); return; }
    if (section === 'customFields') { setCustom({ field: null }); return; }
    if (section === 'audit') { setTab('history'); return; }
    setActiveSection(section === 'supervisory' || section === 'ikNumbers' ? 'register' : section === 'locations' ? 'company' : section);
  };
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
    <CompanyWorkspaceView snapshot={snapshot} tab={tab} onTab={next => void selectTab(next)} activeAreas={['Office', ...(snapshot.modules.assistEnabled && permissions.hasModuleGate('assist') ? ['Assist'] : [])]} canEdit={canManage} canDocuments={permissions.can('office.documents.view')} canInventory={canInventory} inventoryContent={inventoryContent} refreshing={query.refreshing} refreshError={query.refreshError} notice={notice} noticeTone={noticeTone} onRefresh={() => { setNotice(null); void query.refresh(); }} onOpen={openSection} onCustomField={field => setCustom({ field })} onCopy={(value, message) => void copy(value, message)} onDocuments={() => router.push('/business/office/document-catalog' as never)} />
    {activeSection ? <TenantCenterSectionModals key={`${tenantId}:${activeSection}`} activeSection={activeSection} snapshot={snapshot} tenantId={tenantId} onClose={() => setActiveSection(null)} onSaved={saved} onReloaded={next => { if (next.tenantId === tenantId) query.setData(next); }} /> : null}
    {catalog ? <TenantServiceCatalogModal key={`${tenantId}:${catalog}`} visible tenantId={tenantId} initialCategory={catalog} onClose={() => setCatalog(null)} onSaved={() => saved()} /> : null}
    {custom ? <TenantCustomFieldWizardModal key={`${tenantId}:${custom.field?.id ?? 'new'}`} visible tenantId={tenantId} field={custom.field} onClose={() => setCustom(null)} onSaved={fields => { if (fields) query.setData({ ...snapshot, customFields: fields }); saved(); }} /> : null}
  </>;
}
