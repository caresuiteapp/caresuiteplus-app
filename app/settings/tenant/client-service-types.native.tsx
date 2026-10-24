import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import {NativeP,NativeDiv,NativeLabel,NativeInput,NativeButton,NativeArticle,NativeH2,NativeStrong,NativeSpan} from '@/components/layout/NativeWorkspaceElements.native';
import { useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { CompanyClientSettingsFrame, CompanySettingsEditor, CompanySettingsFeedback } from "../../../src/components/company/CompanyClientSettings.native.tsx";
import { companyMoney, companyRateUnit, fetchCompanyServiceSettings, saveCompanyBillingRate, saveCompanyServiceType, type CompanyBillingRule, type CompanyServiceType } from "../../../src/lib/tenant/companyClientSettings.ts";
import type { RoleKey } from '@/types';
function TenantClientServiceTypesScreen() {
    const tenantId = useServiceTenantId();
    const { roleKey, can } = usePermissions();
    return <CompanyClientSettingsFrame title="Leistungsarten für Klient:innen" description="Bezeichnungen und Abrechnungsvorgaben für die Leistungsarten Ihres Unternehmens.">
    {!tenantId || !can('business.tenant.manage') ? <NativeP className="cs-company-empty">Für diesen Bereich benötigen Sie einen Unternehmenszugang mit Verwaltungsberechtigung.</NativeP> : <ServiceSettings key={`${tenantId}:${roleKey}`} tenantId={tenantId} roleKey={roleKey}/>}
  </CompanyClientSettingsFrame>;
}
function ServiceSettings({ tenantId, roleKey }: {
    tenantId: string;
    roleKey: RoleKey | null;
}) {
    const query = useAsyncQuery(() => fetchCompanyServiceSettings(tenantId, roleKey), [tenantId, roleKey], { queryKey: `company-service-settings:${tenantId}:${roleKey}` });
    const [editType, setEditType] = useState<CompanyServiceType | null>(null);
    const [editRate, setEditRate] = useState<CompanyBillingRule | null>(null);
    const [search, setSearch] = useState('');
    const [notice, setNotice] = useState<string | null>(null);
    const types = (query.data?.types ?? []).filter(type => !['ambulante_pflege', 'stationaere_pflege', 'beratung'].includes(type.key));
    const visible = types.filter(type => `${type.name} ${type.description}`.toLocaleLowerCase('de-DE').includes(search.trim().toLocaleLowerCase('de-DE')));
    return <>
    <CompanySettingsFeedback error={query.error ?? query.refreshError} message={notice} onRetry={() => void query.refresh()} loading={query.refreshing}/>
    <NativeDiv className="cs-client-settings-toolbar"><NativeDiv className="cs-company-field"><NativeLabel htmlFor="company-service-search">Leistungsart suchen</NativeLabel><NativeInput id="company-service-search" type="search" value={search} onChange={event => setSearch(event.target.value)}/></NativeDiv><NativeButton type="button" disabled={query.refreshing || query.loading} onClick={() => void query.refresh()}>{query.refreshing ? 'Wird aktualisiert …' : 'Aktualisieren'}</NativeButton></NativeDiv>
    {query.loading && !query.data ? <NativeP className="cs-company-empty" role="status">Leistungsarten werden geladen …</NativeP> : !query.data ? null : !visible.length ? <NativeP className="cs-company-empty">{search.trim() ? 'Keine Leistungsart passt zu Ihrer Suche.' : 'Es sind noch keine freigegebenen Leistungsarten hinterlegt.'}</NativeP> : <NativeDiv className="cs-client-settings-grid">{visible.map(type => {
                const rules = query.data!.rules.filter(rule => rule.serviceTypeId === type.id);
                return <NativeArticle key={type.id} className="cs-client-settings-card"><NativeH2>{type.name}</NativeH2>{type.description ? <NativeP>{type.description}</NativeP> : null}<NativeButton type="button" onClick={() => { setNotice(null); setEditType(type); }}>Bezeichnung bearbeiten</NativeButton>
        {rules.length ? rules.map(rule => <NativeDiv className="cs-client-settings-rules" key={rule.id}><NativeStrong>{companyMoney(rule.rate)}{rule.rate !== null ? ` / ${companyRateUnit(rule.unit)}` : ''}</NativeStrong><NativeSpan>Unterschrift {rule.signature ? 'erforderlich' : 'nicht erforderlich'} · Freigabe {rule.approval ? 'erforderlich' : 'nicht erforderlich'}</NativeSpan><NativeSpan>{rule.budget ? 'Budgetprüfung vorgesehen' : 'Keine Budgetpflicht hinterlegt'}</NativeSpan><NativeButton type="button" onClick={() => { setNotice(null); setEditRate(rule); }}>Preis bearbeiten</NativeButton></NativeDiv>) : <NativeP className="cs-client-settings-subtle">Für diese Leistungsart ist keine Abrechnungsregel hinterlegt.</NativeP>}
      </NativeArticle>;
            })}</NativeDiv>}
    {editType ? <CompanySettingsEditor key={editType.id} title="Leistungsart bearbeiten" initial={{ name: editType.name, description: editType.description }} fields={[{ key: 'name', label: 'Bezeichnung', required: true }, { key: 'description', label: 'Beschreibung', multiline: true }]} onSave={values => saveCompanyServiceType(tenantId, roleKey, editType.id, { name: values.name, description: values.description })} onSaved={type => { query.setData(previous => previous ? { ...previous, types: previous.types.map(row => row.id === type.id ? type : row) } : previous); setNotice('Leistungsart gespeichert.'); }} onClose={() => setEditType(null)}/> : null}
    {editRate ? <CompanySettingsEditor key={editRate.id} title={`Preis · ${types.find(type => type.id === editRate.serviceTypeId)?.name ?? 'Leistungsart'}`} initial={{ rate: editRate.rate === null ? '' : String(editRate.rate) }} fields={[{ key: 'rate', label: `Preis je ${companyRateUnit(editRate.unit)} in Euro`, numeric: true, hint: 'Leer lassen entfernt den hinterlegten Standardpreis. 0 bedeutet ausdrücklich kostenlos.' }]} onSave={values => saveCompanyBillingRate(tenantId, roleKey, editRate.id, values.rate)} onSaved={rule => { query.setData(previous => previous ? { ...previous, rules: previous.rules.map(row => row.id === rule.id ? rule : row) } : previous); setNotice('Preis gespeichert.'); }} onClose={() => setEditRate(null)}/> : null}
  </>;
}
export default withNativeWorkflowPage(TenantClientServiceTypesScreen);
