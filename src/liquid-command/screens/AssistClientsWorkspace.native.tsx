// Generated native presentation from src/liquid-command/screens/AssistClientsWorkspace.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSvgCircle,NativeSvgPath} from '@/components/layout/NativeSvgPresentation.native';
import {NativeStyle,NativeSection,NativeH1,NativeP,NativeHeader,NativeDiv,NativeSpan,NativeButton,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeH2,NativeUl,NativeLi,NativeStrong,NativeSmall,NativeAside,NativeDl,NativeDt,NativeDd,NativeH3,NativeBr,NativeA,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { WebActionIcon } from "../../components/icons/WebActionIcon.native.tsx";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from "../../components/layout/ScreenShell.tsx";
import { ClientAnimalAvatar } from '@/components/clients/ClientAnimalAvatar';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useLiveRefresh } from '@/hooks/core/useLiveRefresh';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';
import { fetchAssistClientsWorkspace } from "../../lib/assist/assistClientsWorkspaceService.native.ts";
import { filterAssistWorkspaceClients, summarizeAssistWorkspaceClients, type AssistClientsWorkspaceSnapshot, type AssistWorkspaceClient, type AssistWorkspaceVisit, } from "../../lib/assist/assistClientsWorkspaceModel.native.ts";
import type { RoleKey } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import { assistClientsWorkspaceCss } from "./assistClientsWorkspaceCss.native.ts";
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
function Icon({ name, size = 20 }: {
    name: 'people' | 'plus' | 'refresh' | 'search' | 'back' | 'arrow' | 'calendar';
    size?: number;
}) {
    const paths: Record<typeof name, ReactNode> = {
        people: <><NativeSvgCircle cx="9" cy="7" r="3"/><NativeSvgPath d="M3 20v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m3 10v-3a6 6 0 0 0-2-4"/></>,
        plus: <NativeSvgPath d="M12 5v14M5 12h14"/>,
        refresh: <NativeSvgPath d="M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 3M19 16a8 8 0 0 1-13 3l-2-3"/>,
        search: <><NativeSvgCircle cx="10.5" cy="10.5" r="6.5"/><NativeSvgPath d="m16 16 5 5"/></>,
        back: <NativeSvgPath d="m14 5-7 7 7 7M7 12h14"/>,
        arrow: <NativeSvgPath d="m9 5 7 7-7 7"/>,
        calendar: <><NativeSvgPath d="M4 6h16v14H4zM4 10h16M8 3v5M16 3v5"/><NativeSvgPath d="M8 14h2M14 14h2M8 17h2"/></>,
    };
    return <NativeWorkspaceStyleScope css={[assistClientsWorkspaceCss]}>{<WebActionIcon size={size}>{paths[name]}</WebActionIcon>}</NativeWorkspaceStyleScope>;
}
function dateLabel(value: string | null | undefined, year = true) {
    if (!value)
        return 'Nicht hinterlegt';
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T12:00:00Z' : value);
    if (!Number.isFinite(date.getTime()))
        return 'Datum prüfen';
    return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', ...(year ? { year: 'numeric' as const } : {}) }).format(date);
}
function timeLabel(value: string | null | undefined) {
    if (!value || !Number.isFinite(Date.parse(value)))
        return 'Uhrzeit offen';
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
    return <NativeWorkspaceStyleScope css={[assistClientsWorkspaceCss, assistClientsWorkspaceCss]}>{<ScreenShell title="Assist" contentOwnsHeader scroll={false}>
    <NativeStyle>{assistClientsWorkspaceCss}</NativeStyle>
    {!auth.authReady ? <NativeSection className="acw acw-state" role="status"><NativeH1>Assist</NativeH1><NativeP>Zugang wird geprüft …</NativeP></NativeSection>
            : allowed && roleKey ? <AssistWorkspaceContent key={scope} scope={scope} tenantId={tenantId} roleKey={roleKey} permissions={permissions}/>
                : <NativeSection className="acw acw-state" role="status"><NativeH1>Assist</NativeH1><NativeP>Für diese Übersicht benötigen Sie einen Verwaltungszugang und die Freigabe für Assist und Klient:innen.</NativeP></NativeSection>}
  </ScreenShell>}</NativeWorkspaceStyleScope>;
}
function AssistWorkspaceContent({ scope, tenantId, roleKey, permissions }: {
    scope: string;
    tenantId: string;
    roleKey: RoleKey;
    permissions: readonly PermissionKey[];
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
    const query = useAsyncQuery<AssistClientsWorkspaceSnapshot>(() => fetchAssistClientsWorkspace({ tenantId, roleKey, effectivePermissions: permissions }), [scope], { queryKey: 'assist-clients:' + scope });
    useLiveRefresh({ enabled: isFocused, onRefresh: query.refresh, pollMs: 60000, refreshOnFocus: true });
    useEffect(() => {
        if (isFocused && !wasFocused.current)
            void query.refresh();
        wasFocused.current = isFocused;
    }, [isFocused, query.refresh]);
    const snapshot = query.data;
    const clients = useMemo(() => snapshot?.clients ?? [], [snapshot]);
    const summary = useMemo(() => summarizeAssistWorkspaceClients(clients, snapshot?.visitsAvailable ?? false), [clients, snapshot?.visitsAvailable]);
    const visibleClients = useMemo(() => {
        const matches = filterAssistWorkspaceClients(clients, search, filter === 'week' ? 'all' : filter)
            .filter(client => filter !== 'week' || (client.sevenDayVisitCount ?? 0) > 0);
        return [...matches].sort((left, right) => {
            if (sort === 'attention' && left.needsAttention !== right.needsAttention)
                return left.needsAttention ? -1 : 1;
            if (sort === 'next_visit') {
                const leftTime = left.nextVisit ? Date.parse(left.nextVisit.scheduledStart) : Infinity;
                const rightTime = right.nextVisit ? Date.parse(right.nextVisit.scheduledStart) : Infinity;
                if (leftTime !== rightTime)
                    return leftTime - rightTime;
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
        if (!snapshot || !isFocused)
            return;
        if (appliedSelection.current !== requestedId) {
            appliedSelection.current = requestedId;
            if (requestedId) {
                const found = clients.some(client => client.id === requestedId);
                setSelectedId(found ? requestedId : null);
                setDetailOpen(found && first(params.assistDetail) !== '0');
                setSelectionNotice(found ? '' : 'Die verlinkte Person ist in dieser Assist-Übersicht nicht verfügbar. Bitte wählen Sie eine Person aus der Liste.');
            }
            else if (!initialSelection.current) {
                const id = clients[0]?.id ?? null;
                setSelectedId(id);
                setDetailOpen(false);
                if (id)
                    router.setParams({ clientId: id, record: undefined, assistDetail: '0' });
            }
            else {
                setSelectedId(null);
                setDetailOpen(false);
            }
            initialSelection.current = true;
            return;
        }
        if (selectedRef.current && !clients.some(client => client.id === selectedRef.current)) {
            setSelectedId(null);
            setDetailOpen(false);
            setSelectionNotice('Die bisher ausgewählte Person ist nicht mehr aktiv Assist zugeordnet.');
            router.setParams({ clientId: undefined, record: undefined, assistDetail: undefined });
        }
    }, [snapshot, clients, requestedId, router, isFocused]);
    useEffect(() => {
        if (first(params.assistDetail) === '0')
            setDetailOpen(false);
        else if (first(params.assistDetail) === '1')
            setDetailOpen(true);
    }, [params.assistDetail]);
    function changeSearch(value: string) {
        const next = value.slice(0, 180);
        setSearch(next);
        setDetailOpen(false);
        router.setParams({ assistSearch: next || undefined, assistDetail: '0' });
    }
    function changeFilter(next: Filter) {
        setFilter(next);
        setDetailOpen(false);
        router.setParams({ assistFilter: next === 'all' ? undefined : next, assistDetail: '0' });
    }
    function resetFilters() {
        setSearch('');
        setFilter('all');
        setDetailOpen(false);
        router.setParams({ assistSearch: undefined, assistFilter: undefined, assistDetail: '0' });
    }
    function selectClient(id: string) {
        setSelectedId(id);
        setDetailOpen(true);
        setSelectionNotice('');
        selectedRef.current = id;
        router.setParams({ clientId: id, record: undefined, assistDetail: '1' });
        requestAnimationFrame(() => {
            if (detailPane.current)
                detailPane.current.scrollTop = 0;
            detailHeading.current?.focus({ preventScroll: true });
        });
    }
    function backToList() {
        setDetailOpen(false);
        router.setParams({ assistDetail: '0' });
        requestAnimationFrame(() => {
            const row = selectedRef.current ? rows.current.get(selectedRef.current) : null;
            if (row) {
                row.focus({ preventScroll: true });
                row.scrollIntoView?.({ block: 'nearest' });
            }
            else
                listPane.current?.focus({ preventScroll: true });
        });
    }
    const count = (value: number | null) => snapshot && value !== null ? String(value) : '—';
    return <NativeWorkspaceStyleScope css={[assistClientsWorkspaceCss]}>{<NativeSection className="acw" data-assist-clients="workspace-v2" data-detail-open={Boolean(detailOpen && selectedVisible)}>
    <NativeHeader className="acw-heading">
      <NativeDiv className="acw-heading-main"><NativeSpan className="acw-symbol"><Icon name="people" size={24}/></NativeSpan><NativeDiv><NativeSpan className="acw-eyebrow">ASSIST</NativeSpan><NativeH1>Assist-Klient:innen</NativeH1><NativeP>Versorgung und nächste Einsätze im Überblick.</NativeP></NativeDiv></NativeDiv>
      <NativeDiv className="acw-heading-actions">
        {snapshot ? <NativeSpan className="acw-sync">Stand {timeLabel(snapshot.loadedAt)} Uhr</NativeSpan> : null}
        {canPlan ? <NativeButton type="button" className="acw-button acw-button-primary" onClick={() => router.push(planningRoute(selectedVisible?.id) as never)} aria-label={selectedVisible ? 'Einsatz für ' + selectedVisible.name + ' planen' : 'Neuen Einsatz planen'}><Icon name="plus"/><NativeSpan>Einsatz planen</NativeSpan></NativeButton> : null}
      </NativeDiv>
    </NativeHeader>

    <NativeDiv className="acw-metrics" aria-label="Assist-Übersicht">
      <Metric label="Klient:innen" detail="Aktiv zugeordnet" value={count(summary.total)} active={filter === 'all'} onClick={() => changeFilter('all')} disabled={!snapshot}/>
      <Metric label="Einsätze in 7 Tagen" detail={weekPeriod} value={count(summary.sevenDayVisits)} active={filter === 'week'} onClick={() => changeFilter('week')} disabled={!snapshot?.visitsAvailable}/>
      <Metric label="Klärungsbedarf" detail="Angaben oder Zuständigkeit" value={count(summary.attention)} active={filter === 'attention'} onClick={() => changeFilter('attention')} disabled={!snapshot} warning={summary.attention > 0}/>
      <Metric label="Ohne Einsatz" detail={snapshot ? 'Bis ' + dateLabel(snapshot.coverage.toDate) : 'Im Planungszeitraum'} value={count(summary.unplanned)} active={filter === 'unplanned'} onClick={() => changeFilter('unplanned')} disabled={!snapshot?.visitsAvailable}/>
    </NativeDiv>

    {staleError ? <NativeDiv className="acw-message acw-message-error" role="alert"><NativeP>{snapshot ? 'Die Übersicht konnte nicht aktualisiert werden. Angezeigt wird der zuletzt geladene Stand.' : 'Die Assist-Übersicht konnte nicht geladen werden.'}</NativeP><NativeP>{staleError}</NativeP><NativeButton className="acw-button" type="button" disabled={refreshing} onClick={() => void query.refresh()}>Erneut laden</NativeButton></NativeDiv> : null}
    {snapshot && !snapshot.visitsAvailable ? <NativeDiv className="acw-message acw-message-warning" role="status"><NativeP>{snapshot.visitsError || 'Für die Einsatzplanung liegt keine Lesefreigabe vor. Planungszahlen sind deshalb nicht verfügbar.'}</NativeP>{snapshot.visitsError && canViewVisits ? <NativeButton className="acw-button" type="button" disabled={refreshing} onClick={() => void query.refresh()}>Planung erneut laden</NativeButton> : null}</NativeDiv> : null}
    {snapshot?.warnings.length ? <NativeDiv className="acw-message acw-message-warning" role="status">{snapshot.warnings.map((warning, index) => <NativeP key={index}>{warning}</NativeP>)}</NativeDiv> : null}
    {selectionNotice ? <NativeP className="acw-message acw-message-info" role="status">{selectionNotice}</NativeP> : null}

    <NativeDiv className="acw-body">
      <NativeSection className="acw-list-pane" aria-label="Assist-Klient:innen auswählen" tabIndex={-1} ref={listPane}>
        <NativeDiv className="acw-toolbar">
          <NativeDiv className="acw-search-line">
            <NativeLabel className="acw-search"><NativeSpan>Klient:innen durchsuchen</NativeSpan><NativeSpan className="acw-search-field"><Icon name="search"/><NativeInput type="search" autoComplete="off" maxLength={180} value={search} onChange={event => changeSearch(event.target.value)} placeholder="Name, Pflegegrad, Ort, Kasse oder Mitarbeitende"/></NativeSpan></NativeLabel>
            <NativeButton className="acw-button" type="button" disabled={refreshing} onClick={() => void query.refresh()} aria-label="Assist-Übersicht aktualisieren"><Icon name="refresh"/><NativeSpan>{refreshing ? 'Lädt …' : 'Aktualisieren'}</NativeSpan></NativeButton>
          </NativeDiv>
          <NativeDiv className="acw-filters" role="group" aria-label="Klientenliste filtern">
            {([
            ['all', 'Alle', summary.total],
            ['attention', 'Klärungsbedarf', summary.attention],
            ['planned', 'Mit Einsatz', summary.planned],
            ['unplanned', 'Ohne Einsatz', summary.unplanned],
            ['week', 'Nächste 7 Tage', null],
        ] as [
            Filter,
            string,
            number | null
        ][]).map(([key, label, value]) => <NativeButton key={key} type="button" className="acw-filter" aria-pressed={filter === key} disabled={['planned', 'unplanned', 'week'].includes(key) && !snapshot?.visitsAvailable} onClick={() => changeFilter(key)}>{label}{value !== null && snapshot ? <NativeSpan className="acw-filter-count">{value}</NativeSpan> : null}</NativeButton>)}
          </NativeDiv>
          <NativeDiv className="acw-list-options"><NativeSpan role="status">{snapshot ? visibleClients.length + ' von ' + clients.length + ' Personen' : 'Liste wird geladen'} · Planung {period}</NativeSpan><NativeLabel className="acw-sort">Sortieren<NativeSelect value={sort} onChange={event => { const next = readSort(event.target.value); setSort(next); router.setParams({ assistSort: next === 'name' ? undefined : next }); }} aria-label="Klient:innen sortieren"><NativeOption value="name">Nach Name</NativeOption><NativeOption value="next_visit">Nächster Einsatz</NativeOption><NativeOption value="attention">Klärungsbedarf zuerst</NativeOption></NativeSelect></NativeLabel></NativeDiv>
        </NativeDiv>
        {!snapshot ? <NativeDiv className="acw-empty" role="status"><NativeH2>{query.loading ? 'Assist wird geladen …' : 'Keine Daten verfügbar'}</NativeH2><NativeP>{query.loading ? 'Zuordnungen und Einsatzplanung werden abgeglichen.' : 'Bitte laden Sie die Übersicht erneut.'}</NativeP></NativeDiv>
            : visibleClients.length === 0 ? <NativeDiv className="acw-empty" role="status"><NativeH2>{clients.length ? 'Keine passenden Klient:innen' : 'Noch keine aktiven Assist-Zuordnungen'}</NativeH2><NativeP>{clients.length ? 'Ändern Sie den Suchbegriff oder setzen Sie die Filter zurück.' : 'Aktivieren Sie Assist in der Klientenakte, damit die Person hier erscheint.'}</NativeP>{clients.length ? <NativeButton className="acw-button" type="button" onClick={resetFilters}>Filter zurücksetzen</NativeButton> : <NativeButton className="acw-button" type="button" onClick={() => router.push('/business/office/modules/clients' as never)}>Zuordnungen öffnen</NativeButton>}</NativeDiv>
                : <NativeUl className="acw-rows" aria-label="Klientenliste">{visibleClients.map(client => <NativeLi key={client.id}>
              <NativeButton type="button" className="acw-row" aria-pressed={client.id === selectedId} onClick={() => selectClient(client.id)} ref={element => { if (element)
                        rows.current.set(client.id, element);
                    else
                        rows.current.delete(client.id); }}>
                <NativeSpan className="acw-row-avatar"><ClientAnimalAvatar clientId={client.id} clientName={client.name} size={37} ringColor="#9bc5e2"/></NativeSpan>
                <NativeSpan className="acw-row-copy"><NativeSpan className="acw-row-heading"><NativeStrong className="acw-row-name">{client.name}</NativeStrong>{client.needsAttention ? <NativeSpan className="acw-badge acw-badge-warning">Angaben prüfen</NativeSpan> : null}</NativeSpan>
                  <NativeSpan className="acw-row-meta">{client.careLevelLabel}{client.city ? ' · ' + client.city : ''}{client.costCarrier ? ' · ' + client.costCarrier : client.selfPay ? ' · Selbstzahler' : ' · Kostenträger offen'}</NativeSpan>
                  <NativeSpan className="acw-row-planning"><Icon name="calendar" size={16}/>{client.nextVisit ? <><NativeStrong>{dateLabel(client.nextVisit.scheduledStart, false)}, {timeLabel(client.nextVisit.scheduledStart)}</NativeStrong><NativeSpan className="acw-dot">·</NativeSpan><NativeSmall>{visitEmployeeLabel(client.nextVisit)}</NativeSmall>{client.nextVisit.status === 'active' ? <NativeSpan className="acw-badge acw-badge-active">Läuft</NativeSpan> : null}</> : <NativeSpan>{client.planningStatus === 'unknown' ? 'Planung nicht verfügbar' : 'Kein Einsatz bis ' + dateLabel(snapshot.coverage.toDate)}</NativeSpan>}</NativeSpan>
                </NativeSpan>
              </NativeButton>
            </NativeLi>)}</NativeUl>}
      </NativeSection>
      <NativeAside className={'acw-detail-pane' + (!selectedVisible ? ' acw-detail-empty' : '')} aria-label="Ausgewählte Klient:in" ref={detailPane}>
        {selectedVisible && snapshot ? <ClientDetails key={selectedVisible.id} client={selectedVisible} snapshot={snapshot} canPlan={canPlan} canEditClient={canEditClient} onBack={backToList} headingRef={detailHeading} navigate={route => router.push(route as never)}/>
            : <NativeDiv className="acw-empty"><NativeH2>Klient:in auswählen</NativeH2><NativeP>{selected && !selectedVisible ? 'Die ausgewählte Person passt nicht zur aktuellen Suche oder zum Filter.' : 'Wählen Sie eine Person für Kontaktdaten, Einsatzplanung und direkte Aktionen.'}</NativeP>{selected && !selectedVisible ? <NativeButton type="button" className="acw-button" onClick={resetFilters}>Filter zurücksetzen</NativeButton> : null}</NativeDiv>}
      </NativeAside>
    </NativeDiv>
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
function Metric({ label, detail, value, active, disabled, warning, onClick }: {
    label: string;
    detail: string;
    value: string;
    active: boolean;
    disabled?: boolean;
    warning?: boolean;
    onClick: () => void;
}) {
    return <NativeWorkspaceStyleScope css={[assistClientsWorkspaceCss]}>{<NativeButton className={'acw-metric' + (warning ? ' acw-metric-warning' : '')} type="button" aria-pressed={active} disabled={disabled} onClick={onClick}><NativeSpan className="acw-metric-number">{value}</NativeSpan><NativeSpan className="acw-metric-copy"><NativeStrong>{label}</NativeStrong><NativeSmall>{detail}</NativeSmall></NativeSpan></NativeButton>}</NativeWorkspaceStyleScope>;
}
function ClientDetails({ client, snapshot, canPlan, canEditClient, onBack, headingRef, navigate }: {
    client: AssistWorkspaceClient;
    snapshot: AssistClientsWorkspaceSnapshot;
    canPlan: boolean;
    canEditClient: boolean;
    onBack: () => void;
    headingRef: RefObject<HTMLHeadingElement | null>;
    navigate: (route: string) => void;
}) {
    const [visitLimit, setVisitLimit] = useState(5);
    const record = clientRecordRoute(client.id);
    const phone = phoneHref(client.phone);
    const mobile = phoneHref(client.mobile);
    const email = emailHref(client.email);
    return <NativeWorkspaceStyleScope css={[assistClientsWorkspaceCss]}>{<NativeDiv className="acw-detail">
    <NativeButton type="button" className="acw-button acw-button-quiet acw-back" onClick={onBack}><Icon name="back"/>Zur Liste</NativeButton>
    <NativeDiv className="acw-detail-top"><ClientAnimalAvatar clientId={client.id} clientName={client.name} size={49} ringColor="#80b7dc"/><NativeDiv className="acw-detail-name"><NativeSpan className="acw-eyebrow">{client.clientNumber ? 'KLIENT:IN · ' + client.clientNumber : 'AUSGEWÄHLTE PERSON'}</NativeSpan><NativeH2 ref={headingRef} tabIndex={-1}>{client.name}</NativeH2><NativeDiv className="acw-detail-status"><NativeSpan className={'acw-badge' + (client.statusLabel === 'Aktiv' ? '' : ' acw-badge-neutral')}>{client.statusLabel}</NativeSpan>{client.needsAttention ? <NativeSpan className="acw-badge acw-badge-warning">Klärungsbedarf</NativeSpan> : null}</NativeDiv></NativeDiv></NativeDiv>
    <NativeDiv className="acw-detail-actions" aria-label={'Aktionen für ' + client.name}>
      {canPlan ? <NativeButton type="button" className="acw-button acw-button-primary" onClick={() => navigate(planningRoute(client.id))}><Icon name="plus"/><NativeSpan>Einsatz planen</NativeSpan></NativeButton> : null}
      <NativeButton type="button" className="acw-button" onClick={() => navigate(record)}>Klientenakte</NativeButton>
      <NativeButton type="button" className="acw-button" onClick={() => navigate('/assist/abrechnungsquellen?clientId=' + encodeURIComponent(client.id))}>Budget öffnen</NativeButton>
      <NativeButton type="button" className="acw-button" onClick={() => navigate(record + '?tab=portal')}>Portal & Freigaben</NativeButton>
    </NativeDiv>
    {client.missingFields.length ? <NativeDiv className="acw-message acw-message-warning"><NativeStrong>Diese Angaben fehlen</NativeStrong><NativeUl className="acw-missing-list">{client.missingFields.map(field => <NativeLi key={field}>{field}</NativeLi>)}</NativeUl><NativeButton className="acw-button" type="button" onClick={() => navigate(record + (canEditClient ? '?edit=1' : '?tab=stammdaten'))}>{canEditClient ? 'Stammdaten ergänzen' : 'Stammdaten ansehen'}</NativeButton></NativeDiv> : null}
    {client.warnings?.length ? <NativeDiv className="acw-message acw-message-warning">{client.warnings.map((warning, index) => <NativeP key={index}>{warning}</NativeP>)}</NativeDiv> : null}
    <NativeDl className="acw-facts">
      <NativeDiv className="acw-fact"><NativeDt>Pflegegrad</NativeDt><NativeDd>{client.careLevelLabel}</NativeDd></NativeDiv>
      <NativeDiv className="acw-fact"><NativeDt>Geburtsdatum</NativeDt><NativeDd>{dateLabel(client.dateOfBirth)}</NativeDd></NativeDiv>
      <NativeDiv className="acw-fact acw-fact-wide" data-testid="assist-client-carrier"><NativeDt>Kostenträger</NativeDt><NativeDd>{client.costCarrier || (client.selfPay ? 'Selbstzahler' : 'Nicht hinterlegt')}<NativeSmall>{client.insuranceNumber ? 'Versichertennummer: ' + client.insuranceNumber : client.selfPay ? 'Private Abrechnung' : 'Versichertennummer nicht hinterlegt'}</NativeSmall></NativeDd></NativeDiv>
      <NativeDiv className="acw-fact acw-fact-wide"><NativeDt>Feste Zuständigkeit</NativeDt><NativeDd>{client.primaryEmployeeName || (client.primaryEmployeeId ? 'Mitarbeitende zugeordnet' : 'Noch nicht festgelegt')}<NativeSmall>Die Einsatzplanung kann abweichende Mitarbeitende enthalten.</NativeSmall></NativeDd></NativeDiv>
    </NativeDl>
    <NativeSection className="acw-section"><NativeH3>Erreichbarkeit & Einsatzort</NativeH3><NativeP className="acw-address">{client.street || 'Straße nicht hinterlegt'}<NativeBr />{[client.postalCode, client.city].filter(Boolean).join(' ') || 'Postleitzahl und Ort nicht hinterlegt'}</NativeP><NativeDiv className="acw-contacts">{phone ? <NativeA href={phone} aria-label={client.name + ' anrufen: ' + client.phone}>{client.phone}</NativeA> : null}{mobile && mobile !== phone ? <NativeA href={mobile} aria-label={client.name + ' mobil anrufen: ' + client.mobile}>{client.mobile}</NativeA> : null}{email ? <NativeA href={email}>{client.email}</NativeA> : null}{!phone && !mobile ? <NativeSpan className="acw-muted acw-small">Keine Telefonnummer hinterlegt</NativeSpan> : null}{!email ? <NativeSpan className="acw-muted acw-small">Keine E-Mail hinterlegt</NativeSpan> : null}</NativeDiv></NativeSection>
    <NativeSection className="acw-section">
      <NativeDiv className="acw-section-heading"><NativeH3>Kommende Einsätze</NativeH3><NativeSpan>{snapshot.visitsAvailable ? client.upcomingVisits.length + ' bis ' + dateLabel(snapshot.coverage.toDate) : 'Nicht verfügbar'}</NativeSpan></NativeDiv>
      {!snapshot.visitsAvailable ? <NativeP className="acw-muted">Die Einsatzplanung konnte für diese Übersicht nicht eingesehen werden.</NativeP>
            : client.upcomingVisits.length === 0 ? <NativeP className="acw-muted">Bis {dateLabel(snapshot.coverage.toDate)} ist kein weiterer Einsatz geplant.</NativeP>
                : <><NativeUl className="acw-visits">{client.upcomingVisits.slice(0, visitLimit).map(visit => <NativeLi key={visit.id}><NativeButton type="button" className="acw-visit" onClick={() => navigate('/assist/assignments/' + encodeURIComponent(visit.id))} aria-label={'Einsatz am ' + dateLabel(visit.scheduledStart) + ' um ' + timeLabel(visit.scheduledStart) + ' öffnen'}><NativeSpan className="acw-visit-date">{dateLabel(visit.scheduledStart)}<NativeSpan>{visitTime(visit)}</NativeSpan></NativeSpan><NativeSpan className="acw-visit-copy"><NativeStrong>{visit.serviceName || visit.title || 'Einsatz'}</NativeStrong><NativeSmall>{visitEmployeeLabel(visit)}</NativeSmall><NativeSpan className={'acw-badge ' + (visit.status === 'active' ? 'acw-badge-active' : 'acw-badge-neutral')}>{visit.statusLabel}</NativeSpan></NativeSpan><Icon name="arrow" size={16}/></NativeButton></NativeLi>)}</NativeUl>{visitLimit < client.upcomingVisits.length ? <NativeButton className="acw-button acw-more" type="button" onClick={() => setVisitLimit(value => value + 10)}>Weitere Einsätze anzeigen ({client.upcomingVisits.length - visitLimit})</NativeButton> : null}</>}
    </NativeSection>
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
