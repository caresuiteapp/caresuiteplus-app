import { useState } from 'react';
import { Text, View } from 'react-native';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import type { PermissionKey, RoleKey } from '@/types';
import type { TenantCustomFieldDefinition } from '@/types/tenant/tenantCenter';
import { loadCompanyCostCenters, saveCompanyCostCenter, type CompanyCostCenter } from '@/lib/tenant/companyCostCenters';
import { canEditCompanyCustomValue, companyCustomValueOptions, loadCompanyCustomValues, saveCompanyCustomValue } from '@/lib/tenant/companyCustomValues';
import { MobileButton, MobileCard, MobileChips, MobileSearch, MobileState, m } from '@/components/mobile/MobileWorkspace';
import { MobileSettingsEditor } from '@/components/mobile/MobileSettingsEditor';

type Scope = { tenantId: string; roleKey: RoleKey | null; effectivePermissions: readonly PermissionKey[] };
export function CompanyCostCentersPanel({ scope }: { scope: Scope }) {
  const query = useAsyncQuery(() => loadCompanyCostCenters(scope), [scope.tenantId, scope.roleKey], { queryKey: `native-cost-centers:${scope.tenantId}:${scope.roleKey}` });
  const [editing, setEditing] = useState<CompanyCostCenter | 'new' | null>(null); const [filter, setFilter] = useState('active'); const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const rows = (query.data?.costCenters ?? []).filter(row => (filter === 'all' || row.isActive === (filter === 'active')) && `${row.code} ${row.name}`.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de')));
  const existing = editing && editing !== 'new' ? editing : null;
  return <MobileCard><Text style={m.section}>Kostenstellen</Text><Text style={m.muted}>Ausgaben und Leistungen den passenden Arbeitsbereichen zuordnen.</Text>
    <MobileSearch value={search} onChangeText={setSearch} label="Kostenstelle suchen" /><MobileChips label="Kostenstellenstatus" value={filter} onChange={setFilter} items={[{ key: 'active', label: 'Aktiv' }, { key: 'inactive', label: 'Inaktiv' }, { key: 'all', label: 'Alle' }]} />
    {query.loading ? <MobileState loading title="Kostenstellen werden geladen" /> : null}{query.error || query.refreshError ? <MobileState title="Kostenstellen nicht verfügbar" message={query.error ?? query.refreshError ?? undefined} onRetry={() => void query.refresh()} /> : null}
    {rows.map(row => <View key={row.id} style={m.stack}><Text style={m.section}>{row.code} · {row.name}</Text><Text style={m.muted}>{row.isActive ? 'Aktiv' : 'Inaktiv'}{row.organizationId ? ` · ${query.data?.organizations.find(item => item.id === row.organizationId)?.name ?? 'Bisheriger Arbeitsbereich'}` : ''}</Text><MobileButton label="Kostenstelle bearbeiten" onPress={() => setEditing(row)} /></View>)}
    {!rows.length && query.data ? <Text style={m.muted}>Keine Kostenstellen für diese Auswahl.</Text> : null}{notice ? <Text accessibilityLiveRegion="polite" style={m.body}>{notice}</Text> : null}
    <View style={m.wrap}><MobileButton label="Kostenstelle anlegen" icon="plus" disabled={!query.data || query.loading || query.refreshing} onPress={() => setEditing('new')} /><MobileButton label="Aktualisieren" icon="refresh-cw" disabled={query.loading || query.refreshing} onPress={() => void query.refresh()} /></View>
    {editing ? <MobileSettingsEditor title={existing ? 'Kostenstelle bearbeiten' : 'Kostenstelle anlegen'} initial={{ code: existing?.code ?? '', name: existing?.name ?? '', organization: existing?.organizationId ?? '', active: existing?.isActive === false ? 'no' : 'yes' }} fields={[
      { key: 'code', label: 'Kürzel', required: true }, { key: 'name', label: 'Bezeichnung', required: true },
      { key: 'organization', label: 'Arbeitsbereich', options: Object.fromEntries((query.data?.organizations ?? []).filter(row => row.isActive || row.id === existing?.organizationId).map(row => [row.id, `${row.name}${row.isActive ? '' : ' · inaktiv'}`])) },
      { key: 'active', label: 'Status', required: true, options: { yes: 'Aktiv', no: 'Inaktiv' }, hint: 'Deaktivierte Kostenstellen bleiben für vorhandene Zuordnungen erhalten.' },
    ]} onSave={values => saveCompanyCostCenter(scope, { id: existing?.id, expectedUpdatedAt: existing?.updatedAt, code: values.code, name: values.name, organizationId: values.organization || null, isActive: values.active === 'yes' })} onSaved={saved => { query.setData(previous => previous ? { ...previous, costCenters: [...previous.costCenters.filter(row => row.id !== saved.id), saved].sort((a, b) => a.code.localeCompare(b.code, 'de')) } : previous); setNotice('Kostenstelle gespeichert.'); }} onClose={() => setEditing(null)} onReload={() => void query.refresh()} /> : null}
  </MobileCard>;
}

export function CompanyCustomValuesPanel({ scope, fields }: { scope: Scope; fields: readonly TenantCustomFieldDefinition[] }) {
  const editable = fields.filter(canEditCompanyCustomValue); const ids = editable.map(field => field.id!).sort().join(',');
  const query = useAsyncQuery(() => loadCompanyCustomValues(scope, ids ? ids.split(',') : []), [scope.tenantId, scope.roleKey, ids], { queryKey: `native-company-values:${scope.tenantId}:${scope.roleKey}:${ids}` });
  const [editing, setEditing] = useState<TenantCustomFieldDefinition | null>(null); const [notice, setNotice] = useState('');
  const value = editing ? query.data?.find(row => row.definitionId === editing.id) : null;
  return <MobileCard><Text style={m.section}>Eigene Unternehmensangaben</Text><Text style={m.muted}>Hinterlegte Angaben für passende Dokumentvorlagen.</Text>
    {query.loading ? <MobileState loading title="Eigene Angaben werden geladen" /> : null}{query.error || query.refreshError ? <MobileState title="Angaben konnten nicht geladen werden" message={query.error ?? query.refreshError ?? undefined} onRetry={() => void query.refresh()} /> : null}
    {editable.map(field => { const row = query.data?.find(item => item.definitionId === field.id); return row ? <View key={field.id} style={m.stack}><Text style={m.label}>{field.label}</Text><Text style={m.body}>{row.value === null ? 'Nicht hinterlegt' : row.value === true ? 'Ja' : row.value === false ? 'Nein' : String(row.value)}</Text><MobileButton label={`${field.label} bearbeiten`} onPress={() => setEditing(field)} /></View> : null; })}
    {!editable.length ? <Text style={m.muted}>Legen Sie ein Feld an und geben Sie es für die Verwaltung frei.</Text> : null}{notice ? <Text accessibilityLiveRegion="polite" style={m.body}>{notice}</Text> : null}
    {editing && value ? <MobileSettingsEditor title={editing.label} initial={{ value: value.value === null ? '' : String(value.value) }} fields={[{ key: 'value', label: editing.label, required: editing.validation.required === true, numeric: editing.dataType === 'number', multiline: editing.dataType === 'multiline', hint: editing.dataType === 'date' ? 'Datum im Format JJJJ-MM-TT' : undefined, options: editing.dataType === 'boolean' ? { true: 'Ja', false: 'Nein' } : editing.dataType === 'select' ? Object.fromEntries(companyCustomValueOptions(editing).map(option => [option.value, option.label])) : undefined }]} onSave={values => saveCompanyCustomValue(scope, editing.id!, values.value, value.updatedAt)} onSaved={saved => { query.setData(previous => previous ? previous.map(row => row.definitionId === saved.definitionId ? saved : row) : previous); setNotice('Angabe gespeichert.'); }} onClose={() => setEditing(null)} onReload={() => void query.refresh()} /> : null}
  </MobileCard>;
}
