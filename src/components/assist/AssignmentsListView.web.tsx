import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { useFlowRouter } from '@/hooks/useFlowRouter';
import { useAssignmentList } from '@/hooks/useAssignmentList.web';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { deleteVisitDisposition } from '@/lib/assist/visitService';
import { confirmAction } from '@/lib/platform/confirmAction';
import { formatDate, formatTime, formatTimeRange, formatDurationMinutes, formatAssignmentWeekdayDate } from '@/lib/formatters/dateTimeFormatters';
import { VISIT_BILLING_STATUS_LABELS, VISIT_PROOF_STATUS_LABELS, type VisitBillingStatus, type VisitProofStatus } from '@/lib/assist/visitTypes';
import { ASSIGNMENT_WORKSPACE_STATUS_LABELS, resolveAssignmentWorkspaceStatus, type AssignmentWorkspaceStatusFilter } from '@/lib/assist/assignmentWorkspaceModel.web';
import type { AssignmentListItem } from '@/types/modules/assist';
import { AssignmentCreateForm } from './AssignmentCreateForm.web';
import { AssignmentsWorkspaceShell, AssignmentsWorkspaceStyles, AssignmentWorkspaceIcon as Icon } from './AssignmentsWorkspaceShell.web';
import { assignmentsListCss } from './assignmentsListCss.web';

type Props = {
  onAssignmentPress?: (id: string) => void; selectedId?: string | null; embedded?: boolean;
  externalRefreshKey?: number; createOpen?: boolean; initialCreateClientId?: string | null;
  initialCreateAssignmentDate?: string | null; initialCreateEmployeeId?: string | null;
  onCreateOpenChange?: (open: boolean) => void;
};
const tones: Record<string, string> = { planned: '#4c8ace', running: '#209f9f', follow_up: '#d49a43', completed: '#409866', cancelled: '#c76d74', draft: '#90a2b5', no_show: '#c97559' };
const dateBadge = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: 'short' });

function plannedDuration(item: AssignmentListItem) {
  const minutes = (Date.parse(item.scheduledEnd) - Date.parse(item.scheduledStart)) / 60_000;
  return Number.isFinite(minutes) && minutes > 0 ? formatDurationMinutes(Math.round(minutes)) : '';
}
function timeRange(item: AssignmentListItem) {
  const value = formatTimeRange(item.scheduledStart, item.scheduledEnd);
  return value ? `${value}${formatDate(item.scheduledStart) !== formatDate(item.scheduledEnd) ? ` · Ende ${formatDate(item.scheduledEnd)}` : ''}` : 'Zeitangabe fehlt';
}
function ProofChips({ item }: { item: AssignmentListItem }) {
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
  return chips.length ? <div className="awl-card-chips">{chips.map(chip => <span key={chip.label} className="aw-chip" data-tone={chip.tone}>{chip.label}</span>)}</div> : null;
}

