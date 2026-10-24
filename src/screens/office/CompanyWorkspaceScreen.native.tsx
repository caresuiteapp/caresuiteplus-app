import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useCompanyAccess } from '@/hooks/useCompanyAccess';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { fetchTenantCenter } from '@/lib/tenant/tenantCenterService';
import { COMPANY_TABS, type CompanyTab } from '@/lib/tenant/companyWorkspaceModel';
import { ScreenShell } from '@/components/layout/ScreenShell';
import { MobileChips, MobileHeading, MobileState, m } from '@/components/mobile/MobileWorkspace';
import * as Clipboard from 'expo-clipboard';
import { CompanyWorkspaceView } from '@/components/company/CompanyWorkspaceView';
import { TenantCenterSectionModals } from '@/components/tenant/TenantCenterSectionModals.native';
import { TenantServiceCatalogModal } from '@/components/tenant/TenantServiceCatalogModal';
import { TenantCustomFieldWizardModal } from '@/components/tenant/TenantCustomFieldWizardModal.native';
import { CompanyOrganizationWorkspace } from '@/components/company/CompanyOrganizationWorkspace.native';
import { CompanyResourcesWorkspace } from '@/components/company/CompanyResourcesWorkspace.native';
import { CompanyInventoryScreen } from '@/screens/inventory/CompanyInventoryScreen.native';
import { ORGANIZATION_VIEWS } from '@/components/company/companyOrganizationModel';
import { COMPANY_RESOURCES_VIEWS } from '@/components/company/companyResourcesModel';
import { CompanyCostCentersPanel, CompanyCustomValuesPanel } from '@/components/company/CompanySettingsPanels.native';
import type { TenantCustomFieldDefinition } from '@/types/tenant/tenantCenter';
import type { CompanyAccess } from '@/types/tenant/companyAccess';
import type { ServiceCatalogCategory, TenantCenterSectionKey } from '@/types/tenant/tenantCenter';

