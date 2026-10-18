import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { inspectOfficeEInvoiceImport, type OfficeEInvoiceImportInspection, type OfficeEInvoiceXmlPreview } from '@/lib/office/eInvoiceImport.web';
import { downloadOfficeEInvoiceOriginal, fetchOfficeEInvoiceInbox, reviewOfficeEInvoiceInbox, saveOfficeEInvoiceImport, validateOfficeEInvoiceInbox } from '@/lib/office/eInvoiceInboxService.web';
import type { OfficeEInvoiceInboxRecord } from '@/lib/office/eInvoiceInboxTypes.web';
import { formatInvoiceDate, invoiceMonth, invoiceParam } from '@/lib/office/invoiceWorkspaceModel.web';
import type { RoleKey } from '@/types';
import { eInvoiceInboxCss } from './eInvoiceInboxStyles.web';

type ReviewStatus = OfficeEInvoiceInboxRecord['reviewStatus'];
type Params = { search?: string | string[]; month?: string | string[]; review?: string | string[]; sort?: string | string[]; document?: string | string[] };
const reviewLabels: Record<ReviewStatus, string> = { unreviewed: 'Offen', reviewed: 'Sachlich geprüft', rejected: 'Beanstandet' };
const reviewTone: Record<ReviewStatus, string> = { unreviewed: 'warning', reviewed: 'good', rejected: 'bad' };
const syntaxLabels = { ubl_invoice: 'UBL-Rechnung', ubl_credit_note: 'UBL-Gutschrift', cii: 'UN/CEFACT CII' };
const validationLabels: Record<string, { label: string; tone: string }> = {
  valid: { label: 'Formatprüfung bestanden', tone: 'good' },
  invalid: { label: 'Formatfehler', tone: 'bad' },
  unsupported: { label: 'Format nicht unterstützt', tone: 'warning' },
  pending_validation: { label: 'Normprüfung ausstehend', tone: 'warning' },
  unavailable: { label: 'Normprüfung ausstehend', tone: 'warning' },
  error: { label: 'Prüfung fehlgeschlagen', tone: 'bad' },
};
function validationBadge(status: string) { return validationLabels[status] ?? validationLabels.pending_validation; }

function documentMoney(value: string, currency: string) {
  if (!value) return '—';
  const amount = Number(value);
  if (!/^-?\d+(\.\d+)?$/.test(value) || !Number.isFinite(amount) || Math.abs(amount) > Number.MAX_SAFE_INTEGER / 100 || !/^[A-Z]{3}$/.test(currency)) return `${value}${currency ? ` ${currency}` : ''}`;
  try { return new Intl.NumberFormat('de-DE', { style: 'currency', currency, maximumFractionDigits: Math.max(2, Math.min(6, value.split('.')[1]?.length ?? 0)) }).format(amount); }
  catch { return `${value} ${currency}`; }
}
function dateTime(value: string) {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' }) : '—';
}
function fileSize(value: number) { return `${(value / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 2 })} MB`; }
function message(cause: unknown, fallback: string) { return cause instanceof Error ? cause.message : fallback; }

export function EInvoiceInbox() {
  const auth = useAuth();
  const tenantId = useServiceTenantId()?.trim() ?? '';
  const { roleKey, permissions, can } = usePermissions();
  const allowed = Boolean(auth.authReady && auth.isAuthenticated && auth.user?.id && tenantId && roleKey && !auth.portalSession && !isPortalOnlyRole(roleKey) && can('office.invoices.view'));
  const scopeKey = JSON.stringify([tenantId, auth.user?.id, roleKey, [...new Set(permissions)].sort()]);
  return <><style>{eInvoiceInboxCss}</style>{!auth.authReady ? <section className="iw iw-empty" role="status">Zugang wird geprüft …</section> : !allowed || !roleKey ? <section className="iw iw-empty"><h1>Rechnungseingang</h1><p>Für diesen Bereich benötigen Sie einen Verwaltungszugang mit Zugriff auf Rechnungen.</p></section> : <InboxContent key={scopeKey} {...{ tenantId, roleKey, scopeKey }} canImport={can('office.invoices.create')} canReview={can('office.invoices.status_change')} />}</>;
}

