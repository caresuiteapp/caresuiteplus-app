// Generated native presentation from src/components/office/invoices/InvoicesWorkspace.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSvgPath} from '@/components/layout/NativeSvgPresentation.native';
import {NativeSection,NativeH1,NativeP,NativeHeader,NativeDiv,NativeSpan,NativeButton,NativeNav,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeBr,NativeH2,NativeSmall,NativeH3,NativeTable,NativeThead,NativeTr,NativeTh,NativeTbody,NativeTd,NativeStrong} from '@/components/layout/NativeWorkspaceElements.native';
import { WebActionIcon } from "../../icons/WebActionIcon.native.tsx";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { subscribeToOfficeDashboardChanges } from '@/lib/realtime/presets';
import { fetchOfficeInvoices } from "../../../lib/office/invoiceWorkspaceService.native.ts";
import { INVOICE_STATUS_LABELS } from '@/lib/office/invoiceStatus';
import { formatInvoiceDate, formatInvoiceMoney, invoiceDay, invoiceDisplayNumber, invoiceFilter, invoiceMonth, invoiceOverdue, invoiceParam, invoiceSort, invoiceStatusChoices, invoiceTone, invoiceTotalHint, invoiceWorkspaceTotals, selectWorkspaceInvoices } from "../../../lib/office/invoiceWorkspaceModel.native.ts";
import { InvoiceRunPanel } from "./InvoiceRunPanel.native.tsx";
import type { RoleKey } from '@/types';
type Params = {
    search?: string | string[];
    month?: string | string[];
    status?: string | string[];
    sort?: string | string[];
    view?: string | string[];
};
export function InvoicesWorkspace({ onInvoicePress, selectedId, initialView = 'list' }: {
    onInvoicePress?: (id: string) => void;
    selectedId?: string | null;
    initialView?: 'list' | 'run';
}) {
    const auth = useAuth();
    const tenantId = useServiceTenantId()?.trim() ?? '';
    const { roleKey, permissions, can } = usePermissions();
    const allowed = Boolean(auth.authReady && auth.isAuthenticated && auth.user?.id && tenantId && roleKey && !auth.portalSession && !isPortalOnlyRole(roleKey) && can('office.invoices.view'));
    const scopeKey = JSON.stringify([tenantId, auth.user?.id, roleKey, [...new Set(permissions)].sort()]);
    if (!auth.authReady)
        return <NativeSection className="iw iw-empty" role="status">Zugang wird geprüft …</NativeSection>;
    if (!allowed || !roleKey)
        return <NativeSection className="iw iw-empty"><NativeH1>Rechnungen</NativeH1><NativeP>Für diesen Bereich benötigen Sie einen Verwaltungszugang mit Zugriff auf Rechnungen.</NativeP></NativeSection>;
    return <InvoiceWorkspaceContent key={scopeKey} scopeKey={scopeKey} tenantId={tenantId} roleKey={roleKey} canCreate={can('office.invoices.create')} onInvoicePress={onInvoicePress} selectedId={selectedId} initialView={initialView}/>;
}
function InvoiceWorkspaceContent({ tenantId, roleKey, scopeKey, canCreate, onInvoicePress, selectedId, initialView }: {
    tenantId: string;
    roleKey: RoleKey;
    scopeKey: string;
    canCreate: boolean;
    onInvoicePress?: (id: string) => void;
    selectedId?: string | null;
    initialView: 'list' | 'run';
}) {
    const router = useRouter();
    const focused = useIsFocused();
    const params = useLocalSearchParams<Params>();
    const search = invoiceParam(params.search).slice(0, 180);
    const month = invoiceMonth(invoiceParam(params.month));
    const status = invoiceFilter(invoiceParam(params.status));
    const sort = invoiceSort(invoiceParam(params.sort));
    const requestedView = invoiceParam(params.view);
    const view = requestedView === 'run' ? 'run' : requestedView === 'list' ? 'list' : initialView;
    const [visibleCount, setVisibleCount] = useState(50);
    const [runBusy, setRunBusy] = useState(false);
    const [lastLoaded, setLastLoaded] = useState('');
    const today = invoiceDay();
    const query = useAsyncQuery(useCallback(() => fetchOfficeInvoices(tenantId, roleKey), [tenantId, roleKey]), [scopeKey], { queryKey: `office-invoices:${scopeKey}`, refreshOnAppFocus: false, onSuccess: () => setLastLoaded(new Date().toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })), live: { enabled: focused && view === 'list', tenantId, subscribe: subscribeToOfficeDashboardChanges, pollMs: 45000, refreshOnFocus: true } });
    const rows = useMemo(() => selectWorkspaceInvoices(query.data ?? [], { search, month, status, sort, today }), [query.data, search, month, status, sort, today]);
    const totals = invoiceWorkspaceTotals(rows, today);
    const queryError = query.error || query.refreshError;
    const activeFilters = Boolean(search || month || status !== 'all');
    useEffect(() => { setVisibleCount(50); }, [search, month, status, sort]);
    function updateParams(next: Record<string, string | undefined>) { if (focused && !runBusy)
        router.setParams(next); }
    function openInvoice(id: string) { if (!focused || runBusy)
        return; if (onInvoicePress)
        onInvoicePress(id);
    else
        router.push(`/business/office/invoices/${encodeURIComponent(id)}` as never); }
    function createInvoice() { if (focused && canCreate && !runBusy)
        router.push('/business/office/invoices/new' as never); }
    function resetFilters() { updateParams({ search: undefined, month: undefined, status: undefined }); }
    return <NativeSection className="iw iw-fade" data-testid="office-invoices-workspace" data-healthos-invoices-revision="office-invoices-20261018">
    <NativeHeader className="iw-header"><NativeDiv className="iw-heading"><NativeSpan className="iw-mark" aria-hidden="true"><WebActionIcon size="navigation"><NativeSvgPath d="M5 3h9l5 5v13H5V3Z"/><NativeSvgPath d="M14 3v5h5M8 12h8M8 16h8M8 19h4"/></WebActionIcon></NativeSpan><NativeDiv><NativeP className="iw-eyebrow">Office · Abrechnung</NativeP><NativeH1>Rechnungen</NativeH1><NativeP>Einzelrechnungen, Monatsdurchläufe und Zahlungsstände.</NativeP></NativeDiv></NativeDiv><NativeDiv className="iw-actions">{view === 'list' && <NativeButton type="button" disabled={query.loading || query.refreshing} onClick={() => void query.refresh()}>{query.refreshing ? 'Wird aktualisiert …' : 'Aktualisieren'}</NativeButton>}{canCreate && <NativeButton type="button" className="iw-primary" disabled={runBusy} onClick={createInvoice}>Neue Rechnung</NativeButton>}</NativeDiv></NativeHeader>
    <NativeNav className="iw-tabs" aria-label="Rechnungsansicht"><NativeButton type="button" aria-pressed={view === 'list'} disabled={runBusy} onClick={() => updateParams({ view: initialView === 'run' ? 'list' : undefined })}>Rechnungsübersicht</NativeButton>{canCreate && <NativeButton type="button" aria-pressed={view === 'run'} disabled={runBusy} onClick={() => updateParams({ view: 'run' })}>Rechnungsdurchlauf</NativeButton>}{[['inbox', 'Rechnungseingang'], ['payments', 'Zahlungseingänge'], ['dunning', 'Mahnwesen'], ['month-end', 'Monatsübersicht']].map(([path, label]) => <NativeButton type="button" key={path} disabled={runBusy} onClick={() => { if (focused && !runBusy)
        router.push(`/business/office/invoices/${path}` as never); }}>{label}</NativeButton>)}</NativeNav>
    {view === 'run' ? canCreate ? <InvoiceRunPanel tenantId={tenantId} roleKey={roleKey} scopeKey={scopeKey} onBusyChange={setRunBusy} onCreated={() => void query.refresh()} onOpenInvoice={openInvoice}/> : <NativeDiv className="iw-notice" role="status">Für das Erstellen von Rechnungen fehlt die Berechtigung.</NativeDiv> : <>
      <NativeDiv className="iw-toolbar"><NativeLabel className="iw-search">Rechnung suchen<NativeInput type="search" placeholder="Rechnungsnummer, Klient:in oder Empfänger" maxLength={180} value={search} onChange={event => updateParams({ search: event.target.value || undefined })}/></NativeLabel><NativeLabel className="iw-period">Rechnungsmonat<NativeDiv><NativeInput aria-label="Rechnungsmonat, leer für alle Monate" type="month" min="2000-01" max="2100-12" value={month} onChange={event => updateParams({ month: invoiceMonth(event.target.value) || undefined })}/>{month && <NativeButton type="button" aria-label="Alle Rechnungsmonate anzeigen" onClick={() => updateParams({ month: undefined })}>Alle</NativeButton>}</NativeDiv></NativeLabel><NativeLabel className="iw-status">Status<NativeSelect value={status} onChange={event => updateParams({ status: event.target.value === 'all' ? undefined : event.target.value })}>{invoiceStatusChoices.map(([key, label]) => <NativeOption key={key} value={key}>{label}</NativeOption>)}</NativeSelect></NativeLabel><NativeLabel className="iw-sort">Sortierung<NativeSelect value={sort} onChange={event => updateParams({ sort: event.target.value === 'newest' ? undefined : event.target.value })}><NativeOption value="newest">Neueste zuerst</NativeOption><NativeOption value="due">Früheste Fälligkeit</NativeOption><NativeOption value="number">Rechnungsnummer</NativeOption><NativeOption value="client">Klient:in A–Z</NativeOption><NativeOption value="amount">Höchster Betrag</NativeOption></NativeSelect></NativeLabel></NativeDiv>
      {queryError && <NativeDiv className="iw-notice" data-tone="error" role="alert">{queryError}{query.data ? ' Angezeigt wird der letzte erfolgreiche Stand.' : ''}<NativeBr /><NativeButton type="button" disabled={query.refreshing || query.loading} onClick={() => void query.refresh()}>Erneut laden</NativeButton></NativeDiv>}
      {query.data && <><NativeDiv className="iw-kpis"><Metric label="Rechnungen" value={String(totals.count)} hint={activeFilters ? 'In der aktuellen Auswahl' : 'Im gesamten Bestand'}/><Metric label="Entwürfe" value={String(totals.drafts)} hint="Noch nicht zur Abrechnung freigegeben"/><Metric label="Offene Forderungen" value={totals.open.known || !totals.open.count ? formatInvoiceMoney(totals.open.cents) : '—'} hint={invoiceTotalHint(totals.open, 'Keine versendeten offenen Rechnungen')} tone="warning"/><Metric label="Davon überfällig" value={totals.overdue.known || !totals.overdue.count ? formatInvoiceMoney(totals.overdue.cents) : '—'} hint={invoiceTotalHint(totals.overdue, 'Keine überfälligen Forderungen')} tone={totals.overdue.count ? 'bad' : 'good'}/></NativeDiv><NativeDiv className="iw-filterline"><NativeSpan>{rows.length} von {query.data.length} Rechnungen · Summen der aktuellen Auswahl{lastLoaded ? ` · Stand ${lastLoaded} Uhr` : ''}</NativeSpan>{activeFilters && <NativeButton type="button" className="iw-link" onClick={resetFilters}>Filter zurücksetzen</NativeButton>}</NativeDiv></>}
      <NativeSection className="iw-panel" aria-busy={query.loading || query.refreshing}><NativeDiv className="iw-panel-head"><NativeH2>Rechnungsübersicht</NativeH2><NativeSmall>Beträge in Euro · Brutto</NativeSmall></NativeDiv>{query.loading && !query.data ? <NativeDiv role="status" aria-label="Rechnungen werden geladen"><NativeDiv className="iw-skeleton"/><NativeDiv className="iw-skeleton"/><NativeDiv className="iw-skeleton"/></NativeDiv> : !query.data ? <NativeDiv className="iw-empty"><NativeH3>Rechnungen derzeit nicht verfügbar</NativeH3><NativeP>Laden Sie die Daten erneut, um den aktuellen Rechnungsstand zu prüfen.</NativeP></NativeDiv> : rows.length === 0 ? <NativeDiv className="iw-empty"><NativeH3>{activeFilters ? 'Keine passenden Rechnungen' : 'Noch keine Rechnungen vorhanden'}</NativeH3><NativeP>{activeFilters ? 'Ändern Sie die Suche, den Monat oder den Status.' : canCreate ? 'Legen Sie eine Einzelrechnung an oder bereiten Sie mehrere Rechnungen aus freigegebenen Leistungen vor.' : 'Sobald Rechnungen vorhanden sind, sehen Sie sie in dieser Übersicht.'}</NativeP><NativeDiv className="iw-actions">{activeFilters ? <NativeButton type="button" onClick={resetFilters}>Filter zurücksetzen</NativeButton> : canCreate && <NativeButton type="button" onClick={() => updateParams({ view: 'run' })}>Rechnungsdurchlauf vorbereiten</NativeButton>}</NativeDiv></NativeDiv> : <><NativeDiv className="iw-table-scroll" role="region" aria-label="Rechnungen, bei Bedarf horizontal scrollbar" tabIndex={0}><NativeTable><NativeThead><NativeTr><NativeTh scope="col">Rechnung</NativeTh><NativeTh scope="col">Klient:in / Empfänger</NativeTh><NativeTh scope="col">Status</NativeTh><NativeTh scope="col" className="iw-number">Betrag</NativeTh><NativeTh scope="col" className="iw-number">Noch offen</NativeTh><NativeTh scope="col">Fällig am</NativeTh><NativeTh scope="col">Nachweise</NativeTh><NativeTh scope="col">Details</NativeTh></NativeTr></NativeThead><NativeTbody>{rows.slice(0, visibleCount).map(row => <NativeTr key={row.id} data-selected={selectedId === row.id}><NativeTd><NativeDiv className="iw-cellcopy"><NativeButton type="button" className="iw-link" onClick={() => openInvoice(row.id)}>{invoiceDisplayNumber(row)}</NativeButton><NativeSmall>{formatInvoiceDate(row.invoiceDate)}</NativeSmall></NativeDiv></NativeTd><NativeTd><NativeDiv className="iw-cellcopy"><NativeStrong>{row.clientName || 'Ohne Klientenbezug'}</NativeStrong>{row.recipient.name && row.recipient.name !== row.clientName && <NativeSmall>{row.recipient.name}</NativeSmall>}</NativeDiv></NativeTd><NativeTd><NativeSpan className="iw-badge" data-tone={invoiceTone(row.status)}>{INVOICE_STATUS_LABELS[row.status]}</NativeSpan>{row.issues.length > 0 && <NativeSmall className="iw-subtle" title={row.issues.join('\n')}>Prüfbedarf · {row.issues.length} {row.issues.length === 1 ? 'Hinweis' : 'Hinweise'}</NativeSmall>}</NativeTd><NativeTd className="iw-number"><NativeStrong>{formatInvoiceMoney(row.amountCents)}</NativeStrong></NativeTd><NativeTd className="iw-number">{['draft', 'cancelled', 'written_off'].includes(row.status) ? '—' : formatInvoiceMoney(row.openCents)}</NativeTd><NativeTd><NativeSpan className={invoiceOverdue(row, today) ? 'iw-overdue' : undefined}>{formatInvoiceDate(row.dueDate)}</NativeSpan>{invoiceOverdue(row, today) && <NativeSmall className="iw-subtle iw-overdue">Überfällig</NativeSmall>}</NativeTd><NativeTd><NativeSmall>{row.includeProofs ? 'Als Anlage vorgesehen' : 'Ohne Anlage'}</NativeSmall></NativeTd><NativeTd><NativeButton type="button" onClick={() => openInvoice(row.id)} aria-label={`Rechnung ${invoiceDisplayNumber(row)} für ${row.clientName} öffnen`}>Öffnen</NativeButton></NativeTd></NativeTr>)}</NativeTbody></NativeTable></NativeDiv><NativeDiv className="iw-pagination"><NativeSpan>{Math.min(visibleCount, rows.length)} von {rows.length} angezeigt</NativeSpan>{visibleCount < rows.length && <NativeButton type="button" onClick={() => setVisibleCount(value => value + 50)}>Weitere anzeigen</NativeButton>}</NativeDiv></>}</NativeSection>
      <NativeP className="iw-footnote">Offene Forderungen berücksichtigen versendete, teilbezahlte und überfällige Rechnungen. Entwürfe, Stornos und Abschreibungen sind darin nicht enthalten. Fehlende Beträge werden als „—“ ausgewiesen.</NativeP>
    </>}
  </NativeSection>;
}
function Metric({ label, value, hint, tone }: {
    label: string;
    value: string;
    hint: string;
    tone?: string;
}) { return <NativeDiv className="iw-kpi" data-tone={tone}><NativeSpan>{label}</NativeSpan><NativeStrong>{value}</NativeStrong><NativeSmall>{hint}</NativeSmall></NativeDiv>; }
