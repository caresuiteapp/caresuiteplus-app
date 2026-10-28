// Generated native presentation from src/components/office/ClientsListExperience.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSvgPath} from '@/components/layout/NativeSvgPresentation.native';
import {NativeSpan,NativeI,NativeB,NativeA,NativeDiv,NativeStyle,NativeHeader,NativeH1,NativeP,NativeButton,NativeNav,NativeStrong,NativeSection,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeH2,NativeTable,NativeThead,NativeTr,NativeTh,NativeTbody,NativeTd,NativeSmall,NativeArticle,NativeBr,NativeFooter,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { WebActionIcon } from "../icons/WebActionIcon.native.tsx";
import { DeleteIntakeDraftButton } from "./DeleteIntakeDraftButton.native.tsx";
import { useEffect, useId, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { useClientList } from '@/hooks/useClientList';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { usePermissions } from '@/hooks/usePermissions';
import { resolveClientInsuranceDisplay } from "../../lib/clients/clientInsurancePresentation.native.ts";
import { clientIntakeResumeRoute, clientRecordRoute, CLIENT_INTAKE_NEW_ROUTE } from '@/lib/navigation/clientRoutes';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { buildClientListKpis, filterClientsByCareLevel, type ClientCareLevelFilterKey } from '@/lib/office/clientListStats';
import type { ClientListItem } from '@/types/modules/office';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { clientRecordsCss } from "./clientRecordsCss.native.ts";
type ClientsListExperienceProps = {
    onClientPress?: (id: string) => void;
    onOpenDetail?: (id: string) => void;
    onCreatePress?: () => void;
    selectedId?: string | null;
    embedded?: boolean;
    refreshToken?: number;
};
type IconName = 'search' | 'plus' | 'refresh' | 'filter' | 'arrow' | 'folder' | 'grid' | 'list' | 'phone' | 'pin' | 'close' | 'import';
const iconPaths: Record<IconName, string> = {
    search: 'm21 21-5-5 M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    plus: 'M12 5v14 M5 12h14',
    refresh: 'M20 7v5h-5 M20 12a8 8 0 1 0-2 5 M20 7l-3-3',
    filter: 'M4 6h16 M4 12h16 M4 18h16 M8 4v4 M16 10v4 M10 16v4',
    arrow: 'M5 12h14 m-6-6 6 6-6 6',
    folder: 'M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9H3Z M3 8v11',
    grid: 'M3 3h7v7H3Z M14 3h7v7h-7Z M3 14h7v7H3Z M14 14h7v7h-7Z',
    list: 'M8 5h13 M8 12h13 M8 19h13 M3 5h.01 M3 12h.01 M3 19h.01',
    phone: 'M7 3H4a1 1 0 0 0-1 1c0 9 8 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a15 15 0 0 1-7-7l2-2Z',
    pin: 'M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0 M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    close: 'm6 6 12 12 M6 18 18 6',
    import: 'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5',
};
function Icon({ name }: {
    name: IconName;
}) {
    return <NativeWorkspaceStyleScope css={[clientRecordsCss]}>{<WebActionIcon><NativeSvgPath d={iconPaths[name]}/></WebActionIcon>}</NativeWorkspaceStyleScope>;
}
function formatDate(value?: string | null) {
    if (!value)
        return 'Nicht hinterlegt';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Nicht hinterlegt' : new Intl.DateTimeFormat('de-DE').format(date);
}
function clientName(client: ClientListItem) {
    return [client.firstName, client.lastName].filter(Boolean).join(' ') || 'Name noch offen';
}
function statusLabel(status: ClientListItem['status']) {
    return status === 'in_bearbeitung' ? 'Pausiert' : WORKFLOW_STATUS_LABELS[status];
}
function Status({ status }: {
    status: ClientListItem['status'];
}) {
    return <NativeWorkspaceStyleScope css={[clientRecordsCss]}>{<NativeSpan className={`cs-records-status cs-records-status--${status}`}><NativeI aria-hidden="true"/>{statusLabel(status)}</NativeSpan>}</NativeWorkspaceStyleScope>;
}
function MiniFolder({ client, large = false }: {
    client: ClientListItem;
    large?: boolean;
}) {
    const initials = `${client.firstName?.charAt(0) ?? ''}${client.lastName?.charAt(0) ?? ''}`.toLocaleUpperCase('de-DE') || '·';
    return <NativeWorkspaceStyleScope css={[clientRecordsCss]}>{<NativeSpan className={`cs-records-folder${large ? ' cs-records-folder--large' : ''}`} aria-hidden="true">
    <NativeSpan className="cs-records-folder-back"/><NativeSpan className="cs-records-folder-paper"><NativeI /><NativeI /><NativeI /></NativeSpan>
    <NativeSpan className="cs-records-folder-front"><NativeB>{initials}</NativeB><NativeSpan /></NativeSpan>
  </NativeSpan>}</NativeWorkspaceStyleScope>;
}
function ClientPhone({ phone }: {
    phone?: string | null;
}) {
    const safePhone = phone?.replace(/[^\d+*#,;]/g, '');
    return safePhone ? <NativeA className="cs-records-phone" href={`tel:${safePhone}`} aria-label={`${phone} anrufen`}><Icon name="phone"/>{phone}</NativeA> : <NativeSpan className="cs-records-muted">Telefon nicht hinterlegt</NativeSpan>;
}
export function ClientsListExperience({ onClientPress, onOpenDetail, onCreatePress, selectedId = null, embedded = false, refreshToken = 0, }: ClientsListExperienceProps) {
    const router = useRouter();
    const { can, isReadOnly, roleLabel } = usePermissions();
    const list = useClientList();
    const { viewMode, setViewMode } = useDesktopListViewPreference('office.clients');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [localVisibleCount, setLocalVisibleCount] = useState(8);
    const filterId = useId();
    const canCreate = can('office.clients.create');
    const canDeleteDraft = !isReadOnly && canCreate && can('office.clients.delete') && list.isLive;
    const canViewSensitive = can('office.clients.view_sensitive');
    const canCsv = can('tenant.settings.csv.view');
    const handleCreate = onCreatePress ?? (() => router.push(CLIENT_INTAKE_NEW_ROUTE as never));
    const handleOpen = onOpenDetail ?? onClientPress ?? ((id: string) => router.push(clientRecordRoute(id) as never));
    const handleSelect = onClientPress ?? handleOpen;
    const canResumeIntake = (client: ClientListItem) => canCreate && client.status === 'entwurf';
    const handleRecordAction = (client: ClientListItem) => {
        if (canResumeIntake(client))
            router.push(clientIntakeResumeRoute(client.id) as never);
        else
            handleOpen(client.id);
    };
    const { refresh } = list;
    useEffect(() => { if (refreshToken > 0)
        void refresh(); }, [refreshToken, refresh]);
    // The local repository does not apply lifecycle or insurer filters. Apply the
    // same visible choices to its full list before pagination; live data keeps its
    // existing permission-checked server query and pagination.
    const localMatches = useMemo(() => {
        if (list.isLive)
            return null;
        const query = list.search.trim().toLocaleLowerCase('de-DE');
        let matches = filterClientsByCareLevel(list.allItems, list.careLevelFilter).filter((item) => {
            if (list.lifecycleFilter === 'archived' && item.status !== 'archiviert')
                return false;
            if (list.lifecycleFilter === 'active' && ['archiviert', 'entwurf', 'geplant'].includes(item.status))
                return false;
            if (list.statusFilter !== 'all' && item.status !== list.statusFilter)
                return false;
            if (list.costBearerFilter !== 'all' && item.costCarrier?.trim() !== list.costBearerFilter)
                return false;
            return !query || [item.firstName, item.lastName, item.city, item.zip].filter(Boolean).join(' ').toLocaleLowerCase('de-DE').includes(query);
        });
        matches = [...matches].sort((a, b) => {
            const left = list.sortKey === 'city_asc' ? a.city ?? '' : a.lastName;
            const right = list.sortKey === 'city_asc' ? b.city ?? '' : b.lastName;
            return left.localeCompare(right, 'de', { sensitivity: 'base', numeric: true }) * (list.sortKey === 'name_desc' ? -1 : 1);
        });
        return matches;
    }, [list.isLive, list.allItems, list.search, list.careLevelFilter, list.lifecycleFilter, list.statusFilter, list.costBearerFilter, list.sortKey]);
    useEffect(() => { setLocalVisibleCount(8); }, [list.search, list.careLevelFilter, list.lifecycleFilter, list.statusFilter, list.costBearerFilter, list.sortKey]);
    const visibleItems = localMatches ? localMatches.slice(0, localVisibleCount) : list.items;
    const resultCount = localMatches?.length ?? list.filteredCount;
    const hasMore = localMatches ? localVisibleCount < localMatches.length : list.hasMore;
    const loadMore = localMatches ? () => setLocalVisibleCount((count) => count + 8) : list.loadMore;
    const kpis = useMemo(() => buildClientListKpis(list.kpiItems), [list.kpiItems]);
    // Filter choices come from the full permitted list so the selected insurer does not
    // remove every other insurer from the menu after a server-side filtered request.
    const costBearers = useMemo(() => {
        const values = new Set(list.kpiItems.map((item) => item.costCarrier?.trim()).filter((value): value is string => Boolean(value)));
        if (list.costBearerFilter !== 'all')
            values.add(list.costBearerFilter);
        return [...values].sort((a, b) => a.localeCompare(b, 'de'));
    }, [list.kpiItems, list.costBearerFilter]);
    const advancedFilterCount = Number(list.statusFilter !== 'all') + Number(list.careLevelFilter !== 'all') + Number(list.costBearerFilter !== 'all');
    const totalCount = list.kpiItems.length;
    const noResults = !list.loading && visibleItems.length === 0;
    const filteredEmpty = noResults && (list.hasActiveFilters || totalCount > 0);
    const activeKpi = list.search || list.careLevelFilter !== 'all' || list.costBearerFilter !== 'all'
        ? null
        : list.lifecycleFilter === 'all' && list.statusFilter === 'all' ? 'clients-kpi-total'
            : list.lifecycleFilter === 'active' && list.statusFilter === 'aktiv' ? 'clients-kpi-active'
                : list.lifecycleFilter === 'all' && list.statusFilter === 'in_bearbeitung' ? 'clients-kpi-intake'
                    : list.lifecycleFilter === 'all' && list.statusFilter === 'entwurf' ? 'clients-kpi-drafts' : null;
    const setKpi = (id: string) => {
        list.setSearch('');
        list.setCareLevelFilter('all');
        list.setCostBearerFilter('all');
        list.setLifecycleFilter(id === 'clients-kpi-active' ? 'active' : 'all');
        list.setStatusFilter(id === 'clients-kpi-active' ? 'aktiv' : id === 'clients-kpi-intake' ? 'in_bearbeitung' : id === 'clients-kpi-drafts' ? 'entwurf' : 'all');
    };
    const clearFilters = () => {
        list.resetFilters();
        // The shared hook keeps these values for the local service; reset them explicitly.
        list.setLifecycleFilter(list.isLive ? 'active' : 'all');
        list.setCostBearerFilter('all');
    };
    const setLifecycle = (value: typeof list.lifecycleFilter) => {
        list.setLifecycleFilter(value);
        list.setStatusFilter('all');
    };
    const kpiNames: Record<string, {
        label: string;
        hint: string;
    }> = {
        'clients-kpi-total': { label: 'Alle Akten', hint: 'einschließlich Archiv' },
        'clients-kpi-active': { label: 'In Betreuung', hint: 'aktive Klient:innen' },
        'clients-kpi-intake': { label: 'Pausiert', hint: 'Betreuung unterbrochen' },
        'clients-kpi-drafts': { label: 'Entwürfe', hint: 'begonnene Aufnahmen' },
    };
    return <NativeWorkspaceStyleScope css={[clientRecordsCss, clientRecordsCss]}>{<NativeDiv className={`cs-records${embedded ? ' cs-records--embedded' : ''}`} data-testid="list-wrapper">
    <NativeStyle>{clientRecordsCss}</NativeStyle>
    <NativeDiv className="cs-records-scroll">
      <NativeHeader className="cs-records-hero">
        <NativeDiv className="cs-records-hero-copy"><NativeSpan className="cs-records-eyebrow">Ihre Klientenverwaltung</NativeSpan><NativeH1>Jede Akte im Blick.</NativeH1><NativeP>Klient:innen finden, Aufnahmen fortsetzen und die Betreuung organisieren.</NativeP>
          <NativeDiv className="cs-records-connection"><NativeSpan className={`cs-records-connection-dot${list.isLiveConnected && list.isLive ? ' is-connected' : ''}`}/>{list.isLive ? (list.isLiveConnected ? 'Änderungen werden automatisch geladen' : 'Automatische Aktualisierung wird verbunden') : 'Lokaler Datenbestand'}{isReadOnly ? <NativeSpan className="cs-records-readonly">Nur lesen</NativeSpan> : null}</NativeDiv>
        </NativeDiv>
        <NativeDiv className="cs-records-hero-actions">
          {canCreate ? <NativeButton type="button" className="cs-records-button cs-records-button--primary" onClick={handleCreate}><Icon name="plus"/>Klient:in aufnehmen</NativeButton> : null}
          <NativeDiv className="cs-records-secondary-actions">{canCsv ? <NativeButton type="button" className="cs-records-button cs-records-button--inverse" onClick={() => router.push('/business/office/settings/csv-import-export?tab=clients-import' as never)}><Icon name="import"/>Import / Export</NativeButton> : null}
            <NativeButton type="button" className="cs-records-button cs-records-button--inverse" disabled={list.refreshing || list.loading} onClick={() => void refresh()}><Icon name="refresh"/>{list.refreshing ? 'Wird geladen …' : 'Aktualisieren'}</NativeButton></NativeDiv>
        </NativeDiv>
      </NativeHeader>

      {!embedded ? <NativeNav className="cs-records-kpis" aria-label="Akten nach Bearbeitungsstand filtern">{kpis.map((kpi, index) => <NativeButton key={kpi.id} type="button" className={`cs-records-kpi${activeKpi === kpi.id ? ' is-active' : ''}`} aria-pressed={activeKpi === kpi.id} onClick={() => setKpi(kpi.id)}>
        <NativeSpan className="cs-records-kpi-title"><NativeI className={`cs-records-kpi-dot cs-records-kpi-dot--${index}`}/>{kpiNames[kpi.id].label}<Icon name="arrow"/></NativeSpan>
        <NativeStrong>{list.loading && totalCount === 0 ? '—' : kpi.value}</NativeStrong><NativeSpan>{kpiNames[kpi.id].hint}</NativeSpan>
      </NativeButton>)}</NativeNav> : null}

      <NativeSection className="cs-records-workspace" aria-label="Klientenakten">
        <NativeDiv className="cs-records-toolbar" data-testid="filter-bar">
          <NativeDiv className="cs-records-toolbar-top"><NativeDiv className="cs-records-tabs" role="group" aria-label="Aktenbestand">
            {[{ key: 'active', label: 'Bestandsakten' }, { key: 'all', label: 'Alle Akten' }, { key: 'archived', label: 'Archiv' }].map((tab) => <NativeButton key={tab.key} type="button" aria-pressed={list.lifecycleFilter === tab.key} onClick={() => setLifecycle(tab.key as typeof list.lifecycleFilter)}>{tab.label}</NativeButton>)}
          </NativeDiv><NativeDiv className="cs-records-view-toggle" role="group" aria-label="Darstellung der Akten">
            <NativeButton type="button" aria-pressed={viewMode === 'table'} onClick={() => setViewMode('table')}><Icon name="list"/><NativeSpan>Liste</NativeSpan></NativeButton>
            <NativeButton type="button" aria-pressed={viewMode === 'cards'} onClick={() => setViewMode('cards')}><Icon name="grid"/><NativeSpan>Aktenkarten</NativeSpan></NativeButton>
          </NativeDiv></NativeDiv>
          <NativeDiv className="cs-records-search-row"><NativeLabel className="cs-records-search"><Icon name="search"/><NativeSpan className="cs-records-sr">Klient:innen suchen</NativeSpan><NativeInput type="search" value={list.search} onChange={(event) => list.setSearch(event.target.value)} placeholder="Name, Ort oder Postleitzahl suchen" autoComplete="off"/></NativeLabel>
            <NativeButton type="button" className={`cs-records-button cs-records-filter-toggle${advancedFilterCount ? ' is-active' : ''}`} aria-expanded={filtersOpen} aria-controls={filterId} onClick={() => setFiltersOpen((value) => !value)}><Icon name="filter"/>Filter{advancedFilterCount ? <NativeSpan className="cs-records-count">{advancedFilterCount}</NativeSpan> : null}</NativeButton>
            <NativeLabel className="cs-records-sort"><NativeSpan className="cs-records-sr">Sortieren</NativeSpan><NativeSelect value={list.sortKey} onChange={(event) => list.setSortKey(event.target.value)}>{list.sortOptions.map((option) => <NativeOption key={option.key} value={option.key}>{option.label}</NativeOption>)}</NativeSelect></NativeLabel>
          </NativeDiv>
          {filtersOpen ? <NativeDiv className="cs-records-filters" id={filterId}>
            <NativeLabel><NativeSpan>Bearbeitungsstand</NativeSpan><NativeSelect value={list.statusFilter} onChange={(event) => {
                const value = event.target.value as typeof list.statusFilter;
                list.setStatusFilter(value);
                if (value !== 'all')
                    list.setLifecycleFilter(value === 'archiviert' ? 'archived' : 'all');
            }}>{list.statusFilters.map((filter) => <NativeOption key={filter.key} value={filter.key}>{filter.key === 'all' ? 'Alle Bearbeitungsstände' : statusLabel(filter.key)}</NativeOption>)}</NativeSelect></NativeLabel>
            <NativeLabel><NativeSpan>Pflegegrad</NativeSpan><NativeSelect value={list.careLevelFilter} onChange={(event) => list.setCareLevelFilter(event.target.value as ClientCareLevelFilterKey)}>{list.careLevelFilters.map((filter) => <NativeOption key={filter.key} value={filter.key}>{filter.key === 'all' ? 'Alle Pflegegrade' : filter.key === 'none' ? 'Ohne hinterlegten Pflegegrad' : filter.label}</NativeOption>)}</NativeSelect></NativeLabel>
            <NativeLabel><NativeSpan>Kostenträger</NativeSpan><NativeSelect value={list.costBearerFilter} onChange={(event) => list.setCostBearerFilter(event.target.value)}><NativeOption value="all">Alle Kostenträger</NativeOption>{costBearers.map((name) => <NativeOption key={name} value={name}>{name}</NativeOption>)}</NativeSelect></NativeLabel>
          </NativeDiv> : null}
          <NativeDiv className="cs-records-results"><NativeSpan role="status" aria-live="polite">{list.loading ? 'Akten werden geladen …' : <><NativeStrong>{resultCount}</NativeStrong> {resultCount === 1 ? 'Akte' : 'Akten'}{list.hasActiveFilters ? ' gefunden' : ' in dieser Ansicht'}</>}</NativeSpan>
            {list.hasActiveFilters ? <NativeButton type="button" onClick={clearFilters}><Icon name="close"/>Filter zurücksetzen</NativeButton> : null}
          </NativeDiv>
        </NativeDiv>

        {list.error ? <NativeDiv className="cs-records-notice cs-records-notice--error" role="alert"><NativeDiv><NativeStrong>Akten konnten nicht aktualisiert werden.</NativeStrong><NativeP>{list.error}</NativeP>{visibleItems.length > 0 ? <NativeP>Die zuletzt geladenen Angaben bleiben sichtbar.</NativeP> : null}</NativeDiv><NativeButton type="button" className="cs-records-button" disabled={list.refreshing} onClick={() => void refresh()}>Erneut versuchen</NativeButton></NativeDiv> : null}
        {list.hasLocalOnlyIntakeDraft && canCreate ? <NativeDiv className="cs-records-notice"><NativeDiv><NativeStrong>Eine Aufnahme ist auf diesem Gerät noch offen.</NativeStrong><NativeP>Der Entwurf ist noch nicht als Akte gespeichert.</NativeP></NativeDiv><NativeButton type="button" className="cs-records-button" onClick={handleCreate}>Aufnahme fortsetzen<Icon name="arrow"/></NativeButton></NativeDiv> : null}

        {list.loading && visibleItems.length === 0 ? <NativeDiv className="cs-records-skeletons" aria-label="Akten werden geladen" aria-busy="true">{[0, 1, 2, 3].map((row) => <NativeDiv key={row} className="cs-records-skeleton"><NativeI /><NativeSpan /><NativeSpan /></NativeDiv>)}</NativeDiv> : noResults && !list.error ? <NativeDiv className="cs-records-empty"><NativeSpan className="cs-records-empty-icon"><Icon name={filteredEmpty ? 'search' : 'folder'}/></NativeSpan><NativeH2>{filteredEmpty ? 'Keine passende Akte gefunden' : 'Die erste Akte beginnt hier'}</NativeH2><NativeP>{filteredEmpty ? 'Ändern Sie den Suchbegriff oder setzen Sie die Filter zurück.' : canCreate ? 'Starten Sie eine Aufnahme. Alle Angaben und Unterlagen bleiben in einer gemeinsamen Akte.' : `Für ${roleLabel ?? 'Ihre Rolle'} sind derzeit keine Klientenakten vorhanden.`}</NativeP>{filteredEmpty ? <NativeButton type="button" className="cs-records-button" onClick={clearFilters}>Filter zurücksetzen</NativeButton> : canCreate ? <NativeButton type="button" className="cs-records-button cs-records-button--blue" onClick={handleCreate}><Icon name="plus"/>Klient:in aufnehmen</NativeButton> : null}</NativeDiv> : <>
          <NativeDiv className={`cs-records-data cs-records-data--${viewMode}`} aria-busy={list.loading || list.refreshing}>
            <NativeDiv className="cs-records-table-scroll"><NativeTable className="cs-records-table"><NativeThead><NativeTr><NativeTh scope="col" aria-sort={list.sortKey === 'name_asc' ? 'ascending' : list.sortKey === 'name_desc' ? 'descending' : 'none'}><NativeButton type="button" onClick={() => list.setSortKey(list.sortKey === 'name_asc' ? 'name_desc' : 'name_asc')}>Klient:in{list.sortKey.startsWith('name_') ? list.sortKey === 'name_asc' ? ' ↑' : ' ↓' : ''}</NativeButton></NativeTh><NativeTh scope="col">Versorgung</NativeTh><NativeTh scope="col" aria-sort={list.sortKey === 'city_asc' ? 'ascending' : 'none'}><NativeButton type="button" onClick={() => list.setSortKey('city_asc')}>Kontakt & Ort{list.sortKey === 'city_asc' ? ' ↑' : ''}</NativeButton></NativeTh><NativeTh scope="col">Bearbeitungsstand</NativeTh><NativeTh scope="col">Geändert am</NativeTh><NativeTh scope="col"><NativeSpan className="cs-records-sr">Akte öffnen</NativeSpan></NativeTh></NativeTr></NativeThead><NativeTbody>
              {visibleItems.map((client) => <NativeTr key={client.id} className={selectedId === client.id ? 'is-selected' : undefined} aria-selected={selectedId === client.id}>
                <NativeTd><NativeButton type="button" className="cs-records-identity" onClick={() => handleSelect(client.id)}><MiniFolder client={client}/><NativeSpan><NativeStrong>{clientName(client)}</NativeStrong><NativeSmall>{client.dateOfBirth ? `Geb. ${formatDate(client.dateOfBirth)}` : 'Geburtsdatum nicht hinterlegt'}</NativeSmall></NativeSpan></NativeButton></NativeTd>
                <NativeTd><NativeStrong>{client.careLevel ? formatCareLevel(client.careLevel) : 'Pflegegrad nicht hinterlegt'}</NativeStrong><NativeSmall>{client.costCarrier || 'Kostenträger nicht hinterlegt'}</NativeSmall><NativeSmall className="cs-records-insurance"><NativeSpan>Versichertennummer</NativeSpan><NativeB>{resolveClientInsuranceDisplay(client, canViewSensitive)}</NativeB></NativeSmall></NativeTd>
                <NativeTd><NativeStrong>{[client.zip, client.city].filter(Boolean).join(' ') || 'Ort nicht hinterlegt'}</NativeStrong><ClientPhone phone={client.primaryContactPhone}/></NativeTd>
                <NativeTd><Status status={client.status}/></NativeTd><NativeTd><NativeSpan className="cs-records-date">{formatDate(client.updatedAt)}</NativeSpan></NativeTd>
                <NativeTd><NativeButton type="button" className="cs-records-open" onClick={() => handleRecordAction(client)} aria-label={canResumeIntake(client) ? `Aufnahme von ${clientName(client)} fortsetzen` : `Akte von ${clientName(client)} öffnen`}><NativeSpan>{canResumeIntake(client) ? 'Aufnahme fortsetzen' : 'Akte öffnen'}</NativeSpan><Icon name="arrow"/></NativeButton>{canDeleteDraft && client.status === 'entwurf' ? <DeleteIntakeDraftButton clientId={client.id} name={clientName(client)} onDeleted={() => void refresh()}/> : null}</NativeTd>
              </NativeTr>)}
            </NativeTbody></NativeTable></NativeDiv>
            <NativeDiv className="cs-records-cards">{visibleItems.map((client) => <NativeArticle key={client.id} className={`cs-records-card${selectedId === client.id ? ' is-selected' : ''}`}>
              <NativeDiv className="cs-records-card-top"><Status status={client.status}/><NativeSpan className="cs-records-card-care">{client.careLevel ? formatCareLevel(client.careLevel) : 'Pflegegrad offen'}</NativeSpan></NativeDiv>
              <NativeButton type="button" className="cs-records-card-identity" onClick={() => handleSelect(client.id)}><MiniFolder client={client} large/><NativeStrong>{clientName(client)}</NativeStrong><NativeSmall>{client.dateOfBirth ? `Geb. ${formatDate(client.dateOfBirth)}` : 'Geburtsdatum nicht hinterlegt'}</NativeSmall></NativeButton>
              <NativeDiv className="cs-records-card-details"><NativeSpan><Icon name="pin"/>{[client.zip, client.city].filter(Boolean).join(' ') || 'Ort nicht hinterlegt'}</NativeSpan><ClientPhone phone={client.primaryContactPhone}/><NativeSpan className="cs-records-card-carrier">{client.costCarrier || 'Kostenträger nicht hinterlegt'}<NativeSpan className="cs-records-insurance"><NativeSpan>Versichertennummer</NativeSpan><NativeB>{resolveClientInsuranceDisplay(client, canViewSensitive)}</NativeB></NativeSpan></NativeSpan></NativeDiv>
              <NativeDiv className="cs-records-card-footer"><NativeSpan>Geändert<NativeBr /><NativeStrong>{formatDate(client.updatedAt)}</NativeStrong></NativeSpan><NativeButton type="button" className="cs-records-open" onClick={() => handleRecordAction(client)} aria-label={canResumeIntake(client) ? `Aufnahme von ${clientName(client)} fortsetzen` : `Akte von ${clientName(client)} öffnen`}>{canResumeIntake(client) ? 'Aufnahme fortsetzen' : 'Akte öffnen'}<Icon name="arrow"/></NativeButton>{canDeleteDraft && client.status === 'entwurf' ? <DeleteIntakeDraftButton clientId={client.id} name={clientName(client)} onDeleted={() => void refresh()}/> : null}</NativeDiv>
            </NativeArticle>)}</NativeDiv>
          </NativeDiv>
          {visibleItems.length > 0 ? <NativeFooter className="cs-records-footer"><NativeSpan>{visibleItems.length} von {resultCount} {resultCount === 1 ? 'Akte' : 'Akten'} angezeigt</NativeSpan>{hasMore ? <NativeButton type="button" className="cs-records-button" onClick={loadMore} disabled={list.loading}>Weitere Akten laden<Icon name="arrow"/></NativeButton> : <NativeSpan className="cs-records-muted">Alle Treffer geladen</NativeSpan>}</NativeFooter> : null}
        </>}
      </NativeSection>
    </NativeDiv>
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
