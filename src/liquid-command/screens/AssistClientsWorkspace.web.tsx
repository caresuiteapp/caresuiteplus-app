import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout/ScreenShell.web';
import { ClientAnimalAvatar } from '@/components/clients/ClientAnimalAvatar';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useLiveRefresh } from '@/hooks/core/useLiveRefresh';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';
import { fetchAssistClientsWorkspace } from '@/lib/assist/assistClientsWorkspaceService.web';
import {
  filterAssistWorkspaceClients,
  summarizeAssistWorkspaceClients,
  type AssistClientsWorkspaceSnapshot,
  type AssistWorkspaceClient,
  type AssistWorkspaceVisit,
} from '@/lib/assist/assistClientsWorkspaceModel.web';
import type { RoleKey } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import { assistClientsWorkspaceCss } from './assistClientsWorkspaceCss.web';

type Filter = 'all' | 'attention' | 'planned' | 'unplanned' | 'week';
type Sort = 'name' | 'next_visit' | 'attention';
type QueryParams = {
  clientId?: string | string[];
  record?: string | string[];
  assistSearch?: string | string[];
  assistFilter?: string | string[];
  assistSort?: string | string[];
  assistDetail?: string | string[];
};
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
const readFilter = (value: string): Filter => ['all', 'attention', 'planned', 'unplanned', 'week'].includes(value) ? value as Filter : 'all';
const readSort = (value: string): Sort => ['name', 'next_visit', 'attention'].includes(value) ? value as Sort : 'name';

