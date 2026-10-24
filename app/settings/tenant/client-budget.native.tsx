import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import {NativeP,NativeDiv,NativeLabel,NativeSelect,NativeOption,NativeButton,NativeArticle,NativeH2,NativeSpan,NativeDl,NativeDt,NativeDd,NativeFooter} from '@/components/layout/NativeWorkspaceElements.native';
import { useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePageTab } from "../../../src/hooks/usePageTab.native.ts";
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { CompanyClientSettingsFrame, CompanySettingsEditor, CompanySettingsFeedback } from "../../../src/components/company/CompanyClientSettings.native.tsx";
import { companyMoney, currentCompanyBudgetYear, fetchCompanyBudgetSettings, saveCompanyBudgetDefault } from "../../../src/lib/tenant/companyClientSettings.ts";
import type { TenantBudgetDefault } from '@/types/clientCore';
import type { RoleKey } from '@/types';
function TenantClientBudgetDefaultsScreen() {
    const tenantId = useServiceTenantId();
    const { roleKey, can } = usePermissions();
    return <CompanyClientSettingsFrame title="Budgetvorlagen" description="Hinterlegte Vorgaben für Budgetjahre und die Aufnahme neuer Klient:innen.">
    {!tenantId || !can('business.tenant.manage') ? <NativeP className="cs-company-empty">Für diesen Bereich benötigen Sie einen Unternehmenszugang mit Verwaltungsberechtigung.</NativeP> : <BudgetSettings key={`${tenantId}:${roleKey}`} tenantId={tenantId} roleKey={roleKey}/>}
  </CompanyClientSettingsFrame>;
}
function BudgetSettings({ tenantId, roleKey }: {
    tenantId: string;
    roleKey: RoleKey | null;
}) {
    const query = useAsyncQuery(() => fetchCompanyBudgetSettings(tenantId, roleKey), [tenantId, roleKey], { queryKey: `company-budget-settings:${tenantId}:${roleKey}` });
    const [year, setYear] = usePageTab('CompanyBudget.year', String(currentCompanyBudgetYear()));
    const [editing, setEditing] = useState<TenantBudgetDefault | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const years = Array.from(new Set([currentCompanyBudgetYear(), ...(query.data?.years ?? []).map(row => row.budgetYear)])).filter(Number.isInteger).sort((a, b) => b - a);
    const selectedYear = years.includes(Number(year)) ? Number(year) : currentCompanyBudgetYear();
    const yearRows = query.data?.years.filter(row => row.budgetYear === selectedYear) ?? [];
    const rows = query.data?.defaults.filter(row => yearRows.some(candidate => candidate.id === row.budgetYearId)) ?? [];
    const name = (row: TenantBudgetDefault) => query.data?.types.find(type => type.id === row.budgetTypeId)?.name || 'Budgetvorlage';
    const numberText = (amount: number | null, cents = false) => amount === null ? '' : String(cents ? amount / 100 : amount);
    return <>
    <CompanySettingsFeedback error={query.error ?? query.refreshError} message={notice} onRetry={() => void query.refresh()} loading={query.refreshing}/>
    <NativeDiv className="cs-client-settings-toolbar"><NativeDiv className="cs-company-field"><NativeLabel htmlFor="company-budget-year">Budgetjahr</NativeLabel><NativeSelect id="company-budget-year" value={selectedYear} onChange={event => { setYear(event.target.value); setNotice(null); }}>{years.map(value => <NativeOption key={value} value={value}>{value}</NativeOption>)}</NativeSelect></NativeDiv><NativeButton type="button" disabled={query.refreshing || query.loading} onClick={() => void query.refresh()}>{query.refreshing ? 'Wird aktualisiert …' : 'Aktualisieren'}</NativeButton></NativeDiv>
    <NativeP className="cs-client-settings-note">Diese Vorlagen gelten für neue Budgetzuordnungen. Bereits individuell hinterlegte Klient:innenbudgets werden hier nicht geändert.</NativeP>
    {query.loading && !query.data ? <NativeP className="cs-company-empty" role="status">Budgetvorlagen werden geladen …</NativeP> : !query.data ? null : !rows.length ? <NativeP className="cs-company-empty">Für {selectedYear} sind keine Budgetvorlagen hinterlegt. Wählen Sie ein anderes vorhandenes Jahr oder laden Sie die Angaben erneut.</NativeP> : <NativeDiv className="cs-client-settings-grid">{rows.map(row => {
                const type = query.data!.types.find(item => item.id === row.budgetTypeId);
                const activeYear = yearRows.find(item => item.id === row.budgetYearId)?.isActive;
                return <NativeArticle className="cs-client-settings-card" key={row.id}><NativeH2>{name(row)}</NativeH2><NativeP>{type?.description || `Budgetvorlage für ${selectedYear}`}</NativeP><NativeSpan className="cs-client-settings-subtle">{selectedYear} · {activeYear ? 'Aktives Budgetjahr' : 'Inaktives Budgetjahr'}{type?.period ? ` · ${{ monthly: 'Monatlich', yearly: 'Jährlich', quarterly: 'Vierteljährlich' }[type.period]}` : ''}</NativeSpan><NativeDl>
        <NativeDiv><NativeDt>Grundbetrag</NativeDt><NativeDd>{companyMoney(row.amountCents, true)}</NativeDd></NativeDiv><NativeDiv><NativeDt>Monatlicher Betrag</NativeDt><NativeDd>{companyMoney(row.monthlyAmountCents, true)}</NativeDd></NativeDiv><NativeDiv><NativeDt>Jährlicher Betrag</NativeDt><NativeDd>{companyMoney(row.yearlyAmountCents, true)}</NativeDd></NativeDiv><NativeDiv><NativeDt>Umrechnung</NativeDt><NativeDd>{row.conversionRatePct === null ? 'Nicht hinterlegt' : `${row.conversionRatePct} %`}</NativeDd></NativeDiv>
      </NativeDl>{row.notes ? <NativeP>{row.notes}</NativeP> : null}<NativeFooter><NativeButton type="button" onClick={() => { setNotice(null); setEditing(row); }}>Budgetvorlage bearbeiten</NativeButton></NativeFooter></NativeArticle>;
            })}</NativeDiv>}
    {editing ? <CompanySettingsEditor key={editing.id} title={`${name(editing)} · ${selectedYear}`} initial={{ amount: numberText(editing.amountCents, true), monthly: numberText(editing.monthlyAmountCents, true), yearly: numberText(editing.yearlyAmountCents, true), conversion: numberText(editing.conversionRatePct), notes: editing.notes ?? '' }} fields={[
                { key: 'amount', label: 'Grundbetrag in Euro', numeric: true, required: true, hint: 'Wird verwendet, wenn kein eigener Jahresbetrag hinterlegt ist.' },
                { key: 'monthly', label: 'Monatlicher Betrag in Euro', numeric: true, hint: 'Leer bedeutet: keine monatliche Vorgabe.' }, { key: 'yearly', label: 'Jährlicher Betrag in Euro', numeric: true, hint: 'Leer bedeutet: Grundbetrag verwenden.' },
                { key: 'conversion', label: 'Umrechnung in Prozent', numeric: true, hint: 'Optional, zwischen 0 und 100.' }, { key: 'notes', label: 'Hinweise zur Vorlage', multiline: true },
            ]} onSave={values => saveCompanyBudgetDefault(tenantId, roleKey, editing.id, { amount: values.amount, monthly: values.monthly, yearly: values.yearly, conversion: values.conversion, notes: values.notes })} onSaved={updated => { query.setData(previous => previous ? { ...previous, defaults: previous.defaults.map(row => row.id === updated.id ? updated : row) } : previous); setNotice('Budgetvorlage gespeichert.'); }} onClose={() => setEditing(null)}/> : null}
  </>;
}
export default withNativeWorkflowPage(TenantClientBudgetDefaultsScreen);