type Props = { initialTab?: CompanyTab; initialView?: string };
export function CompanyWorkspaceScreen({ initialTab = 'overview', initialView }: Props = {}) {
  const tenantId = useServiceTenantId(); const { profile } = useAuth(); const { roleKey } = usePermissions();
  const access = useCompanyAccess(tenantId ?? '', profile?.id, roleKey);
  return <ScreenShell title="Unternehmen" showBack={false} scroll={false} contentOwnsHeader>{!tenantId ? <MobileState title="Unternehmenszugang fehlt" message="Ihr Zugang ist keinem Unternehmen zugeordnet." /> : access.loading ? <MobileState loading title="Unternehmen wird geladen" /> : !access.data ? <MobileState title="Zugriff konnte nicht geprüft werden" message={access.error ?? undefined} onRetry={access.refresh} /> : <CompanyContent key={`${tenantId}:${profile?.id}:${roleKey}:${JSON.stringify(access.data)}`} tenantId={tenantId} access={access.data} initialTab={initialTab} initialView={initialView} />}</ScreenShell>;
}
function CompanyContent({ tenantId, access, initialTab, initialView }: { tenantId: string; access: CompanyAccess; initialTab: CompanyTab; initialView?: string }) {
  const router = useRouter(); const params = useLocalSearchParams<{ ansicht?: string; csPage_CompanyWorkspace_view?: string }>(); const { roleKey, hasModuleGate } = usePermissions();
  const canManage = access.permissions.includes('business.tenant.manage') && !access.scopeLimited;
  const [rawTab, setTab] = useState<CompanyTab>(() => COMPANY_TABS.find(item => item.id === params.csPage_CompanyWorkspace_view)?.id ?? 'overview');
  const requestedTab = initialTab !== 'overview' ? initialTab : COMPANY_TABS.find(item => item.id === params.csPage_CompanyWorkspace_view)?.id ?? rawTab;
  const tab = access.scopeLimited && !['structure', 'resources', 'inventory'].includes(requestedTab) ? (access.permissions.includes('business.tenant.manage') ? 'structure' : 'inventory') : requestedTab; const [section, setSection] = useState<TenantCenterSectionKey | null>(null);
  const [catalog, setCatalog] = useState<ServiceCatalogCategory | null>(null); const [custom, setCustom] = useState<TenantCustomFieldDefinition | 'new' | null>(null); const [notice, setNotice] = useState(''); const [noticeTone, setNoticeTone] = useState<'success' | 'error'>('success');
  const query = useAsyncQuery(() => fetchTenantCenter(tenantId, roleKey), [tenantId, roleKey], { enabled: canManage && !['structure', 'resources', 'inventory'].includes(tab), queryKey: `native-company:${tenantId}:${roleKey}:${canManage}:${['structure', 'resources', 'inventory'].includes(tab)}` });
  const navigateTab = (next: CompanyTab) => {
    if (next === tab) return;
    if (next === 'inventory') { if (!access.permissions.includes('inventory.view')) return; router.push('/unternehmen/inventar' as never); return; }
    if (next === 'structure' || next === 'resources') { if (!access.permissions.includes('business.tenant.manage')) return; router.push((next === 'structure' ? '/unternehmen/standorte' : '/unternehmen/ressourcen') as never); return; }
    if (!canManage) return;
    if (initialTab !== 'overview') { router.push(`/unternehmen?csPage_CompanyWorkspace_view=${next}` as never); return; }
    setTab(next); router.setParams({ csPage_CompanyWorkspace_view: next });
  };
  const tabs = COMPANY_TABS.filter(item => item.id === 'inventory' ? access.permissions.includes('inventory.view') : item.id === 'structure' || item.id === 'resources' ? access.permissions.includes('business.tenant.manage') : canManage).map(item => ({ key: item.id, label: item.label }));
  const open = (key: TenantCenterSectionKey) => {
    const routes: Partial<Record<TenantCenterSectionKey, string>> = { locations: '/unternehmen/standorte', documentLayout: '/business/templates/ci-layout', dataManagement: '/business/office/settings/csv-import-export', clientServiceTypes: '/settings/tenant/client-service-types', clientBudgetDefaults: '/settings/tenant/client-budget', appearance: '/settings/appearance' };
    if (routes[key]) { router.push(routes[key] as never); return; }
    if (key === 'catalog' || key === 'travelSurcharges') { setCatalog(key === 'catalog' ? 'service' : 'travel'); return; }
    if (key === 'customFields') { setCustom('new'); return; }
    if (key === 'audit') { navigateTab('history'); return; }
    setSection(key === 'supervisory' || key === 'ikNumbers' ? 'register' : key);
  };
  const snapshot = query.data;
  if (tab === 'structure' || tab === 'resources' || tab === 'inventory') {
    const requestedView = typeof params.ansicht === 'string' ? params.ansicht : initialView;
    const structureView = ORGANIZATION_VIEWS.find(item => item.id === requestedView)?.id ?? (requestedView === 'access' ? 'access' : 'sites');
    const resourceView = COMPANY_RESOURCES_VIEWS.find(item => item.id === requestedView)?.id ?? 'overview';
    return <View style={m.page}>
      <MobileHeading title="Unternehmen" subtitle="Ihre Unternehmensakte" icon="briefcase" />
      <MobileChips label="Unternehmensbereiche" items={tabs} value={tab} onChange={navigateTab} />
      <View style={m.grow}>{tab === 'structure' ? <CompanyOrganizationWorkspace initialView={structureView} /> : tab === 'resources' ? <CompanyResourcesWorkspace initialView={resourceView} /> : <CompanyInventoryScreen />}</View>
    </View>;
  }
  if (!canManage) return <MobileState title="Unternehmensdaten sind geschützt" message="Für diesen Bereich benötigen Sie die Berechtigung zur Verwaltung der Unternehmensdaten." />;
  if (query.loading && !snapshot) return <MobileState loading title="Unternehmensakte wird geladen" />;
  if (!snapshot) return <MobileState title={query.error ? 'Unternehmensdaten konnten nicht geladen werden' : 'Unternehmensdaten nicht verfügbar'} message={query.error ?? 'Für Ihren Unternehmenszugang wurden keine Stammdaten gefunden.'} onRetry={() => void query.refresh()} />;
  return <><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
    <CompanyWorkspaceView snapshot={snapshot} tab={tab} onTab={navigateTab}
      activeAreas={['Office', ...(snapshot.modules.assistEnabled && hasModuleGate('assist') ? ['Assist'] : [])]}
      canEdit={canManage} canDocuments={access.permissions.includes('office.documents.view')} canInventory={access.permissions.includes('inventory.view')}
      refreshing={query.refreshing} refreshError={query.refreshError} notice={notice} noticeTone={noticeTone}
      onRefresh={() => { setNotice(''); void query.refresh(); }} onOpen={open} onCustomField={setCustom}
      onCopy={(value, message) => { void Clipboard.setStringAsync(value).then(() => { setNoticeTone('success'); setNotice(message); }).catch(() => { setNoticeTone('error'); setNotice('Kopieren ist auf diesem Gerät nicht möglich. Sie können die Angaben markieren und kopieren.'); }); }}
      onDocuments={() => router.push('/business/office/document-catalog' as never)}
      settingsContent={<><CompanyCustomValuesPanel scope={{ tenantId, roleKey, effectivePermissions: access.permissions }} fields={snapshot.customFields} /><CompanyCostCentersPanel scope={{ tenantId, roleKey, effectivePermissions: access.permissions }} /></>} />
  </ScrollView>{snapshot && section ? <TenantCenterSectionModals activeSection={section} snapshot={snapshot} tenantId={tenantId} effectivePermissions={access.permissions} onClose={() => setSection(null)} onSaved={saved => { if (saved) query.setData(saved); setNoticeTone('success'); setNotice('Änderungen gespeichert.'); void query.refresh(); }} /> : null}
  {catalog ? <TenantServiceCatalogModal visible tenantId={tenantId} initialCategory={catalog} onClose={() => setCatalog(null)} onSaved={() => void query.refresh()} /> : null}
  {custom ? <TenantCustomFieldWizardModal visible tenantId={tenantId} field={custom === 'new' ? null : custom} effectivePermissions={access.permissions} onClose={() => setCustom(null)} onSaved={() => void query.refresh()} /> : null}</>;
}
