import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useCompanyAccess } from '@/hooks/useCompanyAccess';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { fetchTenantCenter } from '@/lib/tenant/tenantCenterService';
import { COMPANY_TABS, companyIdentity, companySections, filterCompanySections, type CompanyTab } from '@/lib/tenant/companyWorkspaceModel';
import { ScreenShell } from '@/components/layout/ScreenShell';
import { MobileButton, MobileCard, MobileChips, MobileHeading, MobileIconButton, MobileSearch, MobileState, m } from '@/components/mobile/MobileWorkspace';
import { CareSuiteImage } from '@/components/images/CareSuiteImage';
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
  const requestedTab = initialTab !== 'overview' ? initialTab : rawTab;
  const tab = access.scopeLimited && !['structure', 'resources', 'inventory'].includes(requestedTab) ? (access.permissions.includes('business.tenant.manage') ? 'structure' : 'inventory') : requestedTab; const [search, setSearch] = useState(''); const [section, setSection] = useState<TenantCenterSectionKey | null>(null);
  const [catalog, setCatalog] = useState<ServiceCatalogCategory | null>(null); const [custom, setCustom] = useState<TenantCustomFieldDefinition | 'new' | null>(null); const [notice, setNotice] = useState('');
  const query = useAsyncQuery(() => fetchTenantCenter(tenantId, roleKey), [tenantId, roleKey], { enabled: canManage && !['structure', 'resources', 'inventory'].includes(tab), queryKey: `native-company:${tenantId}:${roleKey}` });
  const navigateTab = (next: CompanyTab) => {
    if (next === tab) return;
    if (next === 'inventory') { router.push('/unternehmen/inventar' as never); return; }
    if (next === 'structure' || next === 'resources') { router.push((next === 'structure' ? '/unternehmen/standorte' : '/unternehmen/ressourcen') as never); return; }
    if (!canManage) return;
    if (initialTab !== 'overview') { router.push(`/unternehmen?csPage_CompanyWorkspace_view=${next}` as never); return; }
    setTab(next); setSearch(''); router.setParams({ csPage_CompanyWorkspace_view: next });
  };
  const tabs = COMPANY_TABS.filter(item => item.id === 'inventory' ? access.permissions.includes('inventory.view') : item.id === 'structure' || item.id === 'resources' ? access.permissions.includes('business.tenant.manage') : canManage).map(item => ({ key: item.id, label: item.label }));
  const open = (key: TenantCenterSectionKey) => {
    const routes: Partial<Record<TenantCenterSectionKey, string>> = { locations: '/unternehmen/standorte', documentLayout: '/business/templates/ci-layout', dataManagement: '/business/office/settings/csv-import-export', clientServiceTypes: '/settings/tenant/client-service-types', clientBudgetDefaults: '/settings/tenant/client-budget', appearance: '/settings/appearance' };
    if (routes[key]) { router.push(routes[key] as never); return; }
    if (key === 'catalog' || key === 'travelSurcharges') { setCatalog(key === 'catalog' ? 'service' : 'travel'); return; }
    if (key === 'customFields') { setCustom('new'); return; }
    if (key === 'audit') { setTab('history'); return; }
    setSection(key === 'supervisory' || key === 'ikNumbers' ? 'register' : key);
  };
  const snapshot = query.data; const identity = snapshot ? companyIdentity(snapshot) : null;
  const sections = snapshot ? filterCompanySections(companySections(snapshot, ['Office', ...(snapshot.modules.assistEnabled && hasModuleGate('assist') ? ['Assist'] : [])]), search).filter(item => tab === 'overview' || item.tab === tab) : [];
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
  return <><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[m.stack, { paddingBottom: 24 }]}>
    <MobileHeading title="Unternehmen" subtitle="Ihre Unternehmensakte" icon="briefcase" action={canManage ? <MobileIconButton label="Unternehmen aktualisieren" icon="refresh-cw" onPress={() => void query.refresh()} /> : undefined} />
    {identity ? <MobileCard style={{ backgroundColor: '#EAF3FF' }}><View style={m.row}>{snapshot?.branding.logoUrl ? <CareSuiteImage source={{ uri: snapshot.branding.logoUrl }} resizeMode="contain" style={{ width: 88, height: 72, borderRadius: 14 }} /> : null}<View style={m.grow}><Text style={m.title}>{identity.name}</Text>{identity.legalName ? <Text style={m.muted}>{identity.legalName}</Text> : null}</View></View><Text style={m.body}>{identity.address || 'Anschrift noch nicht hinterlegt'}</Text>{identity.representative ? <Text style={m.muted}>{identity.representative}</Text> : null}<MobileButton compact label="Profil bearbeiten" icon="edit-3" onPress={() => setSection('company')} /></MobileCard> : null}
    <MobileChips label="Unternehmensbereiche" items={tabs} value={tab} onChange={navigateTab} />
    {query.loading && canManage ? <MobileState loading title="Unternehmensdaten werden geladen" /> : null}
    {query.error && canManage ? <MobileState title="Unternehmensdaten konnten nicht geladen werden" message={query.error} onRetry={() => void query.refresh()} /> : null}
    {notice ? <Text accessibilityLiveRegion="polite" style={[m.body, { color: '#087865' }]}>{notice}</Text> : null}
    {snapshot && tab !== 'history' ? <><MobileSearch value={search} onChangeText={setSearch} label="Unternehmensangaben suchen" placeholder="Angaben oder Einstellungen suchen" />{sections.map(item => <MobileCard key={item.key}><Text accessibilityRole="header" style={m.section}>{item.title}</Text><Text style={m.muted}>{item.description}</Text>{item.rows.map(([label, value]) => <View key={label}><Text style={m.label}>{label}</Text><Text selectable style={m.body}>{value || 'Nicht hinterlegt'}</Text></View>)}<MobileButton label={item.action} icon="edit-3" onPress={() => open(item.key)} /></MobileCard>)}</> : null}
    {snapshot && canManage && tab === 'organization' ? <><MobileCard><Text style={m.section}>Felddefinitionen</Text>{snapshot.customFields.map(field => <View key={field.id ?? field.fieldKey} style={m.stack}><Text style={m.body}>{field.label} · {field.isActive ? 'Aktiv' : 'Inaktiv'}</Text><MobileButton label={`${field.label} bearbeiten`} onPress={() => setCustom(field)} /></View>)}<MobileButton label="Feld anlegen" onPress={() => setCustom('new')} /></MobileCard><CompanyCustomValuesPanel scope={{ tenantId, roleKey, effectivePermissions: access.permissions }} fields={snapshot.customFields} /><CompanyCostCentersPanel scope={{ tenantId, roleKey, effectivePermissions: access.permissions }} /></> : null}
    {snapshot && tab === 'history' ? snapshot.auditLogs.length ? snapshot.auditLogs.map(entry => <MobileCard key={entry.id}><Text style={m.section}>{entry.title}</Text><Text style={m.body}>{entry.description}</Text><Text style={m.muted}>{new Date(entry.createdAt).toLocaleString('de-DE')}</Text></MobileCard>) : <MobileState title="Noch keine Aktivitäten" /> : null}
    {access.permissions.includes('office.documents.view') ? <MobileButton label="Dokumentenkatalog öffnen" icon="file-text" onPress={() => router.push('/business/office/document-catalog' as never)} /> : null}
  </ScrollView>{snapshot && section ? <TenantCenterSectionModals activeSection={section} snapshot={snapshot} tenantId={tenantId} effectivePermissions={access.permissions} onClose={() => setSection(null)} onSaved={saved => { if (saved) query.setData(saved); setNotice('Änderungen gespeichert.'); void query.refresh(); }} /> : null}
  {catalog ? <TenantServiceCatalogModal visible tenantId={tenantId} initialCategory={catalog} onClose={() => setCatalog(null)} onSaved={() => void query.refresh()} /> : null}
  {custom ? <TenantCustomFieldWizardModal visible tenantId={tenantId} field={custom === 'new' ? null : custom} effectivePermissions={access.permissions} onClose={() => setCustom(null)} onSaved={() => void query.refresh()} /> : null}</>;
}
