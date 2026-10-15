import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { useEmployeeList } from '@/hooks/useEmployeeList';
import { usePermissions } from '@/hooks/usePermissions';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { resolveEmployeeDepartmentLabel, resolveEmployeeRoleLabel } from '@/lib/office/employeeCatalogLabels';
import { employeeDisplayName, employeeStatusLabel, personnelDate, selectPersonnel } from '@/lib/office/personnelExperience.web';
import type { EmployeeListItem } from '@/types/modules/employeeList';
import { clientRecordsCss } from './clientRecordsCss.web';
import { personnelCss } from './personnelCss.web';
import { PersonnelFolder, PersonnelIcon as Icon } from './PersonnelPrimitives.web';

type Props = {
  onEmployeePress?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  onCreatePress?: () => void;
  selectedId?: string | null;
  embedded?: boolean;
  refreshToken?: number;
};
function Status({ status }: { status: EmployeeListItem['status'] }) {
  return <span className={`cs-records-status cs-records-status--${status}`}><i />{employeeStatusLabel(status)}</span>;
}
function Contact({ employee }: { employee: EmployeeListItem }) {
  const phone = employee.phone?.replace(/[^\d+*#,;]/g, '');
  return <div className="pe-contact">{employee.email ? <a href={`mailto:${encodeURIComponent(employee.email)}`}><Icon name="mail" /><span>{employee.email}</span></a> : <small>E-Mail nicht hinterlegt</small>}{phone ? <a href={`tel:${phone}`}><Icon name="phone" /><span>{employee.phone}</span></a> : <small>Telefon nicht hinterlegt</small>}</div>;
}

export function EmployeesListExperience({ onEmployeePress, onOpenDetail, onCreatePress, selectedId, embedded = false, refreshToken = 0 }: Props) {
  const list = useEmployeeList();
  const { can, isReadOnly, roleLabel } = usePermissions();
  const router = useRouter();
  const { viewMode, setViewMode } = useDesktopListViewPreference('office.employees');
  const [department, setDepartment] = useState('all');
  const [limit, setLimit] = useState(12);
  const refresh = list.refresh;
  useEffect(() => { if (refreshToken > 0) void refresh(); }, [refreshToken, refresh]);
  useEffect(() => { setLimit(12); }, [list.search, list.statusFilter, list.sortKey, department]);
  const matches = useMemo(() => selectPersonnel(list.allItems, list.search, list.statusFilter, department, list.sortKey), [list.allItems, list.search, list.statusFilter, department, list.sortKey]);
  const departments = useMemo(() => [...new Set(list.allItems.map(item => item.department).filter((value): value is string => !!value))].sort((a, b) => resolveEmployeeDepartmentLabel(a).localeCompare(resolveEmployeeDepartmentLabel(b), 'de')), [list.allItems]);
  const statusOptions = useMemo(() => [...new Set([...list.statusFilters.map(option => option.key), ...list.allItems.map(item => item.status)])], [list.statusFilters, list.allItems]);
  const filtered = !!list.search || list.statusFilter !== 'all' || department !== 'all';
  const canCreate = can('office.employees.create') && !isReadOnly;
  const open = onOpenDetail ?? onEmployeePress ?? ((id: string) => router.push(`/business/office/employees/${id}/personnel` as never));
  const select = onEmployeePress ?? open;
  const create = onCreatePress ?? (() => router.push('/business/office/employees/new' as never));
  const reset = () => { list.resetFilters(); setDepartment('all'); };
  const metrics = [
    { key: 'all', label: 'Alle Personalakten', hint: 'gesamter Bestand', value: list.allItems.length },
    { key: 'aktiv', label: 'Aktiv im Team', hint: 'aktuell beschäftigt', value: list.allItems.filter(item => item.status === 'aktiv').length },
    { key: 'archiviert', label: 'Archivierte Akten', hint: 'abgelegte Personalakten', value: list.allItems.filter(item => item.status === 'archiviert').length },
    { key: 'entwurf', label: 'Entwürfe', hint: 'Angaben vervollständigen', value: list.allItems.filter(item => item.status === 'entwurf').length },
  ];
  if (!can('office.employees.view')) return <div className="pe-empty" role="status"><h2>Personalbereich nicht freigegeben</h2><p>Ihre Rolle hat keinen Zugriff auf Personalakten.</p></div>;
  const items = matches.slice(0, limit);
  return <div className={`cs-records pe-list${embedded ? ' cs-records--embedded' : ''}`}>
    <style>{clientRecordsCss + personnelCss}</style>
    <div className="cs-records-scroll">
      <header className="cs-records-hero">
        <div className="cs-records-hero-copy"><span className="cs-records-eyebrow">Personal · Ihr Team</span><h1>Menschen. Aufgaben. Überblick.</h1><p>Personalakten, Einstieg und Zusammenarbeit an einem Ort.</p><div className="cs-records-connection"><span className={`cs-records-connection-dot${list.isLiveConnected ? ' is-connected' : ''}`} />{list.isLiveConnected ? 'Änderungen werden automatisch geladen' : 'Aktualisierung über die Schaltfläche möglich'}{isReadOnly ? <span className="cs-records-readonly">Nur lesen · {roleLabel}</span> : null}</div></div>
        <div className="cs-records-hero-actions">{canCreate ? <button className="cs-records-button cs-records-button--primary" onClick={create}><Icon name="plus" />Mitarbeitende anlegen</button> : null}<div className="cs-records-secondary-actions">{can('tenant.settings.csv.view') ? <button className="cs-records-button cs-records-button--inverse" onClick={() => router.push('/business/office/settings/csv-import-export?tab=employees-import' as never)}><Icon name="import" />Import / Export</button> : null}<button className="cs-records-button cs-records-button--inverse" disabled={list.loading || list.refreshing} onClick={() => void refresh()}><Icon name="refresh" />{list.refreshing ? 'Wird geladen …' : 'Aktualisieren'}</button></div></div>
      </header>
      {!embedded ? <nav className="cs-records-kpis" aria-label="Personal nach Status filtern">{metrics.map((metric, index) => <button key={metric.key} type="button" className={`cs-records-kpi${!list.search && department === 'all' && list.statusFilter === metric.key ? ' is-active' : ''}`} aria-pressed={!list.search && department === 'all' && list.statusFilter === metric.key} onClick={() => { list.setSearch(''); setDepartment('all'); list.setStatusFilter(metric.key as typeof list.statusFilter); }}><span className="cs-records-kpi-title"><i className={`cs-records-kpi-dot cs-records-kpi-dot--${index}`} />{metric.label}<Icon name="arrow" /></span><strong>{list.loading && !list.allItems.length ? '—' : metric.value}</strong><span>{metric.hint}</span></button>)}</nav> : null}
      <section className="cs-records-workspace" aria-label="Personalakten">
        <div className="pe-toolbar"><div className="pe-toolbar-title"><h2>Das Team</h2><span aria-live="polite">{matches.length} {matches.length === 1 ? 'Personalakte' : 'Personalakten'}</span></div><div className="cs-records-view-toggle" role="group" aria-label="Darstellung der Personalakten"><button aria-pressed={viewMode === 'table'} onClick={() => setViewMode('table')}><Icon name="list" /><span>Liste</span></button><button aria-pressed={viewMode === 'cards'} onClick={() => setViewMode('cards')}><Icon name="grid" /><span>Aktenkarten</span></button></div></div>
        <div className="pe-list-filters"><label className="pe-search"><Icon name="search" /><span className="cs-records-sr">Personal suchen</span><input type="search" placeholder="Name, Funktion, Abteilung oder Kontakt …" value={list.search} onChange={event => list.setSearch(event.target.value)} /></label><label>Status<select value={list.statusFilter} onChange={event => list.setStatusFilter(event.target.value as typeof list.statusFilter)}>{statusOptions.map(status => <option key={status} value={status}>{status === 'all' ? 'Alle Status' : employeeStatusLabel(status)}</option>)}</select></label><label>Abteilung<select value={department} onChange={event => setDepartment(event.target.value)}><option value="all">Alle Abteilungen</option>{departments.map(key => <option key={key} value={key}>{resolveEmployeeDepartmentLabel(key)}</option>)}</select></label><label>Sortierung<select value={list.sortKey} onChange={event => list.setSortKey(event.target.value)}><option value="name_asc">Name A–Z</option><option value="name_desc">Name Z–A</option><option value="role_asc">Funktion A–Z</option></select></label></div>
        {filtered ? <div className="pe-filter-summary"><span>{matches.length} von {list.allItems.length} Akten</span><button className="pe-text-button" onClick={reset}>Filter zurücksetzen<Icon name="close" /></button></div> : null}
        {list.error ? <div className="pe-notice pe-notice--error" role="alert"><div><strong>Die Personalakten konnten nicht aktualisiert werden.</strong><p>{list.error} {list.allItems.length ? 'Die zuletzt geladenen Angaben bleiben sichtbar.' : ''}</p></div><button className="cs-records-button" onClick={() => void refresh()}>Erneut versuchen</button></div> : null}
        {list.loading && !list.allItems.length ? <div className="cs-records-skeletons" aria-busy="true" aria-label="Personalakten werden geladen">{[1, 2, 3, 4].map(row => <div className="cs-records-skeleton" key={row}><i /><span /><span /></div>)}</div> : !items.length && !list.error ? <div className="cs-records-empty"><span className="cs-records-empty-icon"><Icon name={filtered ? 'search' : 'folder'} /></span><h2>{filtered ? 'Keine passende Personalakte gefunden' : 'Die erste Personalakte anlegen'}</h2><p>{filtered ? 'Ändern Sie die Suche oder setzen Sie die Filter zurück.' : 'Erfassen Sie die Person und ergänzen Sie danach Beschäftigung, Unterlagen und Zugänge in der Akte.'}</p>{filtered ? <button className="cs-records-button" onClick={reset}>Filter zurücksetzen</button> : canCreate ? <button className="cs-records-button cs-records-button--blue" onClick={create}>Mitarbeitende anlegen</button> : null}</div> : <div className={`cs-records-data cs-records-data--${viewMode}`} aria-busy={list.refreshing}>
          <div className="cs-records-table-scroll"><table className="cs-records-table pe-table"><thead><tr><th scope="col" aria-sort={list.sortKey === 'name_asc' ? 'ascending' : list.sortKey === 'name_desc' ? 'descending' : 'none'}><button onClick={() => list.setSortKey(list.sortKey === 'name_asc' ? 'name_desc' : 'name_asc')}>Mitarbeitende {list.sortKey === 'name_desc' ? '↓' : '↑'}</button></th><th scope="col">Funktion & Abteilung</th><th scope="col">Kontakt</th><th scope="col">Status</th><th scope="col">Aktualisiert</th><th scope="col"><span className="cs-records-sr">Personalakte öffnen</span></th></tr></thead><tbody>{items.map(employee => <tr key={employee.id} className={selectedId === employee.id ? 'is-selected' : undefined}>
            <td><button className="cs-records-identity" onClick={() => select(employee.id)}><PersonnelFolder {...employee} /><span><strong>{employeeDisplayName(employee)}</strong><small>Personalakte</small></span></button></td><td><strong>{resolveEmployeeRoleLabel(employee.jobTitle)}</strong><small>{resolveEmployeeDepartmentLabel(employee.department)}</small></td><td><Contact employee={employee} /></td><td><Status status={employee.status} /></td><td>{personnelDate(employee.updatedAt)}</td><td><button className="cs-records-open" onClick={() => open(employee.id)} aria-label={`Personalakte von ${employeeDisplayName(employee)} öffnen`}><span>Akte öffnen</span><Icon name="arrow" /></button></td>
          </tr>)}</tbody></table></div>
          <div className="cs-records-cards">{items.map(employee => <article className={`cs-records-card${selectedId === employee.id ? ' is-selected' : ''}`} key={employee.id}><div className="cs-records-card-top"><Status status={employee.status} /></div><button className="cs-records-card-identity" onClick={() => select(employee.id)}><PersonnelFolder {...employee} large /><strong>{employeeDisplayName(employee)}</strong><small>{resolveEmployeeRoleLabel(employee.jobTitle)}</small></button><div className="cs-records-card-details"><span>{resolveEmployeeDepartmentLabel(employee.department)}</span><Contact employee={employee} /></div><div className="cs-records-card-footer"><span>Aktualisiert<br /><strong>{personnelDate(employee.updatedAt)}</strong></span><button className="cs-records-open" onClick={() => open(employee.id)} aria-label={`Personalakte von ${employeeDisplayName(employee)} öffnen`}>Akte öffnen<Icon name="arrow" /></button></div></article>)}</div>
        </div>}
        {items.length ? <footer className="cs-records-footer"><span>{items.length} von {matches.length} Akten angezeigt</span>{items.length < matches.length ? <button className="cs-records-button" onClick={() => setLimit(value => value + 12)}>Weitere Akten laden<Icon name="arrow" /></button> : <span>Alle Treffer geladen</span>}</footer> : null}
      </section>
    </div>
  </div>;
}