function InboxContent({ tenantId, roleKey, scopeKey, canImport, canReview }: { tenantId: string; roleKey: RoleKey; scopeKey: string; canImport: boolean; canReview: boolean }) {
  const router = useRouter(); const navigation = useNavigation(); const focused = useIsFocused();
  const params = useLocalSearchParams<Params>();
  const search = invoiceParam(params.search).slice(0, 180); const month = invoiceMonth(invoiceParam(params.month));
  const reviewParam = invoiceParam(params.review); const review = ['unreviewed', 'reviewed', 'rejected'].includes(reviewParam) ? reviewParam as ReviewStatus : '';
  const sortParam = invoiceParam(params.sort); const sort = ['date', 'seller', 'number'].includes(sortParam) ? sortParam : 'received';
  const selectedId = invoiceParam(params.document);
  const [pending, setPending] = useState<OfficeEInvoiceImportInspection | null>(null);
  const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [reviewDirty, setReviewDirty] = useState(false); const [reviewRevision, setReviewRevision] = useState(0); const [limit, setLimit] = useState(30);
  const [visibleSelected, setVisibleSelected] = useState<OfficeEInvoiceInboxRecord | null>(null);
  const mounted = useRef(true); const lock = useRef(false); const leaveAllowed = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null); const detail = useRef<HTMLElement>(null);
  const query = useAsyncQuery(useCallback(() => fetchOfficeEInvoiceInbox(tenantId, roleKey), [tenantId, roleKey]), [scopeKey], { queryKey: `office-einvoice-inbox:${scopeKey}`, retryCount: 0, refreshOnAppFocus: false });
  const selected = visibleSelected?.id === selectedId ? visibleSelected : query.data?.find(item => item.id === selectedId) ?? null;
  const filtered = Boolean(search || month || review);
  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('de-DE');
    return (query.data ?? []).filter(row => (!month || row.preview.issueDate.startsWith(month)) && (!review || row.reviewStatus === review) && (!term || `${row.preview.invoiceNumber} ${row.preview.seller.name} ${row.preview.buyer.name} ${row.originalFileName}`.toLocaleLowerCase('de-DE').includes(term))).sort((a, b) => {
      if (sort === 'seller') return a.preview.seller.name.localeCompare(b.preview.seller.name, 'de');
      if (sort === 'number') return a.preview.invoiceNumber.localeCompare(b.preview.invoiceNumber, 'de', { numeric: true });
      return (sort === 'date' ? b.preview.issueDate.localeCompare(a.preview.issueDate) : b.createdAt.localeCompare(a.createdAt)) || a.id.localeCompare(b.id);
    });
  }, [query.data, search, month, review, sort]);
  const duplicate = pending ? query.data?.find(row => row.originalSha256 === pending.originalSha256) : null;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setLimit(30); }, [search, month, review, sort]);
  useEffect(() => { if (selectedId && selected && !pending) detail.current?.focus({ preventScroll: true }); }, [selectedId, Boolean(selected), Boolean(pending)]);
  const dirty = Boolean(pending || reviewDirty);
  function mayLeave() {
    if (lock.current) return false;
    if (leaveAllowed.current || !dirty) return true;
    return window.confirm(pending ? 'Diese Datei wurde noch nicht importiert. Die lokale Vorschau verwerfen?' : 'Die Änderungen an der sachlichen Prüfung wurden noch nicht gespeichert. Verwerfen?');
  }
  usePreventRemove(dirty || Boolean(busy), ({ data }) => { if (mayLeave()) { leaveAllowed.current = true; navigation.dispatch(data.action); } });
  useEffect(() => {
    if (!dirty && !busy) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { if (!leaveAllowed.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload); return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty, busy]);
  function updateParams(values: Record<string, string | undefined>) { if (focused && !lock.current) router.setParams(values); }
  function openRecord(row: OfficeEInvoiceInboxRecord) {
    if (!focused || !mayLeave()) return;
    setPending(null); setReviewDirty(false); setReviewRevision(value => value + 1); setVisibleSelected(row); setError(''); leaveAllowed.current = false;
    router.setParams({ document: row.id });
    window.requestAnimationFrame(() => detail.current?.scrollIntoView({ block: 'start', behavior: 'auto' }));
  }
  async function inspect(file: File | undefined) {
    if (!file || !canImport || !focused || lock.current || !mayLeave()) return;
    lock.current = true; setBusy('inspect'); setError(''); setNotice(''); leaveAllowed.current = false;
    try {
      const result = await inspectOfficeEInvoiceImport(file);
      if (mounted.current) { setPending(result); setReviewDirty(false); setReviewRevision(value => value + 1); window.requestAnimationFrame(() => detail.current?.scrollIntoView({ block: 'start', behavior: 'auto' })); }
    } catch (cause) { if (mounted.current) setError(message(cause, 'Die Datei konnte nicht gelesen werden.')); }
    finally { lock.current = false; if (mounted.current) { setBusy(''); if (fileInput.current) fileInput.current.value = ''; } }
  }
  async function importFile() {
    if (!pending || !canImport || !focused || lock.current) return;
    lock.current = true; setBusy('import'); setError(''); setNotice('');
    try {
      const result = await saveOfficeEInvoiceImport(tenantId, pending, roleKey);
      if (!mounted.current) return;
      if (!result.ok) { setError(result.error); return; }
      const { record, duplicate: existed } = result.data;
      query.setData(current => [record, ...(current ?? []).filter(row => row.id !== record.id)]);
      setPending(null); setVisibleSelected(record); setReviewDirty(false); router.setParams({ document: record.id });
      setNotice(existed ? 'Dieses Original ist bereits im Rechnungseingang gespeichert. Der vorhandene Eintrag wurde geöffnet.' : 'Originaldatei und Rechnungs-XML sind gespeichert. Die sachliche Prüfung ist noch offen.');
      window.requestAnimationFrame(() => detail.current?.scrollIntoView({ block: 'start', behavior: 'auto' }));
    } catch (cause) { if (mounted.current) setError(message(cause, 'Die Rechnung konnte nicht importiert werden.')); }
    finally { lock.current = false; if (mounted.current) setBusy(''); }
  }
  async function download(record: OfficeEInvoiceInboxRecord, part: 'original' | 'xml') {
    if (!focused || lock.current) return;
    lock.current = true; setBusy(`download-${part}`); setError('');
    try {
      const result = await downloadOfficeEInvoiceOriginal(tenantId, record.id, part, roleKey);
      if (!mounted.current) return;
      if (!result.ok) { setError(result.error); return; }
      const url = URL.createObjectURL(new Blob([new Uint8Array(result.data.bytes)], { type: result.data.mimeType }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = result.data.fileName; anchor.rel = 'noopener';
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (cause) { if (mounted.current) setError(message(cause, 'Das Original konnte nicht heruntergeladen werden.')); }
    finally { lock.current = false; if (mounted.current) setBusy(''); }
  }
  async function saveReview(record: OfficeEInvoiceInboxRecord, status: ReviewStatus, note: string) {
    if (!canReview || !focused || lock.current) return false;
    lock.current = true; setBusy('review'); setError(''); setNotice('');
    try {
      const result = await reviewOfficeEInvoiceInbox(tenantId, record.id, { status, note: note.trim(), expectedUpdatedAt: record.updatedAt }, roleKey);
      if (!mounted.current) return false;
      if (!result.ok) { setError(result.error); return false; }
      query.setData(current => (current ?? []).map(row => row.id === result.data.id ? result.data : row));
      setVisibleSelected(result.data); setReviewDirty(false); setNotice('Die sachliche Prüfung wurde gespeichert. Der Stand der Normprüfung bleibt davon unabhängig.');
      return true;
    } catch (cause) { if (mounted.current) setError(message(cause, 'Der Prüfstand konnte nicht gespeichert werden.')); return false; }
    finally { lock.current = false; if (mounted.current) setBusy(''); }
  }
  async function validate(record: OfficeEInvoiceInboxRecord) {
    if (!canImport || !focused || lock.current || reviewDirty) return;
    lock.current = true; setBusy('validate'); setError(''); setNotice('');
    try {
      const result = await validateOfficeEInvoiceInbox(tenantId, record.id, roleKey);
      if (!mounted.current) return;
      if (!result.ok) { setError(result.error); return; }
      query.setData(current => (current ?? []).map(row => row.id === result.data.id ? result.data : row));
      setVisibleSelected(result.data);
      setNotice('Das Ergebnis der Formatprüfung ist gespeichert. Die sachliche Prüfung bleibt davon unabhängig.');
    } catch (cause) { if (mounted.current) setError(message(cause, 'Die Formatprüfung konnte nicht abgeschlossen werden.')); }
    finally { lock.current = false; if (mounted.current) setBusy(''); }
  }
  async function refresh() {
    if (lock.current || !mayLeave()) return;
    setReviewDirty(false); setReviewRevision(value => value + 1); setVisibleSelected(null); setPending(null); setError('');
    await query.refresh();
  }
  function cancelPending() { if (!lock.current) { setPending(null); setError(''); if (fileInput.current) fileInput.current.value = ''; } }
  const queryError = query.error || query.refreshError;
  return <section className="iw ei iw-fade" data-testid="office-einvoice-inbox" data-healthos-einvoice-inbox="20261018">
    <header className="iw-header"><div className="iw-heading"><span className="iw-mark" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 3v11m-4-4 4 4 4-4M4 15v5h16v-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></span><div><p className="iw-eyebrow">Office · Rechnungen</p><h1>Rechnungseingang</h1><p>Rechnungen für Ihr Unternehmen lesen, prüfen und als Original ablegen.</p></div></div><div className="iw-actions"><button type="button" disabled={Boolean(busy) || query.loading || query.refreshing} onClick={() => void refresh()}>{query.refreshing ? 'Wird aktualisiert …' : 'Aktualisieren'}</button></div></header>
    <nav className="iw-tabs" aria-label="Rechnungsbereich"><button type="button" disabled={Boolean(busy)} onClick={() => { if (focused && mayLeave()) { leaveAllowed.current = true; router.push('/business/office/invoices' as never); } }}>Ausgangsrechnungen</button><span className="ei-current-tab" aria-current="page">Rechnungseingang</span></nav>
    {error && <div className="iw-notice" data-tone="error" role="alert">{error}</div>}
    {notice && <div className="iw-notice" data-tone="success" role="status">{notice}</div>}
    {queryError && <div className="iw-notice" data-tone="error" role="alert">{queryError}{query.data ? ' Die Liste zeigt den letzten erfolgreichen Stand.' : ''}<br /><button type="button" disabled={Boolean(busy) || query.loading || query.refreshing} onClick={() => void refresh()}>Erneut laden</button></div>}
    {canImport && <section className="ei-upload" aria-busy={busy === 'inspect'}><div><p className="iw-eyebrow">Neuer Eingang</p><h2>XML oder PDF mit Rechnungs-XML auswählen</h2><p>Die Vorschau wird zuerst lokal erstellt. Erst „Original importieren“ speichert die Datei im Rechnungseingang Ihres Unternehmens.</p><small>XML bis 5 MB · PDF bis 10 MB · Keine automatische Zahlung oder Buchung</small></div><label className="ei-upload-control">{busy === 'inspect' ? 'Datei wird gelesen …' : 'Datei auswählen'}<input ref={fileInput} type="file" accept=".xml,.pdf,application/xml,text/xml,application/pdf" aria-label="Rechnungsdatei auswählen" disabled={Boolean(busy)} onChange={event => void inspect(event.currentTarget.files?.[0])} /></label></section>}
    {pending && <section ref={detail} tabIndex={-1} className="iw-panel ei-detail" aria-label="Importvorschau"><div className="iw-panel-head"><div><p className="iw-eyebrow">Noch nicht gespeichert</p><h2>Importvorschau</h2></div><div className="iw-actions"><button type="button" disabled={Boolean(busy)} onClick={cancelPending}>Verwerfen</button>{duplicate ? <button type="button" className="iw-primary" disabled={Boolean(busy)} onClick={() => openRecord(duplicate)}>Vorhandenen Eintrag öffnen</button> : <button type="button" className="iw-primary" disabled={Boolean(busy)} onClick={() => void importFile()}>{busy === 'import' ? 'Original wird gespeichert …' : 'Original importieren'}</button>}</div></div><div className="ei-detail-body">{duplicate && <div className="iw-notice" data-tone="warning">Diese Originaldatei ist bereits gespeichert. Ein erneuter Import erzeugt keinen zweiten Eintrag.</div>}<div className="ei-file"><strong>{pending.originalFileName}</strong><small>{pending.sourceKind === 'hybrid_pdf' ? 'PDF mit Rechnungs-XML' : 'XML-Datei'} · {fileSize(pending.originalBytes.byteLength)}{pending.sourceKind === 'hybrid_pdf' ? ` · Eingebettete Datei: ${pending.xmlFileName}` : ''}</small></div><FormatCheck message="Die Datei wurde ausgelesen. Nach dem Import können Sie die Formatprüfung für das gespeicherte Original starten. Die Vorschau bestätigt keine Formatkonformität." /><StructuredPreview preview={pending.preview} warnings={pending.warnings} /><p className="iw-footnote">Die Vorschau zeigt ausgelesene Rechnungsdaten. Prüfen Sie Rechnungsempfänger, Leistung und Beträge vor der sachlichen Freigabe.</p></div></section>}
    <div className="iw-toolbar"><label className="iw-search">Eingänge suchen<input type="search" maxLength={180} value={search} placeholder="Rechnungsnummer, Lieferant oder Dateiname" onChange={event => updateParams({ search: event.target.value || undefined })} /></label><label className="iw-period">Rechnungsmonat<input type="month" value={month} min="2000-01" max="2100-12" onChange={event => updateParams({ month: invoiceMonth(event.target.value) || undefined })} /></label><label className="iw-status">Sachliche Prüfung<select value={review} onChange={event => updateParams({ review: event.target.value || undefined })}><option value="">Alle Prüfstände</option>{Object.entries(reviewLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="iw-sort">Sortierung<select value={sort} onChange={event => updateParams({ sort: event.target.value === 'received' ? undefined : event.target.value })}><option value="received">Zuletzt importiert</option><option value="date">Neuestes Rechnungsdatum</option><option value="seller">Lieferant A–Z</option><option value="number">Rechnungsnummer</option></select></label></div>
    {query.data && <div className="iw-filterline"><span>{rows.length} von {query.data.length} Eingängen · {(query.data.filter(row => row.reviewStatus === 'unreviewed')).length} sachlich ungeprüft</span>{filtered && <button type="button" className="iw-link" disabled={Boolean(busy)} onClick={() => updateParams({ search: undefined, month: undefined, review: undefined })}>Filter zurücksetzen</button>}</div>}
    <section className="iw-panel" aria-busy={query.loading || query.refreshing}><div className="iw-panel-head"><h2>Gespeicherte Eingänge</h2><small>Originale Ihres Unternehmens</small></div>{query.loading && !query.data ? <div role="status" aria-label="Rechnungseingang wird geladen"><div className="iw-skeleton" /><div className="iw-skeleton" /></div> : !query.data ? <div className="iw-empty"><h3>Rechnungseingang nicht verfügbar</h3><p>Die gespeicherten Eingänge konnten nicht geladen werden.</p></div> : !rows.length ? <div className="iw-empty"><h3>{filtered ? 'Keine passenden Eingänge' : 'Noch keine Rechnung importiert'}</h3><p>{filtered ? 'Ändern Sie die Suche, den Monat oder den Prüfstand.' : canImport ? 'Wählen Sie eine XML-Rechnung oder eine PDF mit eingebettetem Rechnungs-XML aus. Eine Klientenzuordnung ist nicht erforderlich.' : 'Hier erscheinen die für Ihr Unternehmen importierten Rechnungen.'}</p></div> : <><div className="iw-table-scroll" role="region" aria-label="Rechnungseingänge, bei Bedarf horizontal scrollbar" tabIndex={0}><table className="ei-inbox-table"><thead><tr><th scope="col">Rechnung / Lieferant</th><th scope="col">Rechnungsdatum</th><th scope="col" className="iw-number">Zahlbetrag laut XML</th><th scope="col">Sachliche Prüfung</th><th scope="col">Importiert am</th><th scope="col">Details</th></tr></thead><tbody>{rows.slice(0, limit).map(row => <tr key={row.id} data-selected={selectedId === row.id}><td><div className="iw-cellcopy"><button type="button" className="iw-link" disabled={Boolean(busy)} onClick={() => openRecord(row)}>{row.preview.invoiceNumber || 'Rechnungsnummer fehlt'}</button><strong className="ei-seller">{row.preview.seller.name || 'Lieferant fehlt'}</strong><small>{row.originalFileName}</small></div></td><td>{formatInvoiceDate(row.preview.issueDate)}</td><td className="iw-number">{documentMoney(row.preview.totals.payable, row.preview.currency)}</td><td><span className="iw-badge" data-tone={reviewTone[row.reviewStatus]}>{reviewLabels[row.reviewStatus]}</span><small className="iw-subtle" data-validation-status={row.validationStatus}>{validationBadge(row.validationStatus).label}</small></td><td>{dateTime(row.createdAt)}</td><td><button type="button" disabled={Boolean(busy)} aria-label={`Eingang ${row.preview.invoiceNumber || row.originalFileName} öffnen`} onClick={() => openRecord(row)}>Öffnen</button></td></tr>)}</tbody></table></div><div className="iw-pagination"><span>{Math.min(limit, rows.length)} von {rows.length} angezeigt</span>{limit < rows.length && <button type="button" disabled={Boolean(busy)} onClick={() => setLimit(value => value + 30)}>Weitere anzeigen</button>}</div></>}</section>
    {!pending && selected && <section ref={detail} tabIndex={-1} className="iw-panel ei-detail" aria-label="Rechnungseingang im Detail"><div className="iw-panel-head"><div><p className="iw-eyebrow">Gespeichertes Original</p><h2>{selected.preview.invoiceNumber || 'Rechnungsdetails'}</h2></div><div className="iw-actions"><button type="button" disabled={Boolean(busy)} onClick={() => void download(selected, 'original')}>{busy === 'download-original' ? 'Wird geladen …' : 'Original herunterladen'}</button>{selected.sourceKind === 'hybrid_pdf' && <button type="button" disabled={Boolean(busy)} onClick={() => void download(selected, 'xml')}>{busy === 'download-xml' ? 'Wird geladen …' : 'Eingebettetes XML'}</button>}</div></div><div className="ei-detail-body"><div className="ei-file"><strong>{selected.originalFileName}</strong><small>{selected.sourceKind === 'hybrid_pdf' ? 'PDF mit Rechnungs-XML' : 'XML-Datei'} · Importiert {dateTime(selected.createdAt)}</small></div><FormatCheck message={selected.validationMessage} status={selected.validationStatus} findings={selected.validationFindings} />{canImport && <div className="ei-validation-actions"><button type="button" disabled={Boolean(busy) || reviewDirty} onClick={() => void validate(selected)}>{busy === 'validate' ? 'Format wird geprüft …' : selected.validationStatus === 'pending_validation' ? 'Format prüfen' : 'Format erneut prüfen'}</button>{reviewDirty && <small>Speichern oder verwerfen Sie zuerst die Änderungen an der sachlichen Prüfung.</small>}</div>}<StructuredPreview preview={selected.preview} /><ReviewForm key={`${selected.id}:${selected.updatedAt}:${reviewRevision}`} record={selected} allowed={canReview} busy={Boolean(busy)} onDirty={setReviewDirty} onSave={saveReview} /><details className="ei-provenance"><summary>Original und Nachvollziehbarkeit</summary><dl><div><dt>SHA-256 des Originals</dt><dd>{selected.originalSha256}</dd></div><div><dt>SHA-256 des Rechnungs-XML</dt><dd>{selected.xmlSha256}</dd></div><div><dt>Zuletzt bearbeitet</dt><dd>{dateTime(selected.updatedAt)}</dd></div></dl><p>Beim Herunterladen erhalten Sie die gespeicherten Originaldaten. Die sachliche Prüfung verändert die Datei nicht.</p></details></div></section>}
    {!pending && selectedId && !selected && query.data && !query.loading && <div className="iw-notice" data-tone="warning" role="status">Der gewählte Eingang ist in diesem Unternehmen nicht verfügbar. Wählen Sie einen Eintrag aus der Liste.</div>}
    <p className="iw-footnote">Eine erkannte XML-Struktur ist noch kein Nachweis einer gültigen E-Rechnung. Formatkonformität und sachliche Richtigkeit werden getrennt beurteilt.</p>
  </section>;
}

function FormatCheck({ message: text, status = 'pending_validation', findings = [] }: { message: string; status?: string; findings?: string[] }) {
  const badge = validationBadge(status);
  return <div className="ei-format" data-tone={badge.tone} role="status"><span className="iw-badge" data-tone={badge.tone}>{badge.label}</span><div><h3>Datei- und Formatprüfung</h3><p>{text || 'Für dieses Original liegt noch kein vollständiges Prüfergebnis vor.'}</p>{findings.length > 0 && <ul className="ei-findings">{findings.map((finding, index) => <li key={`${index}:${finding}`}>{finding}</li>)}</ul>}</div></div>;
}

export function StructuredPreview({ preview, warnings = [] }: { preview: OfficeEInvoiceXmlPreview; warnings?: string[] }) {
  const issues = [...new Set([...preview.warnings, ...warnings])];
  return <div className="ei-preview">
    <div className="ei-preview-title"><div><h3>Lesbare Rechnungsdaten</h3><p>Aus dem strukturierten XML übernommen</p></div><span className="iw-badge" data-tone="blue">{preview.invoiceTypeCode === '381' ? 'Gutschrift · ' : ''}{syntaxLabels[preview.syntax]}</span></div>
    <div className="ei-facts"><Fact label="Rechnungsnummer" value={preview.invoiceNumber} /><Fact label="Rechnungsdatum" value={formatInvoiceDate(preview.issueDate)} /><Fact label="Währung" value={preview.currency} /><Fact label="Deklariertes Profil" value={preview.profileLabel || preview.profileId} />{preview.dueDate && <Fact label="Fällig am" value={formatInvoiceDate(preview.dueDate)} />}{preview.buyerReference && <Fact label="Käuferreferenz" value={preview.buyerReference} />}{preview.paymentReference && <Fact label="Zahlungsreferenz" value={preview.paymentReference} />}</div>
    {preview.profileSupport !== 'supported' && <div className="iw-notice" data-tone="warning">{preview.profileSupport === 'excluded' ? 'Das deklarierte Profil erfüllt nicht die hier vorgesehenen Anforderungen an eine vollständige E-Rechnung. Das Original kann dennoch zur weiteren Klärung abgelegt werden.' : 'Das deklarierte Profil konnte nicht eindeutig zugeordnet werden. Aus der Vorschau folgt keine Bestätigung des Rechnungsformats.'}</div>}
    {issues.length > 0 && <div className="iw-notice" data-tone="warning"><strong>Hinweise zur ausgelesenen Datei</strong><ul>{issues.map((issue, index) => <li key={`${index}:${issue}`}>{issue}</li>)}</ul></div>}
    <div className="ei-parties"><Party title="Rechnungssteller" party={preview.seller} /><Party title="Rechnungsempfänger" party={preview.buyer} /></div>
    <div className="iw-table-scroll ei-lines" role="region" aria-label="Rechnungspositionen aus dem XML, horizontal scrollbar" tabIndex={0}><table><thead><tr><th scope="col">Position / Leistung</th><th scope="col" className="iw-number">Menge</th><th scope="col">Einheit</th><th scope="col" className="iw-number">Einzelpreis</th><th scope="col">Steuer</th><th scope="col" className="iw-number">Positionsbetrag</th></tr></thead><tbody>{preview.lines.length ? preview.lines.map((line, index) => <tr key={`${line.id}:${index}`}><td><div className="iw-cellcopy"><strong>{line.name || 'Bezeichnung fehlt'}</strong><small>Position {line.id || index + 1}</small></div></td><td className="iw-number">{line.quantity || '—'}</td><td>{line.unitCode || '—'}</td><td className="iw-number">{documentMoney(line.unitPrice, preview.currency)}<small className="iw-subtle">für {line.priceBaseQuantity || '1'} {line.priceBaseUnitCode || line.unitCode}</small></td><td>{line.taxRate ? `${line.taxRate} %` : '—'}{line.taxCategory && <small className="iw-subtle">Kategorie {line.taxCategory}</small>}</td><td className="iw-number">{documentMoney(line.lineTotal, preview.currency)}</td></tr>) : <tr><td colSpan={6}>In der Datei wurden keine Rechnungspositionen ausgelesen.</td></tr>}</tbody></table></div>
    <dl className="ei-totals"><div><dt>Nettobetrag</dt><dd>{documentMoney(preview.totals.taxExclusive, preview.currency)}</dd></div><div><dt>Steuerbetrag</dt><dd>{documentMoney(preview.totals.tax, preview.currency)}</dd></div><div><dt>Bruttobetrag</dt><dd>{documentMoney(preview.totals.taxInclusive, preview.currency)}</dd></div><div className="ei-payable"><dt>Zahlbetrag laut XML</dt><dd>{documentMoney(preview.totals.payable, preview.currency)}</dd></div></dl>
    <p className="iw-footnote">Beträge werden aus der Datei angezeigt. Abschläge, Vorauszahlungen oder Rundungen können den Zahlbetrag beeinflussen; diese Vorschau ersetzt keine vollständige Rechnungsprüfung.</p>
  </div>;
}

function Fact({ label, value }: { label: string; value: string }) { return <dl><dt>{label}</dt><dd>{value || 'Nicht angegeben'}</dd></dl>; }
function Party({ title, party }: { title: string; party: OfficeEInvoiceXmlPreview['seller'] }) {
  return <section className="iw-card ei-party"><h3>{title}</h3><strong>{party.name || 'Name nicht angegeben'}</strong><p>{[...party.addressLines, [party.postalCode, party.city].filter(Boolean).join(' '), party.country].filter(Boolean).join('\n') || 'Anschrift nicht angegeben'}</p><dl>{party.taxId && <div><dt>Steuernummer</dt><dd>{party.taxId}</dd></div>}{party.vatId && <div><dt>USt-ID</dt><dd>{party.vatId}</dd></div>}{party.endpointId && <div><dt>Elektronische Adresse{party.endpointScheme ? ` (${party.endpointScheme})` : ''}</dt><dd>{party.endpointId}</dd></div>}</dl></section>;
}

function ReviewForm({ record, allowed, busy, onDirty, onSave }: { record: OfficeEInvoiceInboxRecord; allowed: boolean; busy: boolean; onDirty: (dirty: boolean) => void; onSave: (record: OfficeEInvoiceInboxRecord, status: ReviewStatus, note: string) => Promise<boolean> }) {
  const [status, setStatus] = useState<ReviewStatus>(record.reviewStatus); const [note, setNote] = useState(record.reviewNote); const [attempted, setAttempted] = useState(false);
  const dirty = status !== record.reviewStatus || note !== record.reviewNote;
  const noteRequired = status === 'rejected' && note.trim().length < 5;
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  return <section className="ei-review"><div className="ei-preview-title"><div><h3>Sachliche Prüfung</h3><p>Leistung, Empfänger und Beträge unabhängig vom Dateiformat beurteilen.</p></div><span className="iw-badge" data-tone={reviewTone[record.reviewStatus]}>{reviewLabels[record.reviewStatus]}</span></div>{allowed ? <form onSubmit={event => { event.preventDefault(); setAttempted(true); if (!busy && dirty && !noteRequired) void onSave(record, status, note); }}><div className="ei-review-fields"><label>Prüfstand<select value={status} disabled={busy} onChange={event => setStatus(event.target.value as ReviewStatus)}>{Object.entries(reviewLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Prüfvermerk{status === 'rejected' ? ' (erforderlich)' : ' (optional)'}<textarea value={note} maxLength={2000} rows={3} disabled={busy} onChange={event => setNote(event.target.value)} placeholder="Zum Beispiel: Leistung abgeglichen, Abweichung oder Rückfrage an den Rechnungssteller" aria-invalid={attempted && noteRequired} /></label></div>{attempted && noteRequired && <p className="ei-field-error" role="alert">Bitte begründen Sie die Beanstandung mit mindestens 5 Zeichen.</p>}<div className="iw-actions"><button type="submit" className="iw-primary" disabled={busy || !dirty}>{busy ? 'Bitte warten …' : 'Prüfstand speichern'}</button>{dirty && <button type="button" disabled={busy} onClick={() => { setStatus(record.reviewStatus); setNote(record.reviewNote); setAttempted(false); }}>Änderungen verwerfen</button>}</div></form> : <><p>Zum Ändern des Prüfstands fehlt die Berechtigung.</p>{record.reviewNote && <p className="ei-review-note">{record.reviewNote}</p>}</>}<p className="iw-footnote">„Sachlich geprüft“ bestätigt keine technische Normprüfung und löst keine Zahlung aus.</p></section>;
}
