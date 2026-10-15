import { useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { CompanyClientSettingsFrame, CompanySettingsEditor, CompanySettingsFeedback } from '@/components/company/CompanyClientSettings.web';
import { companyMoney, companyRateUnit, fetchCompanyServiceSettings, saveCompanyBillingRate, saveCompanyServiceType, type CompanyBillingRule, type CompanyServiceType } from '@/lib/tenant/companyClientSettings.web';
import type { RoleKey } from '@/types';

export default function TenantClientServiceTypesScreen() {
  const tenantId = useServiceTenantId(); const { roleKey, can } = usePermissions();
  return <CompanyClientSettingsFrame title="Leistungsarten für Klient:innen" description="Bezeichnungen und Abrechnungsvorgaben für die Leistungsarten Ihres Unternehmens.">
    {!tenantId || !can('business.tenant.manage') ? <p className="cs-company-empty">Für diesen Bereich benötigen Sie einen Unternehmenszugang mit Verwaltungsberechtigung.</p> : <ServiceSettings key={`${tenantId}:${roleKey}`} tenantId={tenantId} roleKey={roleKey} />}
  </CompanyClientSettingsFrame>;
}
function ServiceSettings({ tenantId, roleKey }: { tenantId: string; roleKey: RoleKey | null }) {
  const query = useAsyncQuery(() => fetchCompanyServiceSettings(tenantId, roleKey), [tenantId, roleKey], { queryKey: `company-service-settings:${tenantId}:${roleKey}` });
  const [editType, setEditType] = useState<CompanyServiceType | null>(null);
  const [editRate, setEditRate] = useState<CompanyBillingRule | null>(null);
  const [search, setSearch] = useState(''); const [notice, setNotice] = useState<string | null>(null);
  const types = (query.data?.types ?? []).filter(type => !['ambulante_pflege', 'stationaere_pflege', 'beratung'].includes(type.key));
  const visible = types.filter(type => `${type.name} ${type.description}`.toLocaleLowerCase('de-DE').includes(search.trim().toLocaleLowerCase('de-DE')));
  return <>
    <CompanySettingsFeedback error={query.error ?? query.refreshError} message={notice} onRetry={() => void query.refresh()} loading={query.refreshing} />
    <div className="cs-client-settings-toolbar"><div className="cs-company-field"><label htmlFor="company-service-search">Leistungsart suchen</label><input id="company-service-search" type="search" value={search} onChange={event => setSearch(event.target.value)} /></div><button type="button" disabled={query.refreshing || query.loading} onClick={() => void query.refresh()}>{query.refreshing ? 'Wird aktualisiert …' : 'Aktualisieren'}</button></div>
    {query.loading && !query.data ? <p className="cs-company-empty" role="status">Leistungsarten werden geladen …</p> : !query.data ? null : !visible.length ? <p className="cs-company-empty">{search.trim() ? 'Keine Leistungsart passt zu Ihrer Suche.' : 'Es sind noch keine freigegebenen Leistungsarten hinterlegt.'}</p> : <div className="cs-client-settings-grid">{visible.map(type => {
      const rules = query.data!.rules.filter(rule => rule.serviceTypeId === type.id);
      return <article key={type.id} className="cs-client-settings-card"><h2>{type.name}</h2>{type.description ? <p>{type.description}</p> : null}<button type="button" onClick={() => { setNotice(null); setEditType(type); }}>Bezeichnung bearbeiten</button>
        {rules.length ? rules.map(rule => <div className="cs-client-settings-rules" key={rule.id}><strong>{companyMoney(rule.rate)}{rule.rate !== null ? ` / ${companyRateUnit(rule.unit)}` : ''}</strong><span>Unterschrift {rule.signature ? 'erforderlich' : 'nicht erforderlich'} · Freigabe {rule.approval ? 'erforderlich' : 'nicht erforderlich'}</span><span>{rule.budget ? 'Budgetprüfung vorgesehen' : 'Keine Budgetpflicht hinterlegt'}</span><button type="button" onClick={() => { setNotice(null); setEditRate(rule); }}>Preis bearbeiten</button></div>) : <p className="cs-client-settings-subtle">Für diese Leistungsart ist keine Abrechnungsregel hinterlegt.</p>}
      </article>;
    })}</div>}
    {editType ? <CompanySettingsEditor key={editType.id} title="Leistungsart bearbeiten" initial={{ name: editType.name, description: editType.description }} fields={[{ key: 'name', label: 'Bezeichnung', required: true }, { key: 'description', label: 'Beschreibung', multiline: true }]} onSave={values => saveCompanyServiceType(tenantId, roleKey, editType.id, { name: values.name, description: values.description })} onSaved={type => { query.setData(previous => previous ? { ...previous, types: previous.types.map(row => row.id === type.id ? type : row) } : previous); setNotice('Leistungsart gespeichert.'); }} onClose={() => setEditType(null)} /> : null}
    {editRate ? <CompanySettingsEditor key={editRate.id} title={`Preis · ${types.find(type => type.id === editRate.serviceTypeId)?.name ?? 'Leistungsart'}`} initial={{ rate: editRate.rate === null ? '' : String(editRate.rate) }} fields={[{ key: 'rate', label: `Preis je ${companyRateUnit(editRate.unit)} in Euro`, numeric: true, hint: 'Leer lassen entfernt den hinterlegten Standardpreis. 0 bedeutet ausdrücklich kostenlos.' }]} onSave={values => saveCompanyBillingRate(tenantId, roleKey, editRate.id, values.rate)} onSaved={rule => { query.setData(previous => previous ? { ...previous, rules: previous.rules.map(row => row.id === rule.id ? rule : row) } : previous); setNotice('Preis gespeichert.'); }} onClose={() => setEditRate(null)} /> : null}
  </>;
}
