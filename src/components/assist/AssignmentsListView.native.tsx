// Generated native presentation from src/components/assist/AssignmentsListView.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeSpan,NativeButton,NativeStyle,NativeH2,NativeSection,NativeP,NativeStrong,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeTable,NativeCaption,NativeColgroup,NativeCol,NativeThead,NativeTr,NativeTh,NativeTbody,NativeTd,NativeSmall,NativeArticle,NativeH3,NativeFooter,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { useFlowRouter } from "../../hooks/useFlowRouter.ts";
import { useAssignmentList } from "../../hooks/useAssignmentList.native.ts";
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { deleteVisitDisposition } from '@/lib/assist/visitService';
import { confirmAction } from '@/lib/platform/confirmAction';
import { formatDate, formatTime, formatTimeRange, formatDurationMinutes, formatAssignmentWeekdayDate } from '@/lib/formatters/dateTimeFormatters';
import { VISIT_BILLING_STATUS_LABELS, VISIT_PROOF_STATUS_LABELS, type VisitBillingStatus, type VisitProofStatus } from '@/lib/assist/visitTypes';
import { ASSIGNMENT_WORKSPACE_STATUS_LABELS, resolveAssignmentWorkspaceStatus, type AssignmentWorkspaceStatusFilter } from "../../lib/assist/assignmentWorkspaceModel.ts";
import type { AssignmentListItem } from '@/types/modules/assist';
import { AssignmentCreateForm } from "./AssignmentCreateForm.native.tsx";
import { AssignmentsWorkspaceShell, AssignmentsWorkspaceStyles, AssignmentWorkspaceIcon as Icon } from "./AssignmentsWorkspaceShell.native.tsx";
import { assignmentsListCss } from "./assignmentsListCss.native.ts";
type Props = {
    onAssignmentPress?: (id: string) => void;
    selectedId?: string | null;
    embedded?: boolean;
    externalRefreshKey?: number;
    createOpen?: boolean;
    initialCreateClientId?: string | null;
    initialCreateAssignmentDate?: string | null;
    initialCreateEmployeeId?: string | null;
    onCreateOpenChange?: (open: boolean) => void;
};
const tones: Record<string, string> = { planned: '#4c8ace', running: '#209f9f', follow_up: '#d49a43', completed: '#409866', cancelled: '#c76d74', draft: '#90a2b5', no_show: '#c97559' };
const dateBadge = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: 'short' });
function plannedDuration(item: AssignmentListItem) {
    const minutes = (Date.parse(item.scheduledEnd) - Date.parse(item.scheduledStart)) / 60000;
    return Number.isFinite(minutes) && minutes > 0 ? formatDurationMinutes(Math.round(minutes)) : '';
}
function timeRange(item: AssignmentListItem) {
    const value = formatTimeRange(item.scheduledStart, item.scheduledEnd);
    return value ? `${value}${formatDate(item.scheduledStart) !== formatDate(item.scheduledEnd) ? ` · Ende ${formatDate(item.scheduledEnd)}` : ''}` : 'Zeitangabe fehlt';
}
function ProofChips({ item }: {
    item: AssignmentListItem;
}) {
    const group = resolveAssignmentWorkspaceStatus(item);
    const documentation = item.documentationStatus;
    const proof = item.proofStatus as VisitProofStatus | undefined;
    const billing = item.billingStatus as VisitBillingStatus | undefined;
    const chips = [
        ...(documentation === 'complete' ? [{ label: 'Dokumentation vollständig', tone: 'green' }] : documentation === 'review' ? [{ label: 'Dokumentation in Prüfung', tone: 'blue' }] : group === 'follow_up' ? [{ label: 'Dokumentation prüfen', tone: 'warning' }] : []),
        ...(proof && proof !== 'none' ? [{ label: VISIT_PROOF_STATUS_LABELS[proof] ?? 'Nachweis prüfen', tone: proof === 'signed' || proof === 'verified' ? 'green' : proof === 'rejected' ? 'red' : 'warning' }] : []),
        ...(billing && billing !== 'none' ? [{ label: VISIT_BILLING_STATUS_LABELS[billing] ?? 'Abrechnung prüfen', tone: billing === 'blocked' ? 'red' : billing === 'paid' ? 'green' : 'muted' }] : []),
        ...(item.internalPhotoReferences?.length ? [{ label: `${item.internalPhotoReferences.length} Anhänge`, tone: 'muted' }] : []),
    ];
    return chips.length ? <NativeDiv className="awl-card-chips">{chips.map(chip => <NativeSpan key={chip.label} className="aw-chip" data-tone={chip.tone}>{chip.label}</NativeSpan>)}</NativeDiv> : null;
}
export function AssignmentsListView(props: Props) {
    const { can, roleKey } = usePermissions();
    const tenantId = useServiceTenantId();
    const { profile } = useAuth();
    if (!roleKey || isPortalOnlyRole(roleKey) || !can('assist.assignments.view'))
        return <NativeWorkspaceStyleScope css={[assignmentsListCss]}>{<NativeDiv className="aw-workspace"><AssignmentsWorkspaceStyles /><NativeDiv className="aw-alert" data-tone="info" role="status">Sie haben keine Berechtigung, die Einsatzplanung zu öffnen.</NativeDiv></NativeDiv>}</NativeWorkspaceStyleScope>;
    return <NativeWorkspaceStyleScope css={[assignmentsListCss]}>{<AssignmentsListContent key={JSON.stringify([tenantId, profile?.id, profile?.employeeId, profile?.roleKey])} {...props}/>}</NativeWorkspaceStyleScope>;
}
function AssignmentsListContent({ onAssignmentPress, selectedId, embedded = false, externalRefreshKey = 0, createOpen, initialCreateClientId, initialCreateAssignmentDate, initialCreateEmployeeId, onCreateOpenChange }: Props) {
    const router = useFlowRouter();
    const list = useAssignmentList();
    const { can, roleKey } = usePermissions();
    const { profile } = useAuth();
    const tenantId = useServiceTenantId();
    const canManage = Boolean(roleKey && !isPortalOnlyRole(roleKey) && can('assist.assignments.view') && can('assist.assignments.manage'));
    const canExecute = Boolean(roleKey && !isPortalOnlyRole(roleKey) && can('assist.assignments.view') && can('assist.execution.manage'));
    const canCalendar = can('assist.assignments.view');
    const { viewMode, setViewMode } = useDesktopListViewPreference(`assist.assignments.workspace:${tenantId}:${profile?.id ?? ''}`, 'cards');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [internalCreate, setInternalCreate] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [deleteSuccess, setDeleteSuccess] = useState(false);
    const lock = useRef(false);
    const mounted = useRef(true);
    const editable = useRef(canManage);
    editable.current = canManage;
    const filterId = useId();
    const searchId = useId();
    const wizardVisible = createOpen ?? internalCreate;
    const setWizardVisible = onCreateOpenChange ?? setInternalCreate;
    const refresh = list.refresh;
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    useEffect(() => { if (externalRefreshKey > 0)
        void refresh(); }, [externalRefreshKey, refresh]);
    const open = useCallback((id: string) => {
        if (onAssignmentPress)
            onAssignmentPress(id);
        else
            router.push(`/assist/assignments/${encodeURIComponent(id)}` as never);
    }, [onAssignmentPress, router]);
    const edit = (id: string) => { if (canManage)
        router.push(`/assist/assignments/${encodeURIComponent(id)}/edit` as never); };
    const execute = (id: string) => { if (canExecute)
        router.push(`/assist/assignments/${encodeURIComponent(id)}/execute` as never); };
    const remove = async (item: AssignmentListItem) => {
        if (!canManage || !tenantId || lock.current)
            return;
        lock.current = true;
        setDeleting(item.id);
        setDeleteError(null);
        setDeleteSuccess(false);
        try {
            const confirmed = await confirmAction({ title: 'Einsatz endgültig löschen?', message: `${item.clientName} · ${formatAssignmentWeekdayDate(item.scheduledStart)}\n\nDer Einsatz und die damit verknüpften Einsatzdaten werden dauerhaft gelöscht. Dies kann nicht rückgängig gemacht werden.`, confirmLabel: 'Einsatz löschen' });
            if (!confirmed || !mounted.current || !editable.current)
                return;
            const result = await deleteVisitDisposition(item.id, tenantId, profile?.roleKey);
            if (!mounted.current || !editable.current)
                return;
            if (!result.ok) {
                setDeleteError(result.error);
                return;
            }
            list.dismissDeletedAssignment(item.id);
            setDeleteSuccess(true);
            void refresh();
        }
        catch {
            if (mounted.current)
                setDeleteError('Der Einsatz konnte nicht gelöscht werden. Bitte versuchen Sie es erneut.');
        }
        finally {
            lock.current = false;
            if (mounted.current)
                setDeleting(null);
        }
    };
    const showAllFollowUp = () => { list.resetFilters(); list.setDateRange('all'); list.setStatusFilter('follow_up'); };
    const period = list.dateRangeOptions.find(option => option.key === list.dateRange)?.label ?? 'Auswahl';
    const stats = [
        { key: 'all', label: 'Einsätze im Zeitraum', value: list.workspaceStats.total, icon: 'calendar', tone: '#346caa', tint: '#e8f2ff' },
        { key: 'planned', label: 'Geplant', value: list.workspaceStats.planned, icon: 'clock', tone: '#29778f', tint: '#e8f6fa' },
        { key: 'running', label: 'In Durchführung', value: list.workspaceStats.running, icon: 'play', tone: '#2d8271', tint: '#e7f7ef' },
        { key: 'follow_up', label: 'Nachbearbeitung', value: list.workspaceStats.follow_up, icon: 'clipboard', tone: '#977029', tint: '#fbf1de' },
    ] as const;
    const actions = <>{canCalendar ? <NativeButton type="button" className="aw-button" onClick={() => router.push('/assist/kalender' as never)}><Icon name="calendar" size={18}/>Kalender</NativeButton> : null}<NativeButton type="button" className="aw-button" disabled={list.loading || list.refreshing || !!deleting} onClick={() => void refresh()}><NativeSpan className={list.refreshing ? 'aw-spin' : undefined}><Icon name="refresh" size={17}/></NativeSpan>{list.refreshing ? 'Wird aktualisiert …' : 'Aktualisieren'}</NativeButton>{canManage ? <NativeButton type="button" className="aw-button aw-button--primary" onClick={() => setWizardVisible(true)}><Icon name="plus" size={18}/>Neuer Einsatz</NativeButton> : null}</>;
    const actionButtons = (item: AssignmentListItem, table = false) => <>
    <NativeButton type="button" className={`aw-button ${table ? '' : 'aw-button--quiet'}`} onClick={() => open(item.id)}>{table ? 'Öffnen' : 'Einsatz öffnen'}<Icon name="arrow" size={15}/></NativeButton>
    <NativeDiv className={table ? 'awl-table-actions' : 'awl-card-secondary'}>
      {canExecute ? <NativeButton type="button" className="aw-button aw-button--quiet" aria-label={`Durchführung und Nachbearbeitung für ${item.clientName} öffnen`} title="Durchführung & Nachbearbeitung" onClick={() => execute(item.id)}><Icon name="clipboard" size={16}/></NativeButton> : null}
      {canManage ? <><NativeButton type="button" className="aw-button aw-button--quiet" aria-label={`Einsatz für ${item.clientName} bearbeiten`} title="Einsatz bearbeiten" onClick={() => edit(item.id)}><Icon name="edit" size={16}/></NativeButton><NativeButton type="button" className="aw-button aw-button--quiet" aria-label={`Einsatz für ${item.clientName} löschen`} title="Einsatz löschen" disabled={!!deleting} onClick={() => void remove(item)}>{deleting === item.id ? <NativeSpan className="aw-spin"><Icon name="refresh" size={16}/></NativeSpan> : <Icon name="trash" size={16}/>}</NativeButton></> : null}
    </NativeDiv>
  </>;
    const content = <>
    <NativeStyle>{assignmentsListCss}</NativeStyle>
    {embedded ? <NativeDiv className="awl-results-header"><NativeH2>Einsätze</NativeH2><NativeDiv className="aw-actions">{actions}</NativeDiv></NativeDiv> : null}
    {!canManage ? <NativeDiv className="aw-alert" data-tone="info">Sie können Einsätze ansehen. Zum Planen und Bearbeiten benötigen Sie die entsprechende Berechtigung.</NativeDiv> : null}
    <NativeSection aria-label="Einsatzübersicht"><NativeDiv className="awl-summary-label"><NativeH2>{period}</NativeH2><NativeP>Kennzahlen für Zeitraum, Suche, Mitarbeitende und Leistung.</NativeP></NativeDiv><NativeDiv className="awl-stats">{stats.map(stat => <NativeButton type="button" key={stat.key} className="awl-stat" aria-pressed={list.statusFilter === stat.key} onClick={() => list.setStatusFilter(stat.key)} style={{ '--awl-tone': stat.tone, '--awl-tint': stat.tint } as CSSProperties}><NativeSpan className="awl-stat-icon"><Icon name={stat.icon} size={22}/></NativeSpan><NativeSpan className="awl-stat-copy"><NativeStrong>{list.loading ? '–' : stat.value}</NativeStrong><NativeSpan>{stat.label}</NativeSpan></NativeSpan></NativeButton>)}</NativeDiv></NativeSection>
    {list.allStats.follow_up > list.workspaceStats.follow_up ? <NativeDiv className="awl-followup"><Icon name="clipboard" size={20}/><NativeP><NativeStrong>{list.allStats.follow_up} Einsätze benötigen Nachbearbeitung.</NativeStrong> Darunter können auch Einsätze außerhalb Ihrer aktuellen Auswahl sein.</NativeP><NativeButton type="button" className="aw-button aw-button--quiet" onClick={showAllFollowUp}>Alle prüfen <Icon name="arrow" size={15}/></NativeButton></NativeDiv> : null}
    <NativeSection className="awl-controls" aria-label="Einsätze suchen und filtern"><NativeDiv className="awl-control-row">
      <NativeLabel className="aw-field" htmlFor={searchId}><NativeSpan className="aw-label">Einsatz suchen</NativeSpan><NativeDiv className="awl-search"><Icon name="search" size={19}/><NativeInput id={searchId} type="search" className="aw-input" value={list.search} onChange={event => list.setSearch(event.target.value)} placeholder="Name, Leistung, Ort oder Einsatznummer"/>{list.search ? <NativeButton type="button" className="awl-search-clear" aria-label="Suche leeren" onClick={() => list.setSearch('')}><Icon name="close" size={16}/></NativeButton> : null}</NativeDiv></NativeLabel>
      <NativeLabel className="aw-field"><NativeSpan className="aw-label">Zeitraum</NativeSpan><NativeSelect className="aw-select" value={list.dateRange} onChange={event => list.setDateRange(event.target.value as typeof list.dateRange)}>{list.dateRangeOptions.map(option => <NativeOption key={option.key} value={option.key}>{option.label}</NativeOption>)}</NativeSelect></NativeLabel>
      <NativeDiv className="awl-toolbar-actions"><NativeButton type="button" className="aw-button" aria-expanded={filtersOpen} aria-controls={filterId} onClick={() => setFiltersOpen(value => !value)}><Icon name="filter" size={17}/>{filtersOpen ? 'Weniger Filter' : 'Weitere Filter'}</NativeButton><NativeDiv className="awl-view-toggle" role="group" aria-label="Darstellung"><NativeButton type="button" aria-label="Kartenansicht" title="Kartenansicht" aria-pressed={viewMode === 'cards'} onClick={() => setViewMode('cards')}><Icon name="grid" size={18}/></NativeButton><NativeButton type="button" aria-label="Tabellenansicht" title="Tabellenansicht" aria-pressed={viewMode === 'table'} onClick={() => setViewMode('table')}><Icon name="list" size={19}/></NativeButton></NativeDiv></NativeDiv>
    </NativeDiv>
    {list.dateRange === 'custom' ? <NativeDiv className="awl-date-inputs"><NativeLabel className="aw-field"><NativeSpan className="aw-label">Von</NativeSpan><NativeInput className="aw-input" type="date" value={list.dateFrom} max={list.dateTo || undefined} onChange={event => list.setDateFrom(event.target.value)} aria-invalid={!!list.dateRangeError}/></NativeLabel><NativeLabel className="aw-field"><NativeSpan className="aw-label">Bis</NativeSpan><NativeInput className="aw-input" type="date" value={list.dateTo} min={list.dateFrom || undefined} onChange={event => list.setDateTo(event.target.value)} aria-invalid={!!list.dateRangeError}/></NativeLabel></NativeDiv> : null}
    {list.dateRangeError ? <NativeP className="aw-alert" data-tone="warning" role="alert">{list.dateRangeError}</NativeP> : null}
    {filtersOpen ? <NativeDiv id={filterId} className="awl-more-filters"><NativeLabel className="aw-field"><NativeSpan className="aw-label">Status</NativeSpan><NativeSelect className="aw-select" value={list.statusFilter} onChange={event => list.setStatusFilter(event.target.value as AssignmentWorkspaceStatusFilter)}>{list.statusFilters.map(option => <NativeOption key={option.key} value={option.key}>{option.label}</NativeOption>)}</NativeSelect></NativeLabel><NativeLabel className="aw-field"><NativeSpan className="aw-label">Mitarbeitende</NativeSpan><NativeSelect className="aw-select" value={list.employeeFilter} onChange={event => list.setEmployeeFilter(event.target.value)}>{list.employeeOptions.map(option => <NativeOption key={option.key} value={option.key}>{option.label}</NativeOption>)}</NativeSelect></NativeLabel><NativeLabel className="aw-field"><NativeSpan className="aw-label">Leistung</NativeSpan><NativeSelect className="aw-select" value={list.serviceFilter} onChange={event => list.setServiceFilter(event.target.value)}>{list.serviceOptions.map(option => <NativeOption key={option.key} value={option.key}>{option.label}</NativeOption>)}</NativeSelect></NativeLabel><NativeLabel className="aw-field"><NativeSpan className="aw-label">Sortierung</NativeSpan><NativeSelect className="aw-select" value={list.sortKey} onChange={event => list.setSortKey(event.target.value)}>{list.sortOptions.map(option => <NativeOption key={option.key} value={option.key}>{option.label}</NativeOption>)}</NativeSelect></NativeLabel></NativeDiv> : null}
    <NativeDiv className="awl-filter-footer"><NativeSpan className="awl-sync" data-connected={list.isLiveConnected}>{list.isLiveConnected ? 'Änderungen werden automatisch übernommen' : 'Einsatzdaten werden regelmäßig aktualisiert'}</NativeSpan>{list.hasActiveFilters ? <NativeButton type="button" className="aw-button aw-button--quiet" onClick={list.resetFilters}>Filter zurücksetzen · Heute</NativeButton> : null}</NativeDiv></NativeSection>
    {list.refreshError ? <NativeDiv className="aw-alert" data-tone="danger" role="alert"><NativeSpan>Die Aktualisierung ist fehlgeschlagen: {list.refreshError}</NativeSpan><NativeButton type="button" className="aw-button" onClick={() => void refresh()} disabled={list.refreshing}>Erneut versuchen</NativeButton></NativeDiv> : null}
    {list.showSuccess ? <NativeDiv className="aw-alert" data-tone="success" role="status">Einsatzliste aktualisiert.</NativeDiv> : null}
    {deleteError ? <NativeDiv className="aw-alert" data-tone="danger" role="alert">{deleteError}</NativeDiv> : null}
    {deleteSuccess ? <NativeDiv className="aw-alert" data-tone="success" role="status">Der Einsatz wurde gelöscht.</NativeDiv> : null}
    <NativeDiv className="awl-results-header"><NativeDiv><NativeH2>{period === 'Heute' ? 'Ihre Einsätze heute' : 'Einsätze in der Auswahl'}<NativeSpan className="awl-result-count">{list.filteredCount}</NativeSpan></NativeH2><NativeP>{list.totalCount} Einsätze insgesamt · {list.sortOptions.find(option => option.key === list.sortKey)?.label}</NativeP></NativeDiv><NativeDiv className="awl-status-links" aria-label="Schneller Statusfilter">{(['all', 'planned', 'running', 'follow_up', 'completed'] as const).map(status => <NativeButton key={status} type="button" aria-pressed={list.statusFilter === status} onClick={() => list.setStatusFilter(status)}>{status === 'all' ? 'Alle' : ASSIGNMENT_WORKSPACE_STATUS_LABELS[status]}<NativeSpan>{status === 'all' ? list.workspaceStats.total : list.workspaceStats[status]}</NativeSpan></NativeButton>)}</NativeDiv></NativeDiv>
    {list.loading && !list.totalCount ? <NativeDiv role="status" aria-label="Einsätze werden geladen"><NativeSpan className="aw-sr-only">Einsätze werden geladen …</NativeSpan><NativeDiv className="awl-loading" aria-hidden="true">{[1, 2, 3].map(key => <NativeDiv className="aw-skeleton" key={key}/>)}</NativeDiv></NativeDiv>
            : list.error && !list.totalCount ? <NativeDiv className="aw-empty" role="alert"><NativeDiv className="aw-empty-icon"><Icon name="alert" size={24}/></NativeDiv><NativeH2>Einsätze konnten nicht geladen werden</NativeH2><NativeP>{list.error}</NativeP><NativeButton type="button" className="aw-button" onClick={() => void refresh()}>Erneut versuchen</NativeButton></NativeDiv>
                : !list.items.length ? <NativeDiv className="aw-empty"><NativeDiv className="aw-empty-icon"><Icon name="calendar" size={25}/></NativeDiv><NativeH2>{list.isEmpty ? 'Noch keine Einsätze geplant' : 'Keine Einsätze in dieser Auswahl'}</NativeH2><NativeP>{list.isEmpty ? 'Planen Sie einen Einsatz mit Klient:in, Mitarbeitenden und einem passenden Zeitfenster.' : 'Passen Sie den Zeitraum an oder ändern Sie Ihre Suche und Filter.'}</NativeP><NativeDiv className="aw-actions">{!list.isEmpty ? <NativeButton type="button" className="aw-button" onClick={() => { list.resetFilters(); list.setDateRange('all'); }}>Alle Einsätze anzeigen</NativeButton> : null}{canManage ? <NativeButton type="button" className="aw-button aw-button--primary" onClick={() => setWizardVisible(true)}>Einsatz planen</NativeButton> : null}</NativeDiv></NativeDiv>
                    : viewMode === 'table' ? <NativeDiv className="awl-table-wrap"><NativeDiv className="awl-table-scroll" tabIndex={0} role="region" aria-label="Einsatztabelle, bei Bedarf seitlich scrollen"><NativeTable className="awl-table"><NativeCaption className="aw-sr-only">Einsätze im gewählten Zeitraum mit Termin, Leistung, Mitarbeitenden und Bearbeitungsstand</NativeCaption><NativeColgroup><NativeCol style={{ width: '18%' }}/><NativeCol style={{ width: '24%' }}/><NativeCol style={{ width: '18%' }}/><NativeCol style={{ width: '20%' }}/><NativeCol style={{ width: '20%' }}/></NativeColgroup><NativeThead><NativeTr><NativeTh scope="col" aria-sort={list.sortKey === 'time_asc' ? 'ascending' : list.sortKey === 'time_desc' ? 'descending' : 'none'}><NativeButton type="button" onClick={() => list.setSortKey(list.sortKey === 'time_asc' ? 'time_desc' : 'time_asc')}>Termin <NativeSpan aria-hidden="true">{list.sortKey === 'time_desc' ? '↓' : '↑'}</NativeSpan></NativeButton></NativeTh><NativeTh scope="col" aria-sort={list.sortKey === 'client_asc' ? 'ascending' : 'none'}><NativeButton type="button" onClick={() => list.setSortKey('client_asc')}>Klient:in & Leistung</NativeButton></NativeTh><NativeTh scope="col">Mitarbeitende & Ort</NativeTh><NativeTh scope="col">Bearbeitungsstand</NativeTh><NativeTh scope="col">Aktionen</NativeTh></NativeTr></NativeThead><NativeTbody>{list.items.map(item => <NativeTr key={item.id} data-selected={selectedId === item.id}><NativeTd><NativeStrong>{formatDate(item.scheduledStart) || 'Termin fehlt'}</NativeStrong><NativeSmall>{timeRange(item)}</NativeSmall><NativeSmall>{plannedDuration(item) ? `${plannedDuration(item)} geplant` : ''}</NativeSmall></NativeTd><NativeTd><NativeButton type="button" className="awl-name" onClick={() => open(item.id)}>{item.clientName || 'Name fehlt'}</NativeButton><NativeSmall>{item.serviceName || item.title}</NativeSmall></NativeTd><NativeTd>{item.employeeName || 'Noch nicht zugeordnet'}<NativeSmall>{item.location || 'Kein Einsatzort hinterlegt'}</NativeSmall></NativeTd><NativeTd><NativeSpan className="aw-chip" data-tone={resolveAssignmentWorkspaceStatus(item)}>{ASSIGNMENT_WORKSPACE_STATUS_LABELS[resolveAssignmentWorkspaceStatus(item)]}</NativeSpan><NativeSmall>{item.proofStatus ? VISIT_PROOF_STATUS_LABELS[item.proofStatus as VisitProofStatus] : ''}</NativeSmall></NativeTd><NativeTd><NativeDiv className="awl-table-actions">{actionButtons(item, true)}</NativeDiv></NativeTd></NativeTr>)}</NativeTbody></NativeTable></NativeDiv><NativeP className="awl-table-hint">Die Tabellenüberschriften „Termin“ und „Klient:in & Leistung“ sortieren die Liste. Bei wenig Platz seitlich scrollen.</NativeP></NativeDiv>
                        : <NativeDiv className="awl-card-grid">{list.items.map(item => {
                                const status = resolveAssignmentWorkspaceStatus(item);
                                const parsed = new Date(item.scheduledStart);
                                const parts = Number.isFinite(parsed.getTime()) ? dateBadge.formatToParts(parsed) : [];
                                return <NativeWorkspaceStyleScope css={[assignmentsListCss]}>{<NativeArticle key={item.id} className="awl-card" data-selected={selectedId === item.id} style={{ '--awl-accent': tones[status] } as CSSProperties}><NativeDiv className="awl-card-body"><NativeDiv className="awl-card-top"><NativeDiv className="awl-date-badge"><NativeStrong>{parts.find(part => part.type === 'day')?.value ?? '–'}</NativeStrong><NativeSmall>{parts.find(part => part.type === 'month')?.value ?? 'Termin'}</NativeSmall></NativeDiv><NativeDiv className="awl-card-statuses"><NativeSpan className="aw-chip" data-tone={status}>{ASSIGNMENT_WORKSPACE_STATUS_LABELS[status]}</NativeSpan>{item.isAtRisk ? <NativeSpan className="aw-chip" data-tone="warning">Planung prüfen</NativeSpan> : null}</NativeDiv></NativeDiv><NativeDiv><NativeH3><NativeButton type="button" className="awl-name" onClick={() => open(item.id)}>{item.clientName || 'Name fehlt'}</NativeButton></NativeH3><NativeP className="awl-service">{item.serviceName || item.title || 'Leistung nicht hinterlegt'}</NativeP></NativeDiv><NativeDiv className="awl-time"><Icon name="clock" size={17}/><NativeDiv><NativeStrong>{timeRange(item)}</NativeStrong><NativeSmall>{formatAssignmentWeekdayDate(item.scheduledStart)}{plannedDuration(item) ? ` · ${plannedDuration(item)} geplant` : ''}</NativeSmall></NativeDiv></NativeDiv><NativeDiv className="awl-card-meta"><NativeDiv><Icon name="person" size={16}/><NativeSpan>{item.employeeName || 'Noch nicht zugeordnet'}</NativeSpan></NativeDiv><NativeDiv><Icon name="location" size={16}/><NativeSpan>{item.location || 'Kein Einsatzort hinterlegt'}</NativeSpan></NativeDiv></NativeDiv><ProofChips item={item}/>{item.actualStartAt || item.actualEndAt ? <NativeDiv className="awl-lifecycle">{item.actualStartAt ? <NativeSpan>Begonnen <NativeStrong>{formatTime(item.actualStartAt)}</NativeStrong></NativeSpan> : null}{item.actualEndAt ? <NativeSpan>Beendet <NativeStrong>{formatTime(item.actualEndAt)}</NativeStrong></NativeSpan> : null}</NativeDiv> : null}</NativeDiv><NativeFooter className="awl-card-actions">{actionButtons(item)}</NativeFooter></NativeArticle>}</NativeWorkspaceStyleScope>;
                            })}</NativeDiv>}
    {list.items.length ? <NativeDiv className="awl-pagination"><NativeP>{list.items.length} von {list.filteredCount} passenden Einsätzen angezeigt</NativeP>{list.hasMore ? <NativeButton type="button" className="aw-button" onClick={list.loadMore}>Weitere Einsätze anzeigen <Icon name="plus" size={16}/></NativeButton> : null}</NativeDiv> : null}
    {canManage ? <AssignmentCreateForm visible={wizardVisible} initialClientId={initialCreateClientId} initialAssignmentDate={initialCreateAssignmentDate} initialEmployeeId={initialCreateEmployeeId} onClose={() => setWizardVisible(false)} onCreated={id => { if (!mounted.current)
        return; setWizardVisible(false); void refresh(); open(id); }}/> : null}
  </>;
    return embedded ? <NativeDiv className="aw-workspace" data-cs-assignments-surface="light"><AssignmentsWorkspaceStyles /><NativeDiv className="aw-content">{content}</NativeDiv></NativeDiv>
        : <AssignmentsWorkspaceShell title="Einsätze" description="Planung, Durchführung und Nachweise – mit einem klaren Überblick über den nächsten Schritt." actions={actions}>{content}</AssignmentsWorkspaceShell>;
}