export function AssignmentsListView(props: Props) {
  const { can, roleKey } = usePermissions();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  if (!roleKey || isPortalOnlyRole(roleKey) || !can('assist.assignments.view')) return <div className="aw-workspace"><AssignmentsWorkspaceStyles /><div className="aw-alert" data-tone="info" role="status">Sie haben keine Berechtigung, die Einsatzplanung zu öffnen.</div></div>;
  return <AssignmentsListContent key={JSON.stringify([tenantId, profile?.id, profile?.employeeId, profile?.roleKey])} {...props} />;
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
  const editable = useRef(canManage); editable.current = canManage;
  const filterId = useId();
  const searchId = useId();
  const wizardVisible = createOpen ?? internalCreate;
  const setWizardVisible = onCreateOpenChange ?? setInternalCreate;
  const refresh = list.refresh;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (externalRefreshKey > 0) void refresh(); }, [externalRefreshKey, refresh]);
  const open = useCallback((id: string) => {
    if (onAssignmentPress) onAssignmentPress(id);
    else router.push(`/assist/assignments/${encodeURIComponent(id)}` as never);
  }, [onAssignmentPress, router]);
  const edit = (id: string) => { if (canManage) router.push(`/assist/assignments/${encodeURIComponent(id)}/edit` as never); };
  const execute = (id: string) => { if (canExecute) router.push(`/assist/assignments/${encodeURIComponent(id)}/execute` as never); };
  const remove = async (item: AssignmentListItem) => {
    if (!canManage || !tenantId || lock.current) return;
    lock.current = true; setDeleting(item.id); setDeleteError(null); setDeleteSuccess(false);
    try {
      const confirmed = await confirmAction({ title: 'Einsatz endgültig löschen?', message: `${item.clientName} · ${formatAssignmentWeekdayDate(item.scheduledStart)}\n\nDer Einsatz und die damit verknüpften Einsatzdaten werden dauerhaft gelöscht. Dies kann nicht rückgängig gemacht werden.`, confirmLabel: 'Einsatz löschen' });
      if (!confirmed || !mounted.current || !editable.current) return;
      const result = await deleteVisitDisposition(item.id, tenantId, profile?.roleKey);
      if (!mounted.current || !editable.current) return;
      if (!result.ok) { setDeleteError(result.error); return; }
      list.dismissDeletedAssignment(item.id); setDeleteSuccess(true); void refresh();
    } catch { if (mounted.current) setDeleteError('Der Einsatz konnte nicht gelöscht werden. Bitte versuchen Sie es erneut.'); }
    finally { lock.current = false; if (mounted.current) setDeleting(null); }
  };
  const showAllFollowUp = () => { list.resetFilters(); list.setDateRange('all'); list.setStatusFilter('follow_up'); };
  const period = list.dateRangeOptions.find(option => option.key === list.dateRange)?.label ?? 'Auswahl';
  const stats = [
    { key: 'all', label: 'Einsätze im Zeitraum', value: list.workspaceStats.total, icon: 'calendar', tone: '#346caa', tint: '#e8f2ff' },
    { key: 'planned', label: 'Geplant', value: list.workspaceStats.planned, icon: 'clock', tone: '#29778f', tint: '#e8f6fa' },
    { key: 'running', label: 'In Durchführung', value: list.workspaceStats.running, icon: 'play', tone: '#2d8271', tint: '#e7f7ef' },
    { key: 'follow_up', label: 'Nachbearbeitung', value: list.workspaceStats.follow_up, icon: 'clipboard', tone: '#977029', tint: '#fbf1de' },
  ] as const;
  const actions = <>{canCalendar ? <button type="button" className="aw-button" onClick={() => router.push('/assist/kalender' as never)}><Icon name="calendar" size={18} />Kalender</button> : null}<button type="button" className="aw-button" disabled={list.loading || list.refreshing || !!deleting} onClick={() => void refresh()}><span className={list.refreshing ? 'aw-spin' : undefined}><Icon name="refresh" size={17} /></span>{list.refreshing ? 'Wird aktualisiert …' : 'Aktualisieren'}</button>{canManage ? <button type="button" className="aw-button aw-button--primary" onClick={() => setWizardVisible(true)}><Icon name="plus" size={18} />Neuer Einsatz</button> : null}</>;
  const actionButtons = (item: AssignmentListItem, table = false) => <>
    <button type="button" className={`aw-button ${table ? '' : 'aw-button--quiet'}`} onClick={() => open(item.id)}>{table ? 'Öffnen' : 'Einsatz öffnen'}<Icon name="arrow" size={15} /></button>
    <div className={table ? 'awl-table-actions' : 'awl-card-secondary'}>
      {canExecute ? <button type="button" className="aw-button aw-button--quiet" aria-label={`Durchführung und Nachbearbeitung für ${item.clientName} öffnen`} title="Durchführung & Nachbearbeitung" onClick={() => execute(item.id)}><Icon name="clipboard" size={16} /></button> : null}
      {canManage ? <><button type="button" className="aw-button aw-button--quiet" aria-label={`Einsatz für ${item.clientName} bearbeiten`} title="Einsatz bearbeiten" onClick={() => edit(item.id)}><Icon name="edit" size={16} /></button><button type="button" className="aw-button aw-button--quiet" aria-label={`Einsatz für ${item.clientName} löschen`} title="Einsatz löschen" disabled={!!deleting} onClick={() => void remove(item)}>{deleting === item.id ? <span className="aw-spin"><Icon name="refresh" size={16} /></span> : <Icon name="trash" size={16} />}</button></> : null}
    </div>
  </>;
  const content = <>
    <style>{assignmentsListCss}</style>
    {embedded ? <div className="awl-results-header"><h2>Einsätze</h2><div className="aw-actions">{actions}</div></div> : null}
    {!canManage ? <div className="aw-alert" data-tone="info">Sie können Einsätze ansehen. Zum Planen und Bearbeiten benötigen Sie die entsprechende Berechtigung.</div> : null}
    <section aria-label="Einsatzübersicht"><div className="awl-summary-label"><h2>{period}</h2><p>Kennzahlen für Zeitraum, Suche, Mitarbeitende und Leistung.</p></div><div className="awl-stats">{stats.map(stat => <button type="button" key={stat.key} className="awl-stat" aria-pressed={list.statusFilter === stat.key} onClick={() => list.setStatusFilter(stat.key)} style={{ '--awl-tone': stat.tone, '--awl-tint': stat.tint } as CSSProperties}><span className="awl-stat-icon"><Icon name={stat.icon} size={22} /></span><span className="awl-stat-copy"><strong>{list.loading ? '–' : stat.value}</strong><span>{stat.label}</span></span></button>)}</div></section>
    {list.allStats.follow_up > list.workspaceStats.follow_up ? <div className="awl-followup"><Icon name="clipboard" size={20} /><p><strong>{list.allStats.follow_up} Einsätze benötigen Nachbearbeitung.</strong> Darunter können auch Einsätze außerhalb Ihrer aktuellen Auswahl sein.</p><button type="button" className="aw-button aw-button--quiet" onClick={showAllFollowUp}>Alle prüfen <Icon name="arrow" size={15} /></button></div> : null}
    <section className="awl-controls" aria-label="Einsätze suchen und filtern"><div className="awl-control-row">
      <label className="aw-field" htmlFor={searchId}><span className="aw-label">Einsatz suchen</span><div className="awl-search"><Icon name="search" size={19} /><input id={searchId} type="search" className="aw-input" value={list.search} onChange={event => list.setSearch(event.target.value)} placeholder="Name, Leistung, Ort oder Einsatznummer" />{list.search ? <button type="button" className="awl-search-clear" aria-label="Suche leeren" onClick={() => list.setSearch('')}><Icon name="close" size={16} /></button> : null}</div></label>
      <label className="aw-field"><span className="aw-label">Zeitraum</span><select className="aw-select" value={list.dateRange} onChange={event => list.setDateRange(event.target.value as typeof list.dateRange)}>{list.dateRangeOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
      <div className="awl-toolbar-actions"><button type="button" className="aw-button" aria-expanded={filtersOpen} aria-controls={filterId} onClick={() => setFiltersOpen(value => !value)}><Icon name="filter" size={17} />{filtersOpen ? 'Weniger Filter' : 'Weitere Filter'}</button><div className="awl-view-toggle" role="group" aria-label="Darstellung"><button type="button" aria-label="Kartenansicht" title="Kartenansicht" aria-pressed={viewMode === 'cards'} onClick={() => setViewMode('cards')}><Icon name="grid" size={18} /></button><button type="button" aria-label="Tabellenansicht" title="Tabellenansicht" aria-pressed={viewMode === 'table'} onClick={() => setViewMode('table')}><Icon name="list" size={19} /></button></div></div>
    </div>
    {list.dateRange === 'custom' ? <div className="awl-date-inputs"><label className="aw-field"><span className="aw-label">Von</span><input className="aw-input" type="date" value={list.dateFrom} max={list.dateTo || undefined} onChange={event => list.setDateFrom(event.target.value)} aria-invalid={!!list.dateRangeError} /></label><label className="aw-field"><span className="aw-label">Bis</span><input className="aw-input" type="date" value={list.dateTo} min={list.dateFrom || undefined} onChange={event => list.setDateTo(event.target.value)} aria-invalid={!!list.dateRangeError} /></label></div> : null}
    {list.dateRangeError ? <p className="aw-alert" data-tone="warning" role="alert">{list.dateRangeError}</p> : null}
    {filtersOpen ? <div id={filterId} className="awl-more-filters"><label className="aw-field"><span className="aw-label">Status</span><select className="aw-select" value={list.statusFilter} onChange={event => list.setStatusFilter(event.target.value as AssignmentWorkspaceStatusFilter)}>{list.statusFilters.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label><label className="aw-field"><span className="aw-label">Mitarbeitende</span><select className="aw-select" value={list.employeeFilter} onChange={event => list.setEmployeeFilter(event.target.value)}>{list.employeeOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label><label className="aw-field"><span className="aw-label">Leistung</span><select className="aw-select" value={list.serviceFilter} onChange={event => list.setServiceFilter(event.target.value)}>{list.serviceOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label><label className="aw-field"><span className="aw-label">Sortierung</span><select className="aw-select" value={list.sortKey} onChange={event => list.setSortKey(event.target.value)}>{list.sortOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label></div> : null}
    <div className="awl-filter-footer"><span className="awl-sync" data-connected={list.isLiveConnected}>{list.isLiveConnected ? 'Änderungen werden automatisch übernommen' : 'Einsatzdaten werden regelmäßig aktualisiert'}</span>{list.hasActiveFilters ? <button type="button" className="aw-button aw-button--quiet" onClick={list.resetFilters}>Filter zurücksetzen · Heute</button> : null}</div></section>
    {list.refreshError ? <div className="aw-alert" data-tone="danger" role="alert"><span>Die Aktualisierung ist fehlgeschlagen: {list.refreshError}</span><button type="button" className="aw-button" onClick={() => void refresh()} disabled={list.refreshing}>Erneut versuchen</button></div> : null}
    {list.showSuccess ? <div className="aw-alert" data-tone="success" role="status">Einsatzliste aktualisiert.</div> : null}
    {deleteError ? <div className="aw-alert" data-tone="danger" role="alert">{deleteError}</div> : null}
    {deleteSuccess ? <div className="aw-alert" data-tone="success" role="status">Der Einsatz wurde gelöscht.</div> : null}
    <div className="awl-results-header"><div><h2>{period === 'Heute' ? 'Ihre Einsätze heute' : 'Einsätze in der Auswahl'}<span className="awl-result-count">{list.filteredCount}</span></h2><p>{list.totalCount} Einsätze insgesamt · {list.sortOptions.find(option => option.key === list.sortKey)?.label}</p></div><div className="awl-status-links" aria-label="Schneller Statusfilter">{(['all', 'planned', 'running', 'follow_up', 'completed'] as const).map(status => <button key={status} type="button" aria-pressed={list.statusFilter === status} onClick={() => list.setStatusFilter(status)}>{status === 'all' ? 'Alle' : ASSIGNMENT_WORKSPACE_STATUS_LABELS[status]}<span>{status === 'all' ? list.workspaceStats.total : list.workspaceStats[status]}</span></button>)}</div></div>
    {list.loading && !list.totalCount ? <div role="status" aria-label="Einsätze werden geladen"><span className="aw-sr-only">Einsätze werden geladen …</span><div className="awl-loading" aria-hidden="true">{[1, 2, 3].map(key => <div className="aw-skeleton" key={key} />)}</div></div>
      : list.error && !list.totalCount ? <div className="aw-empty" role="alert"><div className="aw-empty-icon"><Icon name="alert" size={24} /></div><h2>Einsätze konnten nicht geladen werden</h2><p>{list.error}</p><button type="button" className="aw-button" onClick={() => void refresh()}>Erneut versuchen</button></div>
      : !list.items.length ? <div className="aw-empty"><div className="aw-empty-icon"><Icon name="calendar" size={25} /></div><h2>{list.isEmpty ? 'Noch keine Einsätze geplant' : 'Keine Einsätze in dieser Auswahl'}</h2><p>{list.isEmpty ? 'Planen Sie einen Einsatz mit Klient:in, Mitarbeitenden und einem passenden Zeitfenster.' : 'Passen Sie den Zeitraum an oder ändern Sie Ihre Suche und Filter.'}</p><div className="aw-actions">{!list.isEmpty ? <button type="button" className="aw-button" onClick={() => { list.resetFilters(); list.setDateRange('all'); }}>Alle Einsätze anzeigen</button> : null}{canManage ? <button type="button" className="aw-button aw-button--primary" onClick={() => setWizardVisible(true)}>Einsatz planen</button> : null}</div></div>
      : viewMode === 'table' ? <div className="awl-table-wrap"><div className="awl-table-scroll" tabIndex={0} role="region" aria-label="Einsatztabelle, bei Bedarf seitlich scrollen"><table className="awl-table"><caption className="aw-sr-only">Einsätze im gewählten Zeitraum mit Termin, Leistung, Mitarbeitenden und Bearbeitungsstand</caption><colgroup><col style={{ width: '18%' }} /><col style={{ width: '24%' }} /><col style={{ width: '18%' }} /><col style={{ width: '20%' }} /><col style={{ width: '20%' }} /></colgroup><thead><tr><th scope="col" aria-sort={list.sortKey === 'time_asc' ? 'ascending' : list.sortKey === 'time_desc' ? 'descending' : 'none'}><button type="button" onClick={() => list.setSortKey(list.sortKey === 'time_asc' ? 'time_desc' : 'time_asc')}>Termin <span aria-hidden="true">{list.sortKey === 'time_desc' ? '↓' : '↑'}</span></button></th><th scope="col" aria-sort={list.sortKey === 'client_asc' ? 'ascending' : 'none'}><button type="button" onClick={() => list.setSortKey('client_asc')}>Klient:in & Leistung</button></th><th scope="col">Mitarbeitende & Ort</th><th scope="col">Bearbeitungsstand</th><th scope="col">Aktionen</th></tr></thead><tbody>{list.items.map(item => <tr key={item.id} data-selected={selectedId === item.id}><td><strong>{formatDate(item.scheduledStart) || 'Termin fehlt'}</strong><small>{timeRange(item)}</small><small>{plannedDuration(item) ? `${plannedDuration(item)} geplant` : ''}</small></td><td><button type="button" className="awl-name" onClick={() => open(item.id)}>{item.clientName || 'Name fehlt'}</button><small>{item.serviceName || item.title}</small></td><td>{item.employeeName || 'Noch nicht zugeordnet'}<small>{item.location || 'Kein Einsatzort hinterlegt'}</small></td><td><span className="aw-chip" data-tone={resolveAssignmentWorkspaceStatus(item)}>{ASSIGNMENT_WORKSPACE_STATUS_LABELS[resolveAssignmentWorkspaceStatus(item)]}</span><small>{item.proofStatus ? VISIT_PROOF_STATUS_LABELS[item.proofStatus as VisitProofStatus] : ''}</small></td><td><div className="awl-table-actions">{actionButtons(item, true)}</div></td></tr>)}</tbody></table></div><p className="awl-table-hint">Die Tabellenüberschriften „Termin“ und „Klient:in & Leistung“ sortieren die Liste. Bei wenig Platz seitlich scrollen.</p></div>
      : <div className="awl-card-grid">{list.items.map(item => {
        const status = resolveAssignmentWorkspaceStatus(item);
        const parsed = new Date(item.scheduledStart);
        const parts = Number.isFinite(parsed.getTime()) ? dateBadge.formatToParts(parsed) : [];
        return <article key={item.id} className="awl-card" data-selected={selectedId === item.id} style={{ '--awl-accent': tones[status] } as CSSProperties}><div className="awl-card-body"><div className="awl-card-top"><div className="awl-date-badge"><strong>{parts.find(part => part.type === 'day')?.value ?? '–'}</strong><small>{parts.find(part => part.type === 'month')?.value ?? 'Termin'}</small></div><div className="awl-card-statuses"><span className="aw-chip" data-tone={status}>{ASSIGNMENT_WORKSPACE_STATUS_LABELS[status]}</span>{item.isAtRisk ? <span className="aw-chip" data-tone="warning">Planung prüfen</span> : null}</div></div><div><h3><button type="button" className="awl-name" onClick={() => open(item.id)}>{item.clientName || 'Name fehlt'}</button></h3><p className="awl-service">{item.serviceName || item.title || 'Leistung nicht hinterlegt'}</p></div><div className="awl-time"><Icon name="clock" size={17} /><div><strong>{timeRange(item)}</strong><small>{formatAssignmentWeekdayDate(item.scheduledStart)}{plannedDuration(item) ? ` · ${plannedDuration(item)} geplant` : ''}</small></div></div><div className="awl-card-meta"><div><Icon name="person" size={16} /><span>{item.employeeName || 'Noch nicht zugeordnet'}</span></div><div><Icon name="location" size={16} /><span>{item.location || 'Kein Einsatzort hinterlegt'}</span></div></div><ProofChips item={item} />{item.actualStartAt || item.actualEndAt ? <div className="awl-lifecycle">{item.actualStartAt ? <span>Begonnen <strong>{formatTime(item.actualStartAt)}</strong></span> : null}{item.actualEndAt ? <span>Beendet <strong>{formatTime(item.actualEndAt)}</strong></span> : null}</div> : null}</div><footer className="awl-card-actions">{actionButtons(item)}</footer></article>;
      })}</div>}
    {list.items.length ? <div className="awl-pagination"><p>{list.items.length} von {list.filteredCount} passenden Einsätzen angezeigt</p>{list.hasMore ? <button type="button" className="aw-button" onClick={list.loadMore}>Weitere Einsätze anzeigen <Icon name="plus" size={16} /></button> : null}</div> : null}
    {canManage ? <AssignmentCreateForm visible={wizardVisible} initialClientId={initialCreateClientId} initialAssignmentDate={initialCreateAssignmentDate} initialEmployeeId={initialCreateEmployeeId} onClose={() => setWizardVisible(false)} onCreated={id => { if (!mounted.current) return; setWizardVisible(false); void refresh(); open(id); }} /> : null}
  </>;
  return embedded ? <div className="aw-workspace" data-cs-assignments-surface="light"><AssignmentsWorkspaceStyles /><div className="aw-content">{content}</div></div>
    : <AssignmentsWorkspaceShell title="Einsätze" description="Planung, Durchführung und Nachweise – mit einem klaren Überblick über den nächsten Schritt." actions={actions}>{content}</AssignmentsWorkspaceShell>;
}
