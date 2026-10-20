import { useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePageTab } from '@/hooks/usePageTab';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { CompanyClientSettingsFrame, CompanySettingsEditor, CompanySettingsFeedback } from '@/components/company/CompanyClientSettings.web';
import { companyMoney, currentCompanyBudgetYear, fetchCompanyBudgetSettings, saveCompanyBudgetDefault } from '@/lib/tenant/companyClientSettings.web';
import type { TenantBudgetDefault } from '@/types/clientCore';
import type { RoleKey } from '@/types';

export default function TenantClientBudgetDefaultsScreen() {
  const tenantId = useServiceTenantId(); const { roleKey, can } = usePermissions();
  return <CompanyClientSettingsFrame title="Budgetvorlagen" description="Hinterlegte Vorgaben für Budgetjahre und die Aufnahme neuer Klient:innen.">
    {!tenantId || !can('business.tenant.manage') ? <p className="cs-company-empty">Für diesen Bereich benötigen Sie einen Unternehmenszugang mit Verwaltungsberechtigung.</p> : <BudgetSettings key={`${tenantId}:${roleKey}`} tenantId={tenantId} roleKey={roleKey} />}
  </CompanyClientSettingsFrame>;
}
function BudgetSettings({ tenantId, roleKey }: { tenantId: string; roleKey: RoleKey | null }) {
  const query = useAsyncQuery(() => fetchCompanyBudgetSettings(tenantId, roleKey), [tenantId, roleKey], { queryKey: `company-budget-settings:${tenantId}:${roleKey}` });
  const [year, setYear] = usePageTab('CompanyBudget.year', String(currentCompanyBudgetYear()));
  const [editing, setEditing] = useState<TenantBudgetDefault | null>(null); const [notice, setNotice] = useState<string | null>(null);
  const years = Array.from(new Set([currentCompanyBudgetYear(), ...(query.data?.years ?? []).map(row => row.budgetYear)])).filter(Number.isInteger).sort((a, b) => b - a);
  const selectedYear = years.includes(Number(year)) ? Number(year) : currentCompanyBudgetYear();
  const yearRows = query.data?.years.filter(row => row.budgetYear === selectedYear) ?? [];
  const rows = query.data?.defaults.filter(row => yearRows.some(candidate => candidate.id === row.budgetYearId)) ?? [];
  const name = (row: TenantBudgetDefault) => query.data?.types.find(type => type.id === row.budgetTypeId)?.name || 'Budgetvorlage';
  const numberText = (amount: number | null, cents = false) => amount === null ? '' : String(cents ? amount / 100 : amount);
  return <>
    <CompanySettingsFeedback error={query.error ?? query.refreshError} message={notice} onRetry={() => void query.refresh()} loading={query.refreshing} />
    <div className="cs-client-settings-toolbar"><div className="cs-company-field"><label htmlFor="company-budget-year">Budgetjahr</label><select id="company-budget-year" value={selectedYear} onChange={event => { setYear(event.target.value); setNotice(null); }}>{years.map(value => <option key={value} value={value}>{value}</option>)}</select></div><button type="button" disabled={query.refreshing || query.loading} onClick={() => void query.refresh()}>{query.refreshing ? 'Wird aktualisiert …' : 'Aktualisieren'}</button></div>
    <p className="cs-client-settings-note">Diese Vorlagen gelten für neue Budgetzuordnungen. Bereits individuell hinterlegte Klient:innenbudgets werden hier nicht geändert.</p>
    {query.loading && !query.data ? <p className="cs-company-empty" role="status">Budgetvorlagen werden geladen …</p> : !query.data ? null : !rows.length ? <p className="cs-company-empty">Für {selectedYear} sind keine Budgetvorlagen hinterlegt. Wählen Sie ein anderes vorhandenes Jahr oder laden Sie die Angaben erneut.</p> : <div className="cs-client-settings-grid">{rows.map(row => {
      const type = query.data!.types.find(item => item.id === row.budgetTypeId);
      const activeYear = yearRows.find(item => item.id === row.budgetYearId)?.isActive;
      return <article className="cs-client-settings-card" key={row.id}><h2>{name(row)}</h2><p>{type?.description || `Budgetvorlage für ${selectedYear}`}</p><span className="cs-client-settings-subtle">{selectedYear} · {activeYear ? 'Aktives Budgetjahr' : 'Inaktives Budgetjahr'}{type?.period ? ` · ${{ monthly: 'Monatlich', yearly: 'Jährlich', quarterly: 'Vierteljährlich' }[type.period]}` : ''}</span><dl>
        <div><dt>Grundbetrag</dt><dd>{companyMoney(row.amountCents, true)}</dd></div><div><dt>Monatlicher Betrag</dt><dd>{companyMoney(row.monthlyAmountCents, true)}</dd></div><div><dt>Jährlicher Betrag</dt><dd>{companyMoney(row.yearlyAmountCents, true)}</dd></div><div><dt>Umrechnung</dt><dd>{row.conversionRatePct === null ? 'Nicht hinterlegt' : `${row.conversionRatePct} %`}</dd></div>
      </dl>{row.notes ? <p>{row.notes}</p> : null}<footer><button type="button" onClick={() => { setNotice(null); setEditing(row); }}>Budgetvorlage bearbeiten</button></footer></article>;
    })}</div>}
    {editing ? <CompanySettingsEditor key={editing.id} title={`${name(editing)} · ${selectedYear}`} initial={{ amount: numberText(editing.amountCents, true), monthly: numberText(editing.monthlyAmountCents, true), yearly: numberText(editing.yearlyAmountCents, true), conversion: numberText(editing.conversionRatePct), notes: editing.notes ?? '' }} fields={[
      { key: 'amount', label: 'Grundbetrag in Euro', numeric: true, required: true, hint: 'Wird verwendet, wenn kein eigener Jahresbetrag hinterlegt ist.' },
      { key: 'monthly', label: 'Monatlicher Betrag in Euro', numeric: true, hint: 'Leer bedeutet: keine monatliche Vorgabe.' }, { key: 'yearly', label: 'Jährlicher Betrag in Euro', numeric: true, hint: 'Leer bedeutet: Grundbetrag verwenden.' },
      { key: 'conversion', label: 'Umrechnung in Prozent', numeric: true, hint: 'Optional, zwischen 0 und 100.' }, { key: 'notes', label: 'Hinweise zur Vorlage', multiline: true },
    ]} onSave={values => saveCompanyBudgetDefault(tenantId, roleKey, editing.id, { amount: values.amount, monthly: values.monthly, yearly: values.yearly, conversion: values.conversion, notes: values.notes })} onSaved={updated => { query.setData(previous => previous ? { ...previous, defaults: previous.defaults.map(row => row.id === updated.id ? updated : row) } : previous); setNotice('Budgetvorlage gespeichert.'); }} onClose={() => setEditing(null)} /> : null}
  </>;
}
