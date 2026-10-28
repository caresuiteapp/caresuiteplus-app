// Generated native presentation from src/screens/business/office/OfficeInvoiceExtensionScreens.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeStyle,NativeDiv,NativeSection,NativeH1,NativeP,NativeHeader,NativeButton,NativeNav,NativeBr,NativeH3,NativeSpan,NativeSmall,NativeLabel,NativeInput,NativeH2,NativeTable,NativeThead,NativeTr,NativeTh,NativeTbody,NativeTd,NativeStrong,NativeSelect,NativeOption,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from "../../../components/layout/ScreenShell.tsx";
import { InvoiceRunsScreen as InvoiceRunWorkspace } from "../../office/InvoicesListScreen.native.tsx";
import { invoiceWorkspaceCss } from "../../../components/office/invoices/invoiceWorkspaceStyles.native.ts";
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { fetchOfficeInvoicePayments, fetchOfficeInvoiceDunning, fetchOfficeInvoiceMonthSummary } from "../../../lib/office/invoiceFinanceWorkspaceService.native.ts";
import { formatInvoiceDate, formatInvoiceMoney, invoiceDay, invoiceDisplayNumber, invoiceMonth, invoiceParam, invoiceTone } from "../../../lib/office/invoiceWorkspaceModel.native.ts";
import { INVOICE_STATUS_LABELS } from '@/lib/office/invoiceStatus';
import type { RoleKey } from '@/types';
type Kind = 'payments' | 'dunning' | 'month-end';
type Scope = {
    tenantId: string;
    roleKey: RoleKey;
    scopeKey: string;
};
type QueryState = {
    loading: boolean;
    refreshing: boolean;
    error: string | null;
    refreshError: string | null;
    refresh: () => Promise<void>;
};
const titles: Record<Kind, string> = { payments: 'Zahlungseingänge', dunning: 'Mahnwesen', 'month-end': 'Monatsübersicht' };
const descriptions: Record<Kind, string> = { payments: 'Erfasste Zahlungen und ihre Rechnungszuordnung.', dunning: 'Bestehende Mahnvorgänge und ihre gespeicherten Angaben.', 'month-end': 'Rechnungen eines Monats und ihr aktueller Zahlungsstand.' };
const statusLabels: Record<string, string> = { pending: 'Ausstehend', received: 'Eingegangen', booked: 'Gebucht', matched: 'Zugeordnet', unmatched: 'Nicht zugeordnet', cancelled: 'Storniert', refunded: 'Erstattet', returned: 'Zurückgebucht', legal: 'Rechtliche Klärung', open: 'Offen', sent: 'Versendet', paid: 'Bezahlt', closed: 'Erledigt', paused: 'Pausiert', draft: 'Entwurf', prepared: 'Vorbereitet', aktiv: 'Aktiv', abgeschlossen: 'Abgeschlossen', in_bearbeitung: 'In Bearbeitung' };
const methodLabels: Record<string, string> = { bank_transfer: 'Überweisung', transfer: 'Überweisung', direct_debit: 'Lastschrift', cash: 'Barzahlung', card: 'Kartenzahlung', paypal: 'PayPal', stripe: 'Stripe', other: 'Sonstige' };
function statusLabel(value: string) { return statusLabels[value] ?? 'Status prüfen'; }
function statusTone(value: string) { return ['paid', 'closed', 'matched', 'booked'].includes(value) ? 'good' : ['unmatched', 'pending', 'open'].includes(value) ? 'warning' : 'muted'; }
function searchable(value: string, search: string) { return value.toLocaleLowerCase('de-DE').includes(search.trim().toLocaleLowerCase('de-DE')); }
export function InvoiceRunsScreen() { return <NativeWorkspaceStyleScope css={[invoiceWorkspaceCss]}>{<InvoiceRunWorkspace />}</NativeWorkspaceStyleScope>; }
export function InvoicePaymentsScreen() { return <NativeWorkspaceStyleScope css={[invoiceWorkspaceCss]}>{<FinanceScreen kind="payments"/>}</NativeWorkspaceStyleScope>; }
export function InvoiceDunningScreen() { return <NativeWorkspaceStyleScope css={[invoiceWorkspaceCss]}>{<FinanceScreen kind="dunning"/>}</NativeWorkspaceStyleScope>; }
export function MonthEndClosingScreen() { return <NativeWorkspaceStyleScope css={[invoiceWorkspaceCss]}>{<FinanceScreen kind="month-end"/>}</NativeWorkspaceStyleScope>; }
function FinanceScreen({ kind }: {
    kind: Kind;
}) {
    const auth = useAuth();
    const tenantId = useServiceTenantId()?.trim() ?? '';
    const { roleKey, permissions, can } = usePermissions();
    const allowed = Boolean(auth.authReady && auth.isAuthenticated && auth.user?.id && tenantId && roleKey && !auth.portalSession && !isPortalOnlyRole(roleKey) && can('office.invoices.view'));
    const scopeKey = JSON.stringify([tenantId, auth.user?.id, roleKey, kind, [...new Set(permissions)].sort()]);
    return <NativeWorkspaceStyleScope css={[invoiceWorkspaceCss, invoiceWorkspaceCss]}>{<ScreenShell title={titles[kind]} contentOwnsHeader><NativeStyle>{invoiceWorkspaceCss}</NativeStyle>{!auth.authReady ? <NativeDiv className="iw iw-empty" role="status">Zugang wird geprüft …</NativeDiv> : allowed && roleKey ? <FinanceBody key={scopeKey} kind={kind} {...{ tenantId, roleKey, scopeKey }}/> : <NativeSection className="iw iw-empty"><NativeH1>{titles[kind]}</NativeH1><NativeP>Für diesen Bereich benötigen Sie einen Verwaltungszugang mit Zugriff auf Rechnungen.</NativeP></NativeSection>}</ScreenShell>}</NativeWorkspaceStyleScope>;
}
function FinanceBody({ kind, ...scope }: Scope & {
    kind: Kind;
}) { return kind === 'payments' ? <PaymentsWorkspace {...scope}/> : kind === 'dunning' ? <DunningWorkspace {...scope}/> : <MonthWorkspace {...scope}/>; }
function FinanceFrame({ kind, query, children }: {
    kind: Kind;
    query: QueryState;
    children: ReactNode;
}) {
    const router = useRouter();
    const focused = useIsFocused();
    const wasFocused = useRef(focused);
    useEffect(() => { if (!focused) {
        wasFocused.current = false;
        return;
    } if (!wasFocused.current) {
        wasFocused.current = true;
        void query.refresh();
    } }, [focused, query.refresh]);
    return <NativeWorkspaceStyleScope css={[invoiceWorkspaceCss]}>{<NativeSection className="iw iw-fade" data-testid={`office-invoice-${kind}`}><NativeHeader className="iw-header"><NativeDiv className="iw-heading"><NativeDiv><NativeP className="iw-eyebrow">Office · Rechnungen</NativeP><NativeH1>{titles[kind]}</NativeH1><NativeP>{descriptions[kind]}</NativeP></NativeDiv></NativeDiv><NativeDiv className="iw-actions"><NativeButton type="button" disabled={query.loading || query.refreshing} onClick={() => void query.refresh()}>{query.refreshing ? 'Wird aktualisiert …' : 'Aktualisieren'}</NativeButton></NativeDiv></NativeHeader><NativeNav className="iw-tabs" aria-label="Abrechnungsbereich"><NativeButton type="button" onClick={() => { if (focused)
        router.push('/business/office/invoices' as never); }}>Rechnungen</NativeButton>{(['payments', 'dunning', 'month-end'] as const).map(item => <NativeButton type="button" key={item} aria-pressed={kind === item} onClick={() => { if (focused && kind !== item)
        router.push(`/business/office/invoices/${item}` as never); }}>{titles[item]}</NativeButton>)}</NativeNav>{(query.error || query.refreshError) && <NativeDiv className="iw-notice" data-tone="error" role="alert">{query.error || query.refreshError}{query.refreshError ? ' Angezeigt wird der letzte erfolgreiche Stand.' : ''}<NativeBr /><NativeButton type="button" disabled={query.loading || query.refreshing} onClick={() => void query.refresh()}>Erneut laden</NativeButton></NativeDiv>}{children}</NativeSection>}</NativeWorkspaceStyleScope>;
}
function useFinanceFilters(defaultMonth = '') {
    const router = useRouter();
    const focused = useIsFocused();
    const params = useLocalSearchParams<{
        month?: string | string[];
        search?: string | string[];
        status?: string | string[];
    }>();
    const search = invoiceParam(params.search).slice(0, 180);
    const month = invoiceMonth(invoiceParam(params.month)) || defaultMonth;
    const status = invoiceParam(params.status);
    const [limit, setLimit] = useState(50);
    useEffect(() => { setLimit(50); }, [search, month, status]);
    function change(values: Record<string, string | undefined>) { if (focused)
        router.setParams(values); }
    function openInvoice(id: string) { if (focused)
        router.push(`/business/office/invoices/${encodeURIComponent(id)}` as never); }
    return { search, month, status, limit, change, openInvoice, more: () => setLimit(value => value + 50) };
}
function FinanceLoading() { return <NativeWorkspaceStyleScope css={[invoiceWorkspaceCss]}>{<NativeDiv role="status" aria-label="Abrechnungsdaten werden geladen"><NativeDiv className="iw-skeleton"/><NativeDiv className="iw-skeleton"/><NativeDiv className="iw-skeleton"/></NativeDiv>}</NativeWorkspaceStyleScope>; }
function FinanceEmpty({ filtered, message, reset }: {
    filtered: boolean;
    message: string;
    reset: () => void;
}) { return <NativeWorkspaceStyleScope css={[invoiceWorkspaceCss]}>{<NativeDiv className="iw-empty"><NativeH3>{filtered ? 'Keine passenden Vorgänge' : 'Keine Vorgänge vorhanden'}</NativeH3><NativeP>{filtered ? 'Ändern Sie die Suche oder den gewählten Zeitraum.' : message}</NativeP>{filtered && <NativeButton type="button" onClick={reset}>Filter zurücksetzen</NativeButton>}</NativeDiv>}</NativeWorkspaceStyleScope>; }
function FinancePagination({ count, limit, more }: {
    count: number;
    limit: number;
    more: () => void;
}) { return <NativeWorkspaceStyleScope css={[invoiceWorkspaceCss]}>{<NativeDiv className="iw-pagination"><NativeSpan>{Math.min(count, limit)} von {count} angezeigt</NativeSpan>{limit < count && <NativeButton type="button" onClick={more}>Weitere anzeigen</NativeButton>}</NativeDiv>}</NativeWorkspaceStyleScope>; }
function FinanceNotice({ issues }: {
    issues: string[];
}) { return issues.length ? <NativeSmall className="iw-subtle" title={issues.join('\n')}>{issues.length} {issues.length === 1 ? 'Prüfhinweis' : 'Prüfhinweise'}</NativeSmall> : null; }
function PaymentsWorkspace({ tenantId, roleKey, scopeKey }: Scope) {
    const query = useAsyncQuery(useCallback(() => fetchOfficeInvoicePayments(tenantId, roleKey), [tenantId, roleKey]), [scopeKey], { queryKey: scopeKey, retryCount: 0 });
    const f = useFinanceFilters();
    const filtered = Boolean(f.search || f.month);
    const rows = useMemo(() => (query.data ?? []).filter(row => (!f.month || row.paymentDate.startsWith(f.month)) && searchable(`${row.invoiceNumber} ${row.clientName} ${row.recipientName} ${row.reference}`, f.search)), [query.data, f.month, f.search]);
    return <NativeWorkspaceStyleScope css={[invoiceWorkspaceCss]}>{<FinanceFrame kind="payments" query={query}><NativeDiv className="iw-toolbar"><NativeLabel className="iw-search">Zahlungen suchen<NativeInput type="search" maxLength={180} value={f.search} placeholder="Rechnung, Klient:in oder Buchungsreferenz" onChange={event => f.change({ search: event.target.value || undefined })}/></NativeLabel><NativeLabel className="iw-period">Zahlungsmonat<NativeDiv><NativeInput type="month" value={f.month} min="2000-01" max="2100-12" onChange={event => f.change({ month: invoiceMonth(event.target.value) || undefined })}/>{f.month && <NativeButton type="button" onClick={() => f.change({ month: undefined })}>Alle</NativeButton>}</NativeDiv></NativeLabel></NativeDiv>{query.data && <NativeDiv className="iw-filterline"><NativeSpan>{rows.length} von {query.data.length} Zahlungen</NativeSpan>{filtered && <NativeButton type="button" className="iw-link" onClick={() => f.change({ search: undefined, month: undefined })}>Filter zurücksetzen</NativeButton>}</NativeDiv>}<NativeSection className="iw-panel" aria-busy={query.loading || query.refreshing}><NativeDiv className="iw-panel-head"><NativeH2>Erfasste Zahlungen</NativeH2><NativeSmall>Zuordnung und Status aus dem Zahlungsbestand</NativeSmall></NativeDiv>{query.loading && !query.data ? <FinanceLoading /> : !query.data ? <NativeDiv className="iw-empty">Zahlungseingänge konnten nicht bestätigt werden.</NativeDiv> : !rows.length ? <FinanceEmpty filtered={filtered} message="Es wurden noch keine Zahlungen erfasst. Einen tatsächlichen Zahlungseingang können Sie in der jeweiligen Rechnung buchen." reset={() => f.change({ search: undefined, month: undefined })}/> : <><NativeDiv className="iw-table-scroll" role="region" aria-label="Zahlungseingänge, horizontal scrollbar" tabIndex={0}><NativeTable><NativeThead><NativeTr><NativeTh scope="col">Zahlungsdatum</NativeTh><NativeTh scope="col">Rechnung / Klient:in</NativeTh><NativeTh scope="col" className="iw-number">Betrag</NativeTh><NativeTh scope="col">Zahlungsart</NativeTh><NativeTh scope="col">Referenz</NativeTh><NativeTh scope="col">Status</NativeTh><NativeTh scope="col">Rechnung</NativeTh></NativeTr></NativeThead><NativeTbody>{rows.slice(0, f.limit).map(row => <NativeTr key={row.id}><NativeTd>{formatInvoiceDate(row.paymentDate)}{row.valueDate && <NativeSmall className="iw-subtle">Wertstellung {formatInvoiceDate(row.valueDate)}</NativeSmall>}</NativeTd><NativeTd><NativeDiv className="iw-cellcopy"><NativeStrong>{row.invoiceNumber || 'Ohne Rechnungszuordnung'}</NativeStrong><NativeSmall>{row.clientName || row.recipientName || 'Zuordnung offen'}</NativeSmall></NativeDiv></NativeTd><NativeTd className="iw-number"><NativeStrong>{formatInvoiceMoney(row.amountCents)}</NativeStrong>{row.currency !== 'EUR' && <NativeSmall className="iw-subtle">Währung {row.currency || 'ungeklärt'}</NativeSmall>}</NativeTd><NativeTd>{methodLabels[row.method] ?? 'Zahlungsart prüfen'}</NativeTd><NativeTd><NativeDiv className="iw-cellcopy">{row.reference || '—'}</NativeDiv></NativeTd><NativeTd><NativeSpan className="iw-badge" data-tone={statusTone(row.status)}>{statusLabel(row.status)}</NativeSpan><FinanceNotice issues={row.issues}/></NativeTd><NativeTd>{row.invoiceId ? <NativeButton type="button" onClick={() => f.openInvoice(row.invoiceId!)}>Öffnen</NativeButton> : <NativeSmall>Nicht zugeordnet</NativeSmall>}</NativeTd></NativeTr>)}</NativeTbody></NativeTable></NativeDiv><FinancePagination count={rows.length} limit={f.limit} more={f.more}/></>}</NativeSection><NativeP className="iw-footnote">Die Übersicht zeigt einzelne erfasste Zahlungen einschließlich ihres Bearbeitungsstands. Zahlungseingänge werden in der zugehörigen Rechnung gebucht; Fremdwährungen werden hier nicht in Euro umgerechnet.</NativeP></FinanceFrame>}</NativeWorkspaceStyleScope>;
}
function DunningWorkspace({ tenantId, roleKey, scopeKey }: Scope) {
    const query = useAsyncQuery(useCallback(() => fetchOfficeInvoiceDunning(tenantId, roleKey), [tenantId, roleKey]), [scopeKey], { queryKey: scopeKey, retryCount: 0 });
    const f = useFinanceFilters();
    const status = ['open', 'sent', 'paid', 'paused', 'legal', 'cancelled'].includes(f.status) ? f.status : '';
    const filtered = Boolean(f.search || status);
    const rows = useMemo(() => (query.data ?? []).filter(row => (!status || row.status === status) && searchable(`${row.invoiceNumber} ${row.clientName} ${row.recipientName}`, f.search)), [query.data, status, f.search]);
    return <NativeWorkspaceStyleScope css={[invoiceWorkspaceCss]}>{<FinanceFrame kind="dunning" query={query}><NativeDiv className="iw-toolbar"><NativeLabel className="iw-search">Mahnvorgänge suchen<NativeInput type="search" maxLength={180} value={f.search} placeholder="Rechnung, Klient:in oder Empfänger" onChange={event => f.change({ search: event.target.value || undefined })}/></NativeLabel><NativeLabel className="iw-status">Status<NativeSelect value={status} onChange={event => f.change({ status: event.target.value || undefined })}><NativeOption value="">Alle Vorgänge</NativeOption><NativeOption value="open">Offen</NativeOption><NativeOption value="sent">Versendet</NativeOption><NativeOption value="paid">Bezahlt</NativeOption><NativeOption value="paused">Pausiert</NativeOption><NativeOption value="legal">Rechtliche Klärung</NativeOption><NativeOption value="cancelled">Storniert</NativeOption></NativeSelect></NativeLabel></NativeDiv>{query.data && <NativeDiv className="iw-filterline"><NativeSpan>{rows.length} von {query.data.length} Mahnvorgängen</NativeSpan>{filtered && <NativeButton type="button" className="iw-link" onClick={() => f.change({ search: undefined, status: undefined })}>Filter zurücksetzen</NativeButton>}</NativeDiv>}<NativeSection className="iw-panel" aria-busy={query.loading || query.refreshing}><NativeDiv className="iw-panel-head"><NativeH2>Bestehende Mahnvorgänge</NativeH2><NativeSmall>Gespeicherte Fälle</NativeSmall></NativeDiv>{query.loading && !query.data ? <FinanceLoading /> : !query.data ? <NativeDiv className="iw-empty">Mahnvorgänge konnten nicht bestätigt werden.</NativeDiv> : !rows.length ? <FinanceEmpty filtered={filtered} message="Für diesen Mandanten sind keine Mahnvorgänge hinterlegt. Überfällige Rechnungen finden Sie über den Statusfilter in der Rechnungsübersicht." reset={() => f.change({ search: undefined, status: undefined })}/> : <><NativeDiv className="iw-table-scroll" role="region" aria-label="Mahnvorgänge, horizontal scrollbar" tabIndex={0}><NativeTable><NativeThead><NativeTr><NativeTh scope="col">Rechnung / Klient:in</NativeTh><NativeTh scope="col">Empfänger</NativeTh><NativeTh scope="col">Mahnstufe</NativeTh><NativeTh scope="col">Fälligkeit</NativeTh><NativeTh scope="col" className="iw-number">Betrag bei Mahnung</NativeTh><NativeTh scope="col">Status</NativeTh><NativeTh scope="col">Rechnung</NativeTh></NativeTr></NativeThead><NativeTbody>{rows.slice(0, f.limit).map(row => <NativeTr key={row.id}><NativeTd><NativeDiv className="iw-cellcopy"><NativeStrong>{row.invoiceNumber || 'Rechnungsnummer fehlt'}</NativeStrong><NativeSmall>{row.clientName || 'Zuordnung offen'}</NativeSmall></NativeDiv></NativeTd><NativeTd><NativeDiv className="iw-cellcopy">{row.recipientName || '—'}</NativeDiv></NativeTd><NativeTd>{row.level ?? '—'}</NativeTd><NativeTd>{formatInvoiceDate(row.dueDate)}</NativeTd><NativeTd className="iw-number"><NativeStrong>{formatInvoiceMoney(row.openCents)}</NativeStrong></NativeTd><NativeTd><NativeSpan className="iw-badge" data-tone={statusTone(row.status)}>{statusLabel(row.status)}</NativeSpan><FinanceNotice issues={row.issues}/></NativeTd><NativeTd>{row.invoiceId ? <NativeButton type="button" onClick={() => f.openInvoice(row.invoiceId!)}>Öffnen</NativeButton> : <NativeSmall>Nicht zugeordnet</NativeSmall>}</NativeTd></NativeTr>)}</NativeTbody></NativeTable></NativeDiv><FinancePagination count={rows.length} limit={f.limit} more={f.more}/></>}</NativeSection><NativeP className="iw-footnote">Der Betrag bei Erstellung der Mahnung kann vom heutigen offenen Rechnungsbetrag abweichen. Diese Ansicht zeigt vorhandene Vorgänge und versendet keine Mahnungen.</NativeP></FinanceFrame>}</NativeWorkspaceStyleScope>;
}
function MonthWorkspace({ tenantId, roleKey, scopeKey }: Scope) {
    const f = useFinanceFilters(invoiceDay().slice(0, 7));
    const query = useAsyncQuery(useCallback(() => fetchOfficeInvoiceMonthSummary(tenantId, f.month, roleKey), [tenantId, f.month, roleKey]), [scopeKey, f.month], { queryKey: `${scopeKey}:${f.month}`, retryCount: 0 });
    const summary = query.data;
    const rows = useMemo(() => (summary?.invoices ?? []).filter(row => searchable(`${row.invoiceNumber} ${row.clientName} ${row.recipient.name}`, f.search)), [summary, f.search]);
    return <NativeWorkspaceStyleScope css={[invoiceWorkspaceCss]}>{<FinanceFrame kind="month-end" query={query}><NativeDiv className="iw-toolbar"><NativeLabel className="iw-period">Rechnungsmonat<NativeInput type="month" value={f.month} min="2000-01" max="2100-12" onChange={event => { if (invoiceMonth(event.target.value))
        f.change({ month: event.target.value }); }}/></NativeLabel><NativeLabel className="iw-search">Rechnungen im Monat suchen<NativeInput type="search" value={f.search} maxLength={180} placeholder="Rechnung, Klient:in oder Empfänger" onChange={event => f.change({ search: event.target.value || undefined })}/></NativeLabel></NativeDiv>{summary && <><NativeDiv className="iw-kpis"><MonthMetric label="Freigegebene Rechnungen" value={String(summary.issuedCount)} hint={`${summary.draftCount} offene Entwürfe separat`}/><MonthMetric label="Rechnungsbetrag" value={formatInvoiceMoney(summary.totalCents)} hint="Freigegeben · ohne Stornos und Abschreibungen"/><MonthMetric label="Darauf gebuchte Zahlungen" value={formatInvoiceMoney(summary.paidCents)} hint="Bisheriger Stand dieser Rechnungen"/><MonthMetric label="Aktuell noch offen" value={formatInvoiceMoney(summary.openCents)} hint="Einschließlich noch nicht versendeter Freigaben"/></NativeDiv>{summary.unknownCount > 0 && <NativeDiv className="iw-notice" data-tone="warning" role="status">Bei {summary.unknownCount} Rechnungen sind Beträge unvollständig. Betroffene Summen bleiben als „—“ gekennzeichnet.</NativeDiv>}<NativeDiv className="iw-filterline"><NativeSpan>{rows.length} von {summary.invoices.length} Rechnungen · Kennzahlen für den gesamten Monat</NativeSpan>{f.search && <NativeButton type="button" className="iw-link" onClick={() => f.change({ search: undefined })}>Suche zurücksetzen</NativeButton>}</NativeDiv></>}<NativeSection className="iw-panel" aria-busy={query.loading || query.refreshing}><NativeDiv className="iw-panel-head"><NativeH2>Rechnungen im gewählten Monat</NativeH2><NativeSmall>Zuordnung nach Rechnungsdatum</NativeSmall></NativeDiv>{query.loading && !summary ? <FinanceLoading /> : !summary ? <NativeDiv className="iw-empty">Der Monatsstand konnte nicht bestätigt werden.</NativeDiv> : !rows.length ? <FinanceEmpty filtered={!!f.search} message="Für diesen Rechnungsmonat sind keine Rechnungen vorhanden." reset={() => f.change({ search: undefined })}/> : <><NativeDiv className="iw-table-scroll" role="region" aria-label="Monatliche Rechnungsübersicht, horizontal scrollbar" tabIndex={0}><NativeTable><NativeThead><NativeTr><NativeTh scope="col">Rechnung</NativeTh><NativeTh scope="col">Klient:in</NativeTh><NativeTh scope="col">Status</NativeTh><NativeTh scope="col" className="iw-number">Betrag</NativeTh><NativeTh scope="col" className="iw-number">Gebucht</NativeTh><NativeTh scope="col" className="iw-number">Offen</NativeTh><NativeTh scope="col">Details</NativeTh></NativeTr></NativeThead><NativeTbody>{rows.slice(0, f.limit).map(row => <NativeTr key={row.id}><NativeTd><NativeDiv className="iw-cellcopy"><NativeStrong>{invoiceDisplayNumber(row)}</NativeStrong><NativeSmall>{formatInvoiceDate(row.invoiceDate)}</NativeSmall></NativeDiv></NativeTd><NativeTd><NativeDiv className="iw-cellcopy">{row.clientName}<FinanceNotice issues={row.issues}/></NativeDiv></NativeTd><NativeTd><NativeSpan className="iw-badge" data-tone={invoiceTone(row.status)}>{INVOICE_STATUS_LABELS[row.status]}</NativeSpan></NativeTd><NativeTd className="iw-number">{formatInvoiceMoney(row.amountCents)}</NativeTd><NativeTd className="iw-number">{formatInvoiceMoney(row.paidCents)}</NativeTd><NativeTd className="iw-number">{['draft', 'cancelled', 'written_off'].includes(row.status) ? '—' : formatInvoiceMoney(row.openCents)}</NativeTd><NativeTd><NativeButton type="button" onClick={() => f.openInvoice(row.id)}>Öffnen</NativeButton></NativeTd></NativeTr>)}</NativeTbody></NativeTable></NativeDiv><FinancePagination count={rows.length} limit={f.limit} more={f.more}/></>}</NativeSection><NativeP className="iw-footnote">Die Monatsübersicht zeigt den heutigen Stand der Rechnungen mit Rechnungsdatum im gewählten Monat. Gebuchte Zahlungen können auch aus späteren Monaten stammen. Die Ansicht ist keine Festschreibung und kein Nachweis eines abgeschlossenen Rechnungslaufs.</NativeP></FinanceFrame>}</NativeWorkspaceStyleScope>;
}
function MonthMetric({ label, value, hint }: {
    label: string;
    value: string;
    hint: string;
}) { return <NativeWorkspaceStyleScope css={[invoiceWorkspaceCss]}>{<NativeDiv className="iw-kpi"><NativeSpan>{label}</NativeSpan><NativeStrong>{value}</NativeStrong><NativeSmall>{hint}</NativeSmall></NativeDiv>}</NativeWorkspaceStyleScope>; }