function Icon({ name, size = 17 }: { name: 'people' | 'plus' | 'refresh' | 'search' | 'back' | 'arrow' | 'calendar'; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    people: <><circle cx="9" cy="7" r="3" /><path d="M3 20v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m3 10v-3a6 6 0 0 0-2-4" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    refresh: <path d="M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 3M19 16a8 8 0 0 1-13 3l-2-3" />,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    back: <path d="m14 5-7 7 7 7M7 12h14" />,
    arrow: <path d="m9 5 7 7-7 7" />,
    calendar: <><path d="M4 6h16v14H4zM4 10h16M8 3v5M16 3v5" /><path d="M8 14h2M14 14h2M8 17h2" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function dateLabel(value: string | null | undefined, year = true) {
  if (!value) return 'Nicht hinterlegt';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T12:00:00Z' : value);
  if (!Number.isFinite(date.getTime())) return 'Datum prüfen';
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', ...(year ? { year: 'numeric' as const } : {}) }).format(date);
}
function timeLabel(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Uhrzeit offen';
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
function visitTime(visit: AssistWorkspaceVisit) {
  const endDay = dateLabel(visit.scheduledEnd, false);
  const startDay = dateLabel(visit.scheduledStart, false);
  return timeLabel(visit.scheduledStart) + '–' + (endDay === startDay ? '' : endDay + ' ') + timeLabel(visit.scheduledEnd);
}
const phoneHref = (value: string | null | undefined) => {
  const number = (value ?? '').replace(/[^+\d]/g, '');
  return /^\+?\d{3,}$/.test(number) ? 'tel:' + number : null;
};
const emailHref = (value: string | null | undefined) => value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? 'mailto:' + encodeURIComponent(value) : null;
const visitEmployeeLabel = (visit: AssistWorkspaceVisit) => visit.employeeName || (visit.employeeId ? 'Mitarbeitende zugeordnet' : 'Mitarbeitende noch nicht zugeordnet');
const planningRoute = (clientId?: string | null) => '/assist/assignments?create=1' + (clientId ? '&clientId=' + encodeURIComponent(clientId) : '');

export function AssistClientsWorkspace() {
  const auth = useAuth();
  const tenantId = useServiceTenantId()?.trim() ?? '';
  const { roleKey, permissions, can } = usePermissions();
  const userId = auth.user?.id ?? '';
  const permissionKey = [...new Set(permissions)].sort().join(',');
  const scope = JSON.stringify([tenantId, userId, roleKey, permissionKey]);
  const allowed = Boolean(auth.authReady && auth.isAuthenticated && userId && tenantId && roleKey
    && !auth.portalSession && !isPortalOnlyRole(roleKey)
    && can('assist.access') && can('office.access') && can('office.clients.view'));

  return <ScreenShell title="Assist" contentOwnsHeader scroll={false}>
    <style>{assistClientsWorkspaceCss}</style>
    {!auth.authReady ? <section className="acw acw-state" role="status"><h1>Assist</h1><p>Zugang wird geprüft …</p></section>
      : allowed && roleKey ? <AssistWorkspaceContent key={scope} scope={scope} tenantId={tenantId} roleKey={roleKey} permissions={permissions} />
        : <section className="acw acw-state" role="status"><h1>Assist</h1><p>Für diese Übersicht benötigen Sie einen Verwaltungszugang und die Freigabe für Assist und Klient:innen.</p></section>}
  </ScreenShell>;
}

function AssistWorkspaceContent({ scope, tenantId, roleKey, permissions }: {
  scope: string; tenantId: string; roleKey: RoleKey; permissions: readonly PermissionKey[];
}) {
  const router = useRouter();
  const isFocused = useIsFocused();
  const wasFocused = useRef(isFocused);
  const params = useLocalSearchParams<QueryParams>();
  const requestedId = first(params.clientId) || first(params.record);
  const parameterSearch = first(params.assistSearch).slice(0, 180);
  const parameterFilter = readFilter(first(params.assistFilter));
  const parameterSort = readSort(first(params.assistSort));
  const [search, setSearch] = useState(parameterSearch);
  const [filter, setFilter] = useState<Filter>(parameterFilter);
  const [sort, setSort] = useState<Sort>(parameterSort);
  const [selectedId, setSelectedId] = useState<string | null>(requestedId || null);
  const [detailOpen, setDetailOpen] = useState(first(params.assistDetail) === '1' || Boolean(requestedId));
  const [selectionNotice, setSelectionNotice] = useState('');
  const appliedSelection = useRef<string | null>(null);
  const selectedRef = useRef(selectedId);
  const initialSelection = useRef(false);
  const rows = useRef(new Map<string, HTMLButtonElement>());
  const listPane = useRef<HTMLElement>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const detailPane = useRef<HTMLElement>(null);
  const canViewVisits = permissions.includes('assist.assignments.view');
  const canPlan = canViewVisits && permissions.includes('assist.assignments.manage');
  const canEditClient = permissions.includes('office.clients.edit');
  selectedRef.current = selectedId;

  const query = useAsyncQuery<AssistClientsWorkspaceSnapshot>(
    () => fetchAssistClientsWorkspace({ tenantId, roleKey, effectivePermissions: permissions }),
    [scope],
    { queryKey: 'assist-clients:' + scope },
  );
  useLiveRefresh({ enabled: isFocused, onRefresh: query.refresh, pollMs: 60000, refreshOnFocus: true });
  useEffect(() => {
    if (isFocused && !wasFocused.current) void query.refresh();
    wasFocused.current = isFocused;
  }, [isFocused, query.refresh]);
  const snapshot = query.data;
  const clients = useMemo(() => snapshot?.clients ?? [], [snapshot]);
  const summary = useMemo(() => summarizeAssistWorkspaceClients(clients, snapshot?.visitsAvailable ?? false), [clients, snapshot?.visitsAvailable]);
  const visibleClients = useMemo(() => {
    const matches = filterAssistWorkspaceClients(clients, search, filter === 'week' ? 'all' : filter)
      .filter(client => filter !== 'week' || (client.sevenDayVisitCount ?? 0) > 0);
    return [...matches].sort((left, right) => {
      if (sort === 'attention' && left.needsAttention !== right.needsAttention) return left.needsAttention ? -1 : 1;
      if (sort === 'next_visit') {
        const leftTime = left.nextVisit ? Date.parse(left.nextVisit.scheduledStart) : Infinity;
        const rightTime = right.nextVisit ? Date.parse(right.nextVisit.scheduledStart) : Infinity;
        if (leftTime !== rightTime) return leftTime - rightTime;
      }
      return (left.lastName + ' ' + left.firstName).localeCompare(right.lastName + ' ' + right.firstName, 'de');
    });
  }, [clients, search, filter, sort]);
  const selected = clients.find(client => client.id === selectedId) ?? null;
  const selectedVisible = selected && visibleClients.some(client => client.id === selected.id) ? selected : null;
  const staleError = query.refreshError || query.error;
  const refreshing = query.loading || query.refreshing;
  const period = snapshot ? dateLabel(snapshot.coverage.fromDate, false) + '–' + dateLabel(snapshot.coverage.toDate) : '90 Tage ab heute';
  const weekPeriod = snapshot ? dateLabel(snapshot.coverage.fromDate, false) + '–' + dateLabel(snapshot.coverage.sevenDayToDate, false) : 'Heute und die nächsten 6 Tage';

  useEffect(() => { setSearch(parameterSearch); }, [parameterSearch]);
  useEffect(() => { setFilter(parameterFilter); }, [parameterFilter]);
  useEffect(() => { setSort(parameterSort); }, [parameterSort]);
  useEffect(() => {
    if (!snapshot || !isFocused) return;
    if (appliedSelection.current !== requestedId) {
      appliedSelection.current = requestedId;
      if (requestedId) {
        const found = clients.some(client => client.id === requestedId);
        setSelectedId(found ? requestedId : null);
        setDetailOpen(found && first(params.assistDetail) !== '0');
        setSelectionNotice(found ? '' : 'Die verlinkte Person ist in dieser Assist-Übersicht nicht verfügbar. Bitte wählen Sie eine Person aus der Liste.');
      } else if (!initialSelection.current) {
        const id = clients[0]?.id ?? null;
        setSelectedId(id);
        setDetailOpen(false);
        if (id) router.setParams({ clientId: id, record: undefined, assistDetail: '0' });
      } else {
        setSelectedId(null);
        setDetailOpen(false);
      }
      initialSelection.current = true;
      return;
    }
    if (selectedRef.current && !clients.some(client => client.id === selectedRef.current)) {
      setSelectedId(null); setDetailOpen(false);
      setSelectionNotice('Die bisher ausgewählte Person ist nicht mehr aktiv Assist zugeordnet.');
      router.setParams({ clientId: undefined, record: undefined, assistDetail: undefined });
    }
  }, [snapshot, clients, requestedId, router, isFocused]);
  useEffect(() => {
    if (first(params.assistDetail) === '0') setDetailOpen(false);
    else if (first(params.assistDetail) === '1') setDetailOpen(true);
  }, [params.assistDetail]);

  function changeSearch(value: string) {
    const next = value.slice(0, 180);
    setSearch(next); setDetailOpen(false);
    router.setParams({ assistSearch: next || undefined, assistDetail: '0' });
  }
  function changeFilter(next: Filter) {
    setFilter(next); setDetailOpen(false);
    router.setParams({ assistFilter: next === 'all' ? undefined : next, assistDetail: '0' });
  }
  function resetFilters() {
    setSearch(''); setFilter('all'); setDetailOpen(false);
    router.setParams({ assistSearch: undefined, assistFilter: undefined, assistDetail: '0' });
  }
  function selectClient(id: string) {
    setSelectedId(id); setDetailOpen(true); setSelectionNotice('');
    selectedRef.current = id;
    router.setParams({ clientId: id, record: undefined, assistDetail: '1' });
    requestAnimationFrame(() => {
      if (detailPane.current) detailPane.current.scrollTop = 0;
      detailHeading.current?.focus({ preventScroll: true });
    });
  }
  function backToList() {
    setDetailOpen(false); router.setParams({ assistDetail: '0' });
    requestAnimationFrame(() => {
      const row = selectedRef.current ? rows.current.get(selectedRef.current) : null;
      if (row) { row.focus({ preventScroll: true }); row.scrollIntoView?.({ block: 'nearest' }); } else listPane.current?.focus({ preventScroll: true });
    });
  }
  const count = (value: number | null) => snapshot && value !== null ? String(value) : '—';

  return <section className="acw" data-assist-clients="workspace-v2" data-detail-open={Boolean(detailOpen && selectedVisible)}>
    <header className="acw-heading">
      <div className="acw-heading-main"><span className="acw-symbol"><Icon name="people" size={25} /></span><div><span className="acw-eyebrow">ASSIST</span><h1>Assist-Klient:innen</h1><p>Versorgung und nächste Einsätze im Überblick.</p></div></div>
      <div className="acw-heading-actions">
        {snapshot ? <span className="acw-sync">Stand {timeLabel(snapshot.loadedAt)} Uhr</span> : null}
        {canPlan ? <button type="button" className="acw-button acw-button-primary" onClick={() => router.push(planningRoute(selectedVisible?.id) as never)} aria-label={selectedVisible ? 'Einsatz für ' + selectedVisible.name + ' planen' : 'Neuen Einsatz planen'}><Icon name="plus" /><span>Einsatz planen</span></button> : null}
      </div>
    </header>

    <div className="acw-metrics" aria-label="Assist-Übersicht">
      <Metric label="Klient:innen" detail="Aktiv zugeordnet" value={count(summary.total)} active={filter === 'all'} onClick={() => changeFilter('all')} disabled={!snapshot} />
      <Metric label="Einsätze in 7 Tagen" detail={weekPeriod} value={count(summary.sevenDayVisits)} active={filter === 'week'} onClick={() => changeFilter('week')} disabled={!snapshot?.visitsAvailable} />
      <Metric label="Klärungsbedarf" detail="Angaben oder Zuständigkeit" value={count(summary.attention)} active={filter === 'attention'} onClick={() => changeFilter('attention')} disabled={!snapshot} warning={summary.attention > 0} />
      <Metric label="Ohne Einsatz" detail={snapshot ? 'Bis ' + dateLabel(snapshot.coverage.toDate) : 'Im Planungszeitraum'} value={count(summary.unplanned)} active={filter === 'unplanned'} onClick={() => changeFilter('unplanned')} disabled={!snapshot?.visitsAvailable} />
    </div>

    {staleError ? <div className="acw-message acw-message-error" role="alert"><p>{snapshot ? 'Die Übersicht konnte nicht aktualisiert werden. Angezeigt wird der zuletzt geladene Stand.' : 'Die Assist-Übersicht konnte nicht geladen werden.'}</p><p>{staleError}</p><button className="acw-button" type="button" disabled={refreshing} onClick={() => void query.refresh()}>Erneut laden</button></div> : null}
    {snapshot && !snapshot.visitsAvailable ? <div className="acw-message acw-message-warning" role="status"><p>{snapshot.visitsError || 'Für die Einsatzplanung liegt keine Lesefreigabe vor. Planungszahlen sind deshalb nicht verfügbar.'}</p>{snapshot.visitsError && canViewVisits ? <button className="acw-button" type="button" disabled={refreshing} onClick={() => void query.refresh()}>Planung erneut laden</button> : null}</div> : null}
    {snapshot?.warnings.length ? <div className="acw-message acw-message-warning" role="status">{snapshot.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div> : null}
    {selectionNotice ? <p className="acw-message acw-message-info" role="status">{selectionNotice}</p> : null}

    <div className="acw-body">
      <section className="acw-list-pane" aria-label="Assist-Klient:innen auswählen" tabIndex={-1} ref={listPane}>
        <div className="acw-toolbar">
          <div className="acw-search-line">
            <label className="acw-search"><span>Klient:innen durchsuchen</span><span className="acw-search-field"><Icon name="search" /><input type="search" autoComplete="off" maxLength={180} value={search} onChange={event => changeSearch(event.target.value)} placeholder="Name, Pflegegrad, Ort, Kasse oder Mitarbeitende" /></span></label>
            <button className="acw-button" type="button" disabled={refreshing} onClick={() => void query.refresh()} aria-label="Assist-Übersicht aktualisieren"><Icon name="refresh" /><span>{refreshing ? 'Lädt …' : 'Aktualisieren'}</span></button>
          </div>
          <div className="acw-filters" role="group" aria-label="Klientenliste filtern">
            {([
              ['all', 'Alle', summary.total],
              ['attention', 'Klärungsbedarf', summary.attention],
              ['planned', 'Mit Einsatz', summary.planned],
              ['unplanned', 'Ohne Einsatz', summary.unplanned],
              ['week', 'Nächste 7 Tage', null],
            ] as [Filter, string, number | null][]).map(([key, label, value]) => <button key={key} type="button" className="acw-filter" aria-pressed={filter === key} disabled={['planned', 'unplanned', 'week'].includes(key) && !snapshot?.visitsAvailable} onClick={() => changeFilter(key)}>{label}{value !== null && snapshot ? <span className="acw-filter-count">{value}</span> : null}</button>)}
          </div>
          <div className="acw-list-options"><span role="status">{snapshot ? visibleClients.length + ' von ' + clients.length + ' Personen' : 'Liste wird geladen'} · Planung {period}</span><label className="acw-sort">Sortieren<select value={sort} onChange={event => { const next = readSort(event.target.value); setSort(next); router.setParams({ assistSort: next === 'name' ? undefined : next }); }} aria-label="Klient:innen sortieren"><option value="name">Nach Name</option><option value="next_visit">Nächster Einsatz</option><option value="attention">Klärungsbedarf zuerst</option></select></label></div>
        </div>
        {!snapshot ? <div className="acw-empty" role="status"><h2>{query.loading ? 'Assist wird geladen …' : 'Keine Daten verfügbar'}</h2><p>{query.loading ? 'Zuordnungen und Einsatzplanung werden abgeglichen.' : 'Bitte laden Sie die Übersicht erneut.'}</p></div>
          : visibleClients.length === 0 ? <div className="acw-empty" role="status"><h2>{clients.length ? 'Keine passenden Klient:innen' : 'Noch keine aktiven Assist-Zuordnungen'}</h2><p>{clients.length ? 'Ändern Sie den Suchbegriff oder setzen Sie die Filter zurück.' : 'Aktivieren Sie Assist in der Klientenakte, damit die Person hier erscheint.'}</p>{clients.length ? <button className="acw-button" type="button" onClick={resetFilters}>Filter zurücksetzen</button> : <button className="acw-button" type="button" onClick={() => router.push('/business/office/modules/clients' as never)}>Zuordnungen öffnen</button>}</div>
            : <ul className="acw-rows" aria-label="Klientenliste">{visibleClients.map(client => <li key={client.id}>
              <button type="button" className="acw-row" aria-pressed={client.id === selectedId} onClick={() => selectClient(client.id)} ref={element => { if (element) rows.current.set(client.id, element); else rows.current.delete(client.id); }}>
                <span className="acw-row-avatar"><ClientAnimalAvatar clientId={client.id} clientName={client.name} size={37} ringColor="#9bc5e2" /></span>
                <span className="acw-row-copy"><span className="acw-row-heading"><strong className="acw-row-name">{client.name}</strong>{client.needsAttention ? <span className="acw-badge acw-badge-warning">Angaben prüfen</span> : null}</span>
                  <span className="acw-row-meta">{client.careLevelLabel}{client.city ? ' · ' + client.city : ''}{client.costCarrier ? ' · ' + client.costCarrier : client.selfPay ? ' · Selbstzahler' : ' · Kostenträger offen'}</span>
                  <span className="acw-row-planning"><Icon name="calendar" size={13} />{client.nextVisit ? <><strong>{dateLabel(client.nextVisit.scheduledStart, false)}, {timeLabel(client.nextVisit.scheduledStart)}</strong><span className="acw-dot">·</span><small>{visitEmployeeLabel(client.nextVisit)}</small>{client.nextVisit.status === 'active' ? <span className="acw-badge acw-badge-active">Läuft</span> : null}</> : <span>{client.planningStatus === 'unknown' ? 'Planung nicht verfügbar' : 'Kein Einsatz bis ' + dateLabel(snapshot.coverage.toDate)}</span>}</span>
                </span>
              </button>
            </li>)}</ul>}
      </section>
      <aside className={'acw-detail-pane' + (!selectedVisible ? ' acw-detail-empty' : '')} aria-label="Ausgewählte Klient:in" ref={detailPane}>
        {selectedVisible && snapshot ? <ClientDetails key={selectedVisible.id} client={selectedVisible} snapshot={snapshot} canPlan={canPlan} canEditClient={canEditClient} onBack={backToList} headingRef={detailHeading} navigate={route => router.push(route as never)} />
          : <div className="acw-empty"><h2>Klient:in auswählen</h2><p>{selected && !selectedVisible ? 'Die ausgewählte Person passt nicht zur aktuellen Suche oder zum Filter.' : 'Wählen Sie eine Person für Kontaktdaten, Einsatzplanung und direkte Aktionen.'}</p>{selected && !selectedVisible ? <button type="button" className="acw-button" onClick={resetFilters}>Filter zurücksetzen</button> : null}</div>}
      </aside>
    </div>
  </section>;
}

function Metric({ label, detail, value, active, disabled, warning, onClick }: {
  label: string; detail: string; value: string; active: boolean; disabled?: boolean; warning?: boolean; onClick: () => void;
}) {
  return <button className={'acw-metric' + (warning ? ' acw-metric-warning' : '')} type="button" aria-pressed={active} disabled={disabled} onClick={onClick}><span className="acw-metric-number">{value}</span><span className="acw-metric-copy"><strong>{label}</strong><small>{detail}</small></span></button>;
}

function ClientDetails({ client, snapshot, canPlan, canEditClient, onBack, headingRef, navigate }: {
  client: AssistWorkspaceClient; snapshot: AssistClientsWorkspaceSnapshot; canPlan: boolean; canEditClient: boolean; onBack: () => void;
  headingRef: RefObject<HTMLHeadingElement | null>; navigate: (route: string) => void;
}) {
  const [visitLimit, setVisitLimit] = useState(5);
  const record = clientRecordRoute(client.id);
  const phone = phoneHref(client.phone);
  const mobile = phoneHref(client.mobile);
  const email = emailHref(client.email);
  return <div className="acw-detail">
    <button type="button" className="acw-button acw-button-quiet acw-back" onClick={onBack}><Icon name="back" />Zur Liste</button>
    <div className="acw-detail-top"><ClientAnimalAvatar clientId={client.id} clientName={client.name} size={49} ringColor="#80b7dc" /><div className="acw-detail-name"><span className="acw-eyebrow">{client.clientNumber ? 'KLIENT:IN · ' + client.clientNumber : 'AUSGEWÄHLTE PERSON'}</span><h2 ref={headingRef} tabIndex={-1}>{client.name}</h2><div className="acw-detail-status"><span className={'acw-badge' + (client.statusLabel === 'Aktiv' ? '' : ' acw-badge-neutral')}>{client.statusLabel}</span>{client.needsAttention ? <span className="acw-badge acw-badge-warning">Klärungsbedarf</span> : null}</div></div></div>
    <div className="acw-detail-actions" aria-label={'Aktionen für ' + client.name}>
      {canPlan ? <button type="button" className="acw-button acw-button-primary" onClick={() => navigate(planningRoute(client.id))}><Icon name="plus" /><span>Einsatz planen</span></button> : null}
      <button type="button" className="acw-button" onClick={() => navigate(record)}>Klientenakte</button>
      <button type="button" className="acw-button" onClick={() => navigate('/assist/abrechnungsquellen?clientId=' + encodeURIComponent(client.id))}>Budget öffnen</button>
      <button type="button" className="acw-button" onClick={() => navigate(record + '?tab=portal')}>Portal & Freigaben</button>
    </div>
    {client.missingFields.length ? <div className="acw-message acw-message-warning"><strong>Diese Angaben fehlen</strong><ul className="acw-missing-list">{client.missingFields.map(field => <li key={field}>{field}</li>)}</ul><button className="acw-button" type="button" onClick={() => navigate(record + (canEditClient ? '?edit=1' : '?tab=stammdaten'))}>{canEditClient ? 'Stammdaten ergänzen' : 'Stammdaten ansehen'}</button></div> : null}
    {client.warnings?.length ? <div className="acw-message acw-message-warning">{client.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div> : null}
    <dl className="acw-facts">
      <div className="acw-fact"><dt>Pflegegrad</dt><dd>{client.careLevelLabel}</dd></div>
      <div className="acw-fact"><dt>Geburtsdatum</dt><dd>{dateLabel(client.dateOfBirth)}</dd></div>
      <div className="acw-fact acw-fact-wide" data-testid="assist-client-carrier"><dt>Kostenträger</dt><dd>{client.costCarrier || (client.selfPay ? 'Selbstzahler' : 'Nicht hinterlegt')}<small>{client.insuranceNumber ? 'Versichertennummer: ' + client.insuranceNumber : client.selfPay ? 'Private Abrechnung' : 'Versichertennummer nicht hinterlegt'}</small></dd></div>
      <div className="acw-fact acw-fact-wide"><dt>Feste Zuständigkeit</dt><dd>{client.primaryEmployeeName || (client.primaryEmployeeId ? 'Mitarbeitende zugeordnet' : 'Noch nicht festgelegt')}<small>Die Einsatzplanung kann abweichende Mitarbeitende enthalten.</small></dd></div>
    </dl>
    <section className="acw-section"><h3>Erreichbarkeit & Einsatzort</h3><p className="acw-address">{client.street || 'Straße nicht hinterlegt'}<br />{[client.postalCode, client.city].filter(Boolean).join(' ') || 'Postleitzahl und Ort nicht hinterlegt'}</p><div className="acw-contacts">{phone ? <a href={phone} aria-label={client.name + ' anrufen: ' + client.phone}>{client.phone}</a> : null}{mobile && mobile !== phone ? <a href={mobile} aria-label={client.name + ' mobil anrufen: ' + client.mobile}>{client.mobile}</a> : null}{email ? <a href={email}>{client.email}</a> : null}{!phone && !mobile ? <span className="acw-muted acw-small">Keine Telefonnummer hinterlegt</span> : null}{!email ? <span className="acw-muted acw-small">Keine E-Mail hinterlegt</span> : null}</div></section>
    <section className="acw-section">
      <div className="acw-section-heading"><h3>Kommende Einsätze</h3><span>{snapshot.visitsAvailable ? client.upcomingVisits.length + ' bis ' + dateLabel(snapshot.coverage.toDate) : 'Nicht verfügbar'}</span></div>
      {!snapshot.visitsAvailable ? <p className="acw-muted">Die Einsatzplanung konnte für diese Übersicht nicht eingesehen werden.</p>
        : client.upcomingVisits.length === 0 ? <p className="acw-muted">Bis {dateLabel(snapshot.coverage.toDate)} ist kein weiterer Einsatz geplant.</p>
          : <><ul className="acw-visits">{client.upcomingVisits.slice(0, visitLimit).map(visit => <li key={visit.id}><button type="button" className="acw-visit" onClick={() => navigate('/assist/assignments/' + encodeURIComponent(visit.id))} aria-label={'Einsatz am ' + dateLabel(visit.scheduledStart) + ' um ' + timeLabel(visit.scheduledStart) + ' öffnen'}><span className="acw-visit-date">{dateLabel(visit.scheduledStart)}<span>{visitTime(visit)}</span></span><span className="acw-visit-copy"><strong>{visit.serviceName || visit.title || 'Einsatz'}</strong><small>{visitEmployeeLabel(visit)}</small><span className={'acw-badge ' + (visit.status === 'active' ? 'acw-badge-active' : 'acw-badge-neutral')}>{visit.statusLabel}</span></span><Icon name="arrow" size={14} /></button></li>)}</ul>{visitLimit < client.upcomingVisits.length ? <button className="acw-button acw-more" type="button" onClick={() => setVisitLimit(value => value + 10)}>Weitere Einsätze anzeigen ({client.upcomingVisits.length - visitLimit})</button> : null}</>}
    </section>
  </div>;
}
