// Generated native presentation from src/components/office/EmployeesListExperience.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSpan,NativeI,NativeDiv,NativeA,NativeSmall,NativeH2,NativeP,NativeStyle,NativeHeader,NativeH1,NativeButton,NativeNav,NativeStrong,NativeSection,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeTable,NativeThead,NativeTr,NativeTh,NativeTbody,NativeTd,NativeArticle,NativeBr,NativeFooter,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { useEmployeeList } from '@/hooks/useEmployeeList';
import { usePermissions } from '@/hooks/usePermissions';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { resolveEmployeeDepartmentLabel, resolveEmployeeRoleLabel } from '@/lib/office/employeeCatalogLabels';
import { employeeDisplayName, employeeStatusLabel, personnelDate, selectPersonnel } from "../../lib/office/personnelExperience.native.ts";
import type { EmployeeListItem } from '@/types/modules/employeeList';
import { clientRecordsCss } from "./clientRecordsCss.native.ts";
import { personnelCss } from "./personnelCss.native.ts";
import { PersonnelFolder, PersonnelIcon as Icon } from "./PersonnelPrimitives.native.tsx";
type Props = {
    onEmployeePress?: (id: string) => void;
    onOpenDetail?: (id: string) => void;
    onCreatePress?: () => void;
    selectedId?: string | null;
    embedded?: boolean;
    refreshToken?: number;
};
function Status({ status }: {
    status: EmployeeListItem['status'];
}) {
    return <NativeSpan className={`cs-records-status cs-records-status--${status}`}><NativeI />{employeeStatusLabel(status)}</NativeSpan>;
}
function Contact({ employee }: {
    employee: EmployeeListItem;
}) {
    const phone = employee.phone?.replace(/[^\d+*#,;]/g, '');
    return <NativeDiv className="pe-contact">{employee.email ? <NativeA href={`mailto:${encodeURIComponent(employee.email)}`}><Icon name="mail"/><NativeSpan>{employee.email}</NativeSpan></NativeA> : <NativeSmall>E-Mail nicht hinterlegt</NativeSmall>}{phone ? <NativeA href={`tel:${phone}`}><Icon name="phone"/><NativeSpan>{employee.phone}</NativeSpan></NativeA> : <NativeSmall>Telefon nicht hinterlegt</NativeSmall>}</NativeDiv>;
}
export function EmployeesListExperience({ onEmployeePress, onOpenDetail, onCreatePress, selectedId, embedded = false, refreshToken = 0 }: Props) {
    const list = useEmployeeList();
    const { can, isReadOnly, roleLabel } = usePermissions();
    const router = useRouter();
    const { viewMode, setViewMode } = useDesktopListViewPreference('office.employees');
    const [department, setDepartment] = useState('all');
    const [limit, setLimit] = useState(12);
    const refresh = list.refresh;
    useEffect(() => { if (refreshToken > 0)
        void refresh(); }, [refreshToken, refresh]);
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
    if (!can('office.employees.view'))
        return <NativeDiv className="pe-empty" role="status"><NativeH2>Personalbereich nicht freigegeben</NativeH2><NativeP>Ihre Rolle hat keinen Zugriff auf Personalakten.</NativeP></NativeDiv>;
    const items = matches.slice(0, limit);
    return <NativeWorkspaceStyleScope css={[clientRecordsCss + personnelCss]}>{<NativeDiv className={`cs-records pe-list${embedded ? ' cs-records--embedded' : ''}`}>
    <NativeStyle>{clientRecordsCss + personnelCss}</NativeStyle>
    <NativeDiv className="cs-records-scroll">
      <NativeHeader className="cs-records-hero">
        <NativeDiv className="cs-records-hero-copy"><NativeSpan className="cs-records-eyebrow">Personal · Ihr Team</NativeSpan><NativeH1>Menschen. Aufgaben. Überblick.</NativeH1><NativeP>Personalakten, Einstieg und Zusammenarbeit an einem Ort.</NativeP><NativeDiv className="cs-records-connection"><NativeSpan className={`cs-records-connection-dot${list.isLiveConnected ? ' is-connected' : ''}`}/>{list.isLiveConnected ? 'Änderungen werden automatisch geladen' : 'Aktualisierung über die Schaltfläche möglich'}{isReadOnly ? <NativeSpan className="cs-records-readonly">Nur lesen · {roleLabel}</NativeSpan> : null}</NativeDiv></NativeDiv>
        <NativeDiv className="cs-records-hero-actions">{canCreate ? <NativeButton className="cs-records-button cs-records-button--primary" onClick={create}><Icon name="plus"/>Mitarbeitende anlegen</NativeButton> : null}<NativeDiv className="cs-records-secondary-actions">{can('tenant.settings.csv.view') ? <NativeButton className="cs-records-button cs-records-button--inverse" onClick={() => router.push('/business/office/settings/csv-import-export?tab=employees-import' as never)}><Icon name="import"/>Import / Export</NativeButton> : null}<NativeButton className="cs-records-button cs-records-button--inverse" disabled={list.loading || list.refreshing} onClick={() => void refresh()}><Icon name="refresh"/>{list.refreshing ? 'Wird geladen …' : 'Aktualisieren'}</NativeButton></NativeDiv></NativeDiv>
      </NativeHeader>
      {!embedded ? <NativeNav className="cs-records-kpis" aria-label="Personal nach Status filtern">{metrics.map((metric, index) => <NativeButton key={metric.key} type="button" className={`cs-records-kpi${!list.search && department === 'all' && list.statusFilter === metric.key ? ' is-active' : ''}`} aria-pressed={!list.search && department === 'all' && list.statusFilter === metric.key} onClick={() => { list.setSearch(''); setDepartment('all'); list.setStatusFilter(metric.key as typeof list.statusFilter); }}><NativeSpan className="cs-records-kpi-title"><NativeI className={`cs-records-kpi-dot cs-records-kpi-dot--${index}`}/>{metric.label}<Icon name="arrow"/></NativeSpan><NativeStrong>{list.loading && !list.allItems.length ? '—' : metric.value}</NativeStrong><NativeSpan>{metric.hint}</NativeSpan></NativeButton>)}</NativeNav> : null}
      <NativeSection className="cs-records-workspace" aria-label="Personalakten">
        <NativeDiv className="pe-toolbar"><NativeDiv className="pe-toolbar-title"><NativeH2>Das Team</NativeH2><NativeSpan aria-live="polite">{matches.length} {matches.length === 1 ? 'Personalakte' : 'Personalakten'}</NativeSpan></NativeDiv><NativeDiv className="cs-records-view-toggle" role="group" aria-label="Darstellung der Personalakten"><NativeButton aria-pressed={viewMode === 'table'} onClick={() => setViewMode('table')}><Icon name="list"/><NativeSpan>Liste</NativeSpan></NativeButton><NativeButton aria-pressed={viewMode === 'cards'} onClick={() => setViewMode('cards')}><Icon name="grid"/><NativeSpan>Aktenkarten</NativeSpan></NativeButton></NativeDiv></NativeDiv>
        <NativeDiv className="pe-list-filters"><NativeLabel className="pe-search"><Icon name="search"/><NativeSpan className="cs-records-sr">Personal suchen</NativeSpan><NativeInput type="search" placeholder="Name, Funktion, Abteilung oder Kontakt …" value={list.search} onChange={event => list.setSearch(event.target.value)}/></NativeLabel><NativeLabel>Status<NativeSelect value={list.statusFilter} onChange={event => list.setStatusFilter(event.target.value as typeof list.statusFilter)}>{statusOptions.map(status => <NativeOption key={status} value={status}>{status === 'all' ? 'Alle Status' : employeeStatusLabel(status)}</NativeOption>)}</NativeSelect></NativeLabel><NativeLabel>Abteilung<NativeSelect value={department} onChange={event => setDepartment(event.target.value)}><NativeOption value="all">Alle Abteilungen</NativeOption>{departments.map(key => <NativeOption key={key} value={key}>{resolveEmployeeDepartmentLabel(key)}</NativeOption>)}</NativeSelect></NativeLabel><NativeLabel>Sortierung<NativeSelect value={list.sortKey} onChange={event => list.setSortKey(event.target.value)}><NativeOption value="name_asc">Name A–Z</NativeOption><NativeOption value="name_desc">Name Z–A</NativeOption><NativeOption value="role_asc">Funktion A–Z</NativeOption></NativeSelect></NativeLabel></NativeDiv>
        {filtered ? <NativeDiv className="pe-filter-summary"><NativeSpan>{matches.length} von {list.allItems.length} Akten</NativeSpan><NativeButton className="pe-text-button" onClick={reset}>Filter zurücksetzen<Icon name="close"/></NativeButton></NativeDiv> : null}
        {list.error ? <NativeDiv className="pe-notice pe-notice--error" role="alert"><NativeDiv><NativeStrong>Die Personalakten konnten nicht aktualisiert werden.</NativeStrong><NativeP>{list.error} {list.allItems.length ? 'Die zuletzt geladenen Angaben bleiben sichtbar.' : ''}</NativeP></NativeDiv><NativeButton className="cs-records-button" onClick={() => void refresh()}>Erneut versuchen</NativeButton></NativeDiv> : null}
        {list.loading && !list.allItems.length ? <NativeDiv className="cs-records-skeletons" aria-busy="true" aria-label="Personalakten werden geladen">{[1, 2, 3, 4].map(row => <NativeDiv className="cs-records-skeleton" key={row}><NativeI /><NativeSpan /><NativeSpan /></NativeDiv>)}</NativeDiv> : !items.length && !list.error ? <NativeDiv className="cs-records-empty"><NativeSpan className="cs-records-empty-icon"><Icon name={filtered ? 'search' : 'folder'}/></NativeSpan><NativeH2>{filtered ? 'Keine passende Personalakte gefunden' : 'Die erste Personalakte anlegen'}</NativeH2><NativeP>{filtered ? 'Ändern Sie die Suche oder setzen Sie die Filter zurück.' : 'Erfassen Sie die Person und ergänzen Sie danach Beschäftigung, Unterlagen und Zugänge in der Akte.'}</NativeP>{filtered ? <NativeButton className="cs-records-button" onClick={reset}>Filter zurücksetzen</NativeButton> : canCreate ? <NativeButton className="cs-records-button cs-records-button--blue" onClick={create}>Mitarbeitende anlegen</NativeButton> : null}</NativeDiv> : <NativeDiv className={`cs-records-data cs-records-data--${viewMode}`} aria-busy={list.refreshing}>
          <NativeDiv className="cs-records-table-scroll"><NativeTable className="cs-records-table pe-table"><NativeThead><NativeTr><NativeTh scope="col" aria-sort={list.sortKey === 'name_asc' ? 'ascending' : list.sortKey === 'name_desc' ? 'descending' : 'none'}><NativeButton onClick={() => list.setSortKey(list.sortKey === 'name_asc' ? 'name_desc' : 'name_asc')}>Mitarbeitende {list.sortKey === 'name_desc' ? '↓' : '↑'}</NativeButton></NativeTh><NativeTh scope="col">Funktion & Abteilung</NativeTh><NativeTh scope="col">Kontakt</NativeTh><NativeTh scope="col">Status</NativeTh><NativeTh scope="col">Aktualisiert</NativeTh><NativeTh scope="col"><NativeSpan className="cs-records-sr">Personalakte öffnen</NativeSpan></NativeTh></NativeTr></NativeThead><NativeTbody>{items.map(employee => <NativeTr key={employee.id} className={selectedId === employee.id ? 'is-selected' : undefined}>
            <NativeTd><NativeButton className="cs-records-identity" onClick={() => select(employee.id)}><PersonnelFolder {...employee}/><NativeSpan><NativeStrong>{employeeDisplayName(employee)}</NativeStrong><NativeSmall>Personalakte</NativeSmall></NativeSpan></NativeButton></NativeTd><NativeTd><NativeStrong>{resolveEmployeeRoleLabel(employee.jobTitle)}</NativeStrong><NativeSmall>{resolveEmployeeDepartmentLabel(employee.department)}</NativeSmall></NativeTd><NativeTd><Contact employee={employee}/></NativeTd><NativeTd><Status status={employee.status}/></NativeTd><NativeTd>{personnelDate(employee.updatedAt)}</NativeTd><NativeTd><NativeButton className="cs-records-open" onClick={() => open(employee.id)} aria-label={`Personalakte von ${employeeDisplayName(employee)} öffnen`}><NativeSpan>Akte öffnen</NativeSpan><Icon name="arrow"/></NativeButton></NativeTd>
          </NativeTr>)}</NativeTbody></NativeTable></NativeDiv>
          <NativeDiv className="cs-records-cards">{items.map(employee => <NativeArticle className={`cs-records-card${selectedId === employee.id ? ' is-selected' : ''}`} key={employee.id}><NativeDiv className="cs-records-card-top"><Status status={employee.status}/></NativeDiv><NativeButton className="cs-records-card-identity" onClick={() => select(employee.id)}><PersonnelFolder {...employee} large/><NativeStrong>{employeeDisplayName(employee)}</NativeStrong><NativeSmall>{resolveEmployeeRoleLabel(employee.jobTitle)}</NativeSmall></NativeButton><NativeDiv className="cs-records-card-details"><NativeSpan>{resolveEmployeeDepartmentLabel(employee.department)}</NativeSpan><Contact employee={employee}/></NativeDiv><NativeDiv className="cs-records-card-footer"><NativeSpan>Aktualisiert<NativeBr /><NativeStrong>{personnelDate(employee.updatedAt)}</NativeStrong></NativeSpan><NativeButton className="cs-records-open" onClick={() => open(employee.id)} aria-label={`Personalakte von ${employeeDisplayName(employee)} öffnen`}>Akte öffnen<Icon name="arrow"/></NativeButton></NativeDiv></NativeArticle>)}</NativeDiv>
        </NativeDiv>}
        {items.length ? <NativeFooter className="cs-records-footer"><NativeSpan>{items.length} von {matches.length} Akten angezeigt</NativeSpan>{items.length < matches.length ? <NativeButton className="cs-records-button" onClick={() => setLimit(value => value + 12)}>Weitere Akten laden<Icon name="arrow"/></NativeButton> : <NativeSpan>Alle Treffer geladen</NativeSpan>}</NativeFooter> : null}
      </NativeSection>
    </NativeDiv>
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
