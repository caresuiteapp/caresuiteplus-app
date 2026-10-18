import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useNavigation, useRouter, useIsFocused } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { ScreenShell } from '@/components/layout/ScreenShell.web';
import { InvoicePdfPreview } from '@/components/office/invoices/InvoicePdfPreview.web';
import { EInvoiceReadOnlySummary, eInvoiceTaxLabels } from '@/components/office/invoices/EInvoiceSettingsPanel.web';
import { EInvoiceOriginalDownload, EInvoiceXmlPreview } from '@/components/office/invoices/EInvoiceXmlPreview.web';
import { invoiceEditorCss } from '@/components/office/invoices/invoiceEditorStyles.web';
import { invoiceEditorDate, invoiceEditorMoney, invoiceEditorToday, parseInvoiceEditorDecimal } from '@/components/office/invoices/invoiceEditorModel.web';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';
import { INVOICE_STATUS_LABELS } from '@/lib/office/invoiceStatus';
import { deleteOfficeInvoiceDraft, fetchOfficeInvoice, recordOfficeInvoicePayment, transitionOfficeInvoice } from '@/lib/office/invoiceWorkspaceService.web';
import { issueOfficeInvoicePdf } from '@/lib/office/invoiceIssuePdf.web';
import type { OfficeInvoiceDeliveryEvidence, OfficeInvoiceMutationResult, OfficeInvoicePaymentInput } from '@/lib/office/invoiceWorkspaceService.web';
import type { RoleKey, ServiceResult } from '@/types';

type Props = { invoiceId?: string | null; embedded?: boolean };
const money = (value: number | null) => value == null ? '—' : invoiceEditorMoney(value);
const unitLabels: Record<string, string> = { hour: 'Std.', minute: 'Min.', visit: 'Leistung', day: 'Tag', km: 'km', flat: 'Pauschale' };
const paymentMethods: { value: OfficeInvoicePaymentInput['method']; label: string }[] = [{ value: 'bank_transfer', label: 'Überweisung' }, { value: 'direct_debit', label: 'Lastschrift' }, { value: 'cash', label: 'Barzahlung' }, { value: 'card', label: 'Kartenzahlung' }, { value: 'paypal', label: 'PayPal' }, { value: 'stripe', label: 'Stripe' }, { value: 'other', label: 'Sonstige' }];

export function InvoiceDetailScreen({ invoiceId, embedded = false }: Props = {}) {
  const auth = useAuth(); const { roleKey, can, permissions } = usePermissions();
  const tenantId = useServiceTenantId()?.trim() ?? ''; const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = invoiceId ?? (typeof params.id === 'string' ? params.id : '');
  const allowed = Boolean(auth.authReady && auth.isAuthenticated && auth.user?.id && tenantId && roleKey && !auth.portalSession && !isPortalOnlyRole(roleKey) && can('office.invoices.view'));
  const scopeKey = JSON.stringify([tenantId, auth.user?.id, roleKey, id, [...new Set(permissions)].sort()]);
  const content = <><style>{invoiceEditorCss}</style>{!auth.authReady ? <div className="ie ie-empty" role="status">Zugang wird geprüft …</div> : allowed && roleKey ? <InvoiceDetailWorkspace key={scopeKey} {...{ tenantId, roleKey, scopeKey }} invoiceId={id} canEdit={can('office.invoices.create')} canChangeStatus={can('office.invoices.status_change')} canOpenClient={can('office.clients.view')} /> : <section className="ie ie-panel ie-empty"><h1>Rechnung</h1><p>Für diesen Bereich benötigen Sie einen Verwaltungszugang mit Zugriff auf Rechnungen.</p></section>}</>;
  return embedded ? <div className="ie" style={{ minHeight: 0, overflow: 'auto', padding: 16 }}>{content}</div> : <ScreenShell title="Rechnung" contentOwnsHeader>{content}</ScreenShell>;
}

function InvoiceDetailWorkspace({ tenantId, roleKey, scopeKey, invoiceId, canEdit, canChangeStatus, canOpenClient }: { tenantId: string; roleKey: RoleKey; scopeKey: string; invoiceId: string; canEdit: boolean; canChangeStatus: boolean; canOpenClient: boolean }) {
  const router = useRouter(); const navigation = useNavigation(); const focused = useIsFocused(); const previousFocus = useRef(focused);
  const query = useAsyncQuery(() => fetchOfficeInvoice(tenantId, invoiceId, roleKey), [tenantId, invoiceId, roleKey], { queryKey: scopeKey, retryCount: 0 });
  const [busy, setBusy] = useState(''); const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [form, setForm] = useState<'payment' | 'delivery' | null>(null);
  const [payment, setPayment] = useState({ amount: '', paymentDate: invoiceEditorToday(), method: 'bank_transfer' as OfficeInvoicePaymentInput['method'], reference: '', notes: '' });
  const [delivery, setDelivery] = useState<OfficeInvoiceDeliveryEvidence>({ channel: 'email', date: invoiceEditorToday(), reference: '' });
  const [deliveryConfirmed, setDeliveryConfirmed] = useState(false);
  const lock = useRef(false); const mounted = useRef(true); const request = useRef({ key: '', id: '' }); const leaveAllowed = useRef(false);
  const dirty = Boolean(form && (form === 'payment' ? payment.amount || payment.reference || payment.notes : delivery.reference || deliveryConfirmed));
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  function discardInputs() { setForm(null); setPayment({ amount: '', paymentDate: invoiceEditorToday(), method: 'bank_transfer', reference: '', notes: '' }); setDelivery({ channel: 'email', date: invoiceEditorToday(), reference: '' }); setDeliveryConfirmed(false); dirtyRef.current = false; }
  function mayLeave() { if (lock.current) return false; if (leaveAllowed.current || !dirtyRef.current) return true; if (!window.confirm('Ungespeicherte Angaben verwerfen?')) return false; discardInputs(); leaveAllowed.current = true; return true; }
  useEffect(() => { const returning = focused && !previousFocus.current; previousFocus.current = focused; if (returning) { leaveAllowed.current = false; if (!dirtyRef.current && !lock.current) void query.refresh(); } }, [focused, query.refresh]);
  usePreventRemove(dirty || !!busy, ({ data }) => { if (mayLeave()) navigation.dispatch(data.action); });
  useEffect(() => { if (!dirty && !busy) return; const listener = (event: BeforeUnloadEvent) => { if (!leaveAllowed.current) { event.preventDefault(); event.returnValue = ''; } }; window.addEventListener('beforeunload', listener); return () => window.removeEventListener('beforeunload', listener); }, [dirty, busy]);
  const invoice = query.data; const queryError = query.error || query.refreshError;
  const stale = query.loading || query.refreshing || !!queryError || !invoice;
  const actionDisabled = stale || !!busy;
  function actionId(key: string) { if (request.current.key !== key) request.current = { key, id: crypto.randomUUID() }; return request.current.id; }
  async function operate(key: string, message: string, action: () => Promise<ServiceResult<OfficeInvoiceMutationResult>>, deleted = false) {
    if (lock.current || stale) return;
    lock.current = true; setBusy(key); setNotice(null);
    try {
      const result = await action(); if (!mounted.current) return;
      if (!result.ok) { setNotice({ tone: 'error', text: result.error }); return; }
      setNotice({ tone: 'success', text: message });
      setForm(null); setPayment({ amount: '', paymentDate: invoiceEditorToday(), method: 'bank_transfer', reference: '', notes: '' }); setDelivery({ channel: 'email', date: invoiceEditorToday(), reference: '' }); setDeliveryConfirmed(false); dirtyRef.current = false;
      if (deleted) { leaveAllowed.current = true; lock.current = false; setBusy(''); router.replace('/business/office/invoices' as never); return; }
      await query.refresh();
    } catch (cause) { if (mounted.current) setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'Die Aktion konnte nicht bestätigt werden. Bitte den aktuellen Stand prüfen.' }); }
    finally { lock.current = false; if (mounted.current) setBusy(''); }
  }
  function openForm(next: 'payment' | 'delivery' | null) {
    if (lock.current || (dirtyRef.current && !window.confirm('Die eingegebenen Angaben verwerfen?'))) return;
    setForm(next); setNotice(null); leaveAllowed.current = false;
    setPayment({ amount: '', paymentDate: invoiceEditorToday(), method: 'bank_transfer', reference: '', notes: '' }); setDelivery({ channel: 'email', date: invoiceEditorToday(), reference: '' }); setDeliveryConfirmed(false);
  }
  async function issue() {
    if (lock.current || !invoice || !canChangeStatus || invoice.status !== 'draft' || !invoice.officeManaged || actionDisabled) return;
    if (!window.confirm(`Rechnung für ${invoice.recipient.name} über ${money(invoice.amountCents)} verbindlich freigeben?\n\n${invoice.eInvoice?.format === 'xrechnung' ? 'Nach der vollständigen Normprüfung werden die endgültige Rechnungsnummer, XML und PDF gemeinsam gespeichert.' : 'Die endgültige Rechnungsnummer und das PDF werden gespeichert.'} Danach sind die Rechnungsdaten nicht mehr direkt bearbeitbar. Die Rechnung wird dabei nicht versendet.`)) return;
    const id = actionId(`issue:${invoice.updatedAt}`);
    await operate('issue', invoice.eInvoice?.format === 'xrechnung' ? 'XRechnung ausgestellt. XML und PDF wurden mit derselben Rechnungsnummer gespeichert.' : 'Rechnung freigegeben. Rechnungsnummer und PDF wurden unveränderlich gespeichert.', () => issueOfficeInvoicePdf(tenantId, invoice, roleKey, id));
  }
  async function remove() {
    if (lock.current || !invoice || !canChangeStatus || invoice.status !== 'draft' || !invoice.officeManaged || actionDisabled) return;
    if (!window.confirm('Diesen Rechnungsentwurf wirklich verwerfen? Verknüpfte Leistungsnachweise werden wieder für die Abrechnung freigegeben.')) return;
    await operate('delete', 'Entwurf verworfen.', () => deleteOfficeInvoiceDraft(tenantId, invoice.id, invoice.updatedAt, actionId(`delete:${invoice.updatedAt}`), roleKey), true);
  }
  async function savePayment() {
    if (lock.current || !invoice || !canChangeStatus || actionDisabled || invoice.openCents == null) return;
    const amount = parseInvoiceEditorDecimal(payment.amount);
    if (amount == null || amount <= 0 || Math.round(amount * 100) > invoice.openCents) { setNotice({ tone: 'error', text: 'Der Zahlungsbetrag muss größer als null sein und darf den offenen Rechnungsbetrag nicht überschreiten.' }); return; }
    if (!payment.reference.trim() || !payment.paymentDate || payment.paymentDate > invoiceEditorToday()) { setNotice({ tone: 'error', text: 'Bitte ein gültiges Zahlungsdatum und eine Buchungsreferenz angeben.' }); return; }
    if (!window.confirm(`Zahlungseingang über ${invoiceEditorMoney(Math.round(amount * 100))} vom ${invoiceEditorDate(payment.paymentDate)} buchen?`)) return;
    const input = { ...payment, amountCents: Math.round(amount * 100), requestId: actionId(`payment:${invoice.updatedAt}:${JSON.stringify(payment)}`) };
    await operate('payment', 'Zahlungseingang gebucht. Der offene Betrag und der Zahlungsstatus wurden aktualisiert.', () => recordOfficeInvoicePayment(tenantId, invoice.id, invoice.updatedAt, input, roleKey));
  }
  async function saveDelivery() {
    if (lock.current || !invoice || !canChangeStatus || actionDisabled || !deliveryConfirmed) return;
    if (!delivery.reference.trim() || !delivery.date || delivery.date > invoiceEditorToday()) { setNotice({ tone: 'error', text: 'Bitte ein gültiges Versanddatum und einen Versandnachweis oder eine Referenz angeben.' }); return; }
    const reason = `Extern übermittelt am ${delivery.date}; ${delivery.channel}; ${delivery.reference.trim()}`;
    await operate('delivery', 'Die bereits erfolgte Übermittlung wurde dokumentiert. Es wurde keine Nachricht aus CareSuite versendet.', () => transitionOfficeInvoice(tenantId, invoice.id, invoice.updatedAt, 'sent', reason, actionId(`delivery:${invoice.updatedAt}:${JSON.stringify(delivery)}`), roleKey, delivery));
  }
  if (query.loading && !invoice) return <div className="ie" role="status" aria-label="Rechnungsdetails werden geladen"><div className="ie-loading" /><div className="ie-loading" /></div>;
  if (!invoice) return <section className="ie ie-panel ie-empty"><h2>Rechnung nicht verfügbar</h2><p role="alert">{queryError || 'Die Rechnung wurde nicht gefunden.'}</p><button onClick={() => void query.refresh()}>Erneut laden</button></section>;
  const draft = invoice.status === 'draft';
  const xmlSelected = invoice.eInvoice?.format === 'xrechnung';
  const paymentAllowed = canChangeStatus && invoice.officeManaged && ['ready', 'sent', 'partly_paid', 'overdue'].includes(invoice.status) && invoice.openCents != null && invoice.openCents > 0;
  const tone = invoice.status === 'paid' ? 'success' : invoice.status === 'overdue' ? 'error' : invoice.status === 'draft' ? 'warning' : 'blue';
  return <section className="ie ie-fade" data-testid="invoice-detail" data-healthos-invoice-revision="office-invoices-20261018">
    <header className="ie-header"><div className="ie-heading"><span className="ie-mark" aria-hidden="true">▤</span><div><p className="ie-eyebrow">Office · Rechnungen</p><h1>{invoice.invoiceNumber || 'Rechnungsentwurf'}</h1><p>{invoice.clientName} · {invoiceEditorDate(invoice.servicePeriodStart)} bis {invoiceEditorDate(invoice.servicePeriodEnd)}</p></div></div><div className="ie-actions"><span className="ie-badge" data-tone={tone}>{INVOICE_STATUS_LABELS[invoice.status]}</span><button disabled={!!busy} onClick={() => { if (mayLeave()) router.back(); }}>Zurück</button><button disabled={!!busy || query.refreshing} onClick={() => { if (mayLeave()) { discardInputs(); leaveAllowed.current = false; void query.refresh(); } }}>↻ Aktualisieren</button>{canEdit && draft && <button className="ie-primary" disabled={actionDisabled} onClick={() => { if (mayLeave()) router.push(`/business/office/invoices/${invoice.id}/edit` as never); }}>Entwurf bearbeiten</button>}</div></header>
    {notice && <div className="ie-notice" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</div>}
    {queryError && <div className="ie-notice" data-tone="error" role="alert">{queryError}<br />Angezeigt wird der letzte erfolgreiche Stand. Änderungen sind bis zum erneuten Laden gesperrt.</div>}
    {invoice.issues.length > 0 && <div className="ie-notice" data-tone="warning"><strong>Diese Angaben benötigen eine Prüfung:</strong><ul>{invoice.issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
    <div className="ie-kpis"><div className="ie-kpi"><span>Rechnungsbetrag</span><strong>{money(invoice.amountCents)}</strong></div><div className="ie-kpi"><span>Gebuchte Zahlungen</span><strong>{money(invoice.paidCents)}</strong></div><div className="ie-kpi"><span>Offener Betrag</span><strong>{money(invoice.openCents)}</strong></div></div>
    <div className="ie-layout"><div className="ie-main"><section className="ie-panel"><div className="ie-panel-head"><div><h2>Empfänger & Rechnungsdaten</h2><p>{draft ? 'Gespeicherter Entwurf' : 'Gespeicherter Rechnungsstand'}</p></div>{canOpenClient && invoice.clientId && <button className="ie-link" disabled={!!busy} onClick={() => { if (mayLeave()) router.push(clientRecordRoute(invoice.clientId!) as never); }}>Klientenakte öffnen ↗</button>}</div><div className="ie-info"><dl><dt>Rechnungsempfänger</dt><dd>{invoice.recipient.name}{'\n'}{invoice.recipient.street} {invoice.recipient.houseNumber}{'\n'}{invoice.recipient.postalCode} {invoice.recipient.city}{'\n'}{invoice.recipient.country}{invoice.recipient.email ? `\n${invoice.recipient.email}` : ''}</dd></dl><dl><dt>Zugeordnete Klientin / zugeordneter Klient</dt><dd>{invoice.clientName}{invoice.clientNumber ? `\nKundennummer ${invoice.clientNumber}` : ''}</dd></dl><dl><dt>Rechnungsdatum</dt><dd>{invoiceEditorDate(invoice.invoiceDate)}</dd></dl><dl><dt>Fälligkeit</dt><dd>{invoiceEditorDate(invoice.dueDate)}</dd></dl><dl><dt>Leistungszeitraum</dt><dd>{invoiceEditorDate(invoice.servicePeriodStart)} – {invoiceEditorDate(invoice.servicePeriodEnd)}</dd></dl><dl><dt>Leistungsnachweise als Anlage</dt><dd>{invoice.includeProofs ? `${invoice.selectedProofIds.length} ausgewählt` : 'Ohne Anlagen'}</dd></dl></div></section>
    {invoice.eInvoice && <EInvoiceReadOnlySummary value={invoice.eInvoice} draft={draft} context={{ invoiceDate: invoice.invoiceDate, servicePeriodStart: invoice.servicePeriodStart, servicePeriodEnd: invoice.servicePeriodEnd, totalCents: invoice.amountCents, lines: invoice.lines }} />}
    <section className="ie-panel"><div className="ie-panel-head"><h2>Rechnungspositionen</h2><span className="ie-badge">{invoice.lines.length} Positionen</span></div><div className="ie-table-scroll"><table><thead><tr><th>Leistung</th><th className="ie-number">Menge</th><th className="ie-number">Einzelpreis netto</th><th className="ie-number">USt.</th><th className="ie-number">Brutto</th></tr></thead><tbody>{invoice.lines.map(line => <tr key={line.id}><td>{line.description}{line.serviceDate && <small>{invoiceEditorDate(line.serviceDate)}</small>}{line.serviceRecordId && <small>Aus Leistungsnachweis</small>}{line.eInvoiceTax?.category && <small>{eInvoiceTaxLabels[line.eInvoiceTax.category]}{line.eInvoiceTax.exemptionReason ? ` · ${line.eInvoiceTax.exemptionReason}` : ''}</small>}</td><td className="ie-number">{Number.isFinite(line.quantity) ? new Intl.NumberFormat('de-DE', { maximumFractionDigits: 4 }).format(line.quantity) : '—'} {unitLabels[line.unit] || line.unit}</td><td className="ie-number">{Number.isFinite(line.unitPriceCents) ? money(line.unitPriceCents) : '—'}</td><td className="ie-number">{Number.isFinite(line.taxRatePercent) ? `${line.taxRatePercent} %` : '—'}</td><td className="ie-number">{money(line.totalCents)}</td></tr>)}</tbody></table></div><div className="ie-summary"><div className="ie-total"><span>Rechnungsbetrag</span><strong>{money(invoice.amountCents)}</strong></div></div>{!invoice.lines.length && <p className="ie-inline-note">Es sind keine Positionen hinterlegt. Den Entwurf vor der Freigabe bearbeiten.</p>}</section>
    {draft && xmlSelected && <EInvoiceXmlPreview {...{ tenantId, invoice, roleKey }} disabled={actionDisabled} />}
    {!draft && xmlSelected && <EInvoiceOriginalDownload {...{ tenantId, invoice, roleKey }} disabled={actionDisabled} />}
    {(invoice.footerText || invoice.notes) && <section className="ie-panel"><div className="ie-panel-head"><h2>Hinweise</h2></div><div className="ie-info">{invoice.footerText && <dl><dt>Text auf der Rechnung</dt><dd>{invoice.footerText}</dd></dl>}{invoice.notes && <dl><dt>Interne Notiz</dt><dd>{invoice.notes}</dd></dl>}</div></section>}
    <section className="ie-panel"><div className="ie-panel-head"><div><h2>Nächster Schritt</h2><p>{draft ? xmlSelected ? 'Die strukturierten Angaben prüfen und die XRechnung nach der Normprüfung ausstellen.' : 'Den Entwurf prüfen und anschließend verbindlich freigeben.' : invoice.status === 'ready' ? xmlSelected ? 'Die gespeicherte XML-Datei übermitteln und den Versand dokumentieren.' : 'Das gespeicherte PDF übermitteln und den Versand dokumentieren.' : invoice.status === 'paid' ? 'Die Rechnung ist vollständig bezahlt.' : 'Zahlungseingänge und den gespeicherten Rechnungsstand prüfen.'}</p></div></div>
      {!canChangeStatus ? <p className="ie-inline-note">Ihre Rolle kann Rechnungen ansehen. Freigaben und Zahlungen sind nicht freigeschaltet.</p> : <div className="ie-actions">{draft && invoice.officeManaged && <><button className="ie-primary" disabled={actionDisabled || invoice.amountCents == null || !invoice.lines.length} onClick={() => void issue()}>{busy === 'issue' ? xmlSelected ? 'XRechnung wird geprüft und ausgestellt …' : 'Rechnung wird freigegeben …' : xmlSelected ? 'XRechnung ausstellen' : 'Rechnung freigeben'}</button><button className="ie-danger" disabled={actionDisabled} onClick={() => void remove()}>Entwurf verwerfen</button></>}{!draft && invoice.officeManaged && invoice.status === 'ready' && <button disabled={actionDisabled} onClick={() => openForm('delivery')}>Erfolgten Versand dokumentieren</button>}{paymentAllowed && <button className="ie-primary" disabled={actionDisabled} onClick={() => openForm('payment')}>Zahlungseingang erfassen</button>}</div>}
      {draft && xmlSelected && <p className="ie-inline-note">Vor der Ausstellung werden die endgültigen XML-Daten vollständig gegen den gewählten Standard geprüft. Fehler verhindern die Freigabe. Die PDF bleibt eine lesbare Darstellung; maßgeblich ist die gespeicherte XML-Datei.</p>}
      {draft && !invoice.officeManaged && <p className="ie-inline-note">Diesen älteren Entwurf zuerst bearbeiten und speichern. Danach stehen Freigabe und Verwerfen zur Verfügung.</p>}{!draft && <p className="ie-inline-note">Freigegebene Rechnungsdaten sind unveränderlich. Der Zahlungsstatus ergibt sich aus den gebuchten Zahlungseingängen.</p>}{!draft && !invoice.officeManaged && <p className="ie-inline-note">Diese bestehende Rechnung wurde vor dem neuen Rechnungsablauf erstellt. Sie wird schreibgeschützt angezeigt.</p>}
      {form === 'payment' && <div><div className="ie-divider" /><h3>Zahlungseingang buchen</h3><p className="ie-inline-note">Nur tatsächlich eingegangene Zahlungen erfassen.</p><div className="ie-fields"><label className="ie-field">Betrag (€)<input value={payment.amount} inputMode="decimal" disabled={!!busy} onChange={event => setPayment(current => ({ ...current, amount: event.target.value }))} />{invoice.openCents != null && <button className="ie-link" disabled={!!busy} onClick={() => setPayment(current => ({ ...current, amount: (invoice.openCents! / 100).toFixed(2).replace('.', ',') }))}>Offenen Betrag übernehmen</button>}</label><label className="ie-field">Zahlungsdatum<input type="date" max={invoiceEditorToday()} value={payment.paymentDate} disabled={!!busy} onChange={event => setPayment(current => ({ ...current, paymentDate: event.target.value }))} /></label><label className="ie-field">Zahlungsart<select value={payment.method} disabled={!!busy} onChange={event => setPayment(current => ({ ...current, method: event.target.value as OfficeInvoicePaymentInput['method'] }))}>{paymentMethods.map(method => <option key={method.value} value={method.value}>{method.label}</option>)}</select></label><label className="ie-field">Buchungsreferenz<input maxLength={500} value={payment.reference} placeholder="Zum Beispiel Kontoauszug / Buchungsnummer" disabled={!!busy} onChange={event => setPayment(current => ({ ...current, reference: event.target.value }))} /></label><label className="ie-field ie-field-wide">Interner Vermerk, optional<textarea maxLength={10000} value={payment.notes} disabled={!!busy} onChange={event => setPayment(current => ({ ...current, notes: event.target.value }))} /></label></div><div className="ie-footer"><button disabled={!!busy} onClick={() => openForm(null)}>Abbrechen</button><button className="ie-primary" disabled={actionDisabled} onClick={() => void savePayment()}>{busy === 'payment' ? 'Wird gebucht …' : 'Zahlung buchen'}</button></div></div>}
      {form === 'delivery' && <div><div className="ie-divider" /><h3>Bereits erfolgte Übermittlung dokumentieren</h3><p className="ie-inline-note">Hier wird der tatsächliche Versand vermerkt. Die Aktion versendet selbst keine E-Mail.</p><div className="ie-fields"><label className="ie-field">Übermittelt per<select value={delivery.channel} disabled={!!busy} onChange={event => setDelivery(current => ({ ...current, channel: event.target.value as OfficeInvoiceDeliveryEvidence['channel'] }))}><option value="email">E-Mail</option><option value="post">Post</option><option value="personal">Persönlich übergeben</option><option value="other">Sonstiger Weg</option></select></label><label className="ie-field">Versanddatum<input type="date" max={invoiceEditorToday()} value={delivery.date} disabled={!!busy} onChange={event => setDelivery(current => ({ ...current, date: event.target.value }))} /></label><label className="ie-field ie-field-wide">Versandnachweis / Referenz<input maxLength={500} value={delivery.reference} placeholder="Empfänger, Übergabevermerk oder Versandreferenz" disabled={!!busy} onChange={event => setDelivery(current => ({ ...current, reference: event.target.value }))} /></label></div><label className="ie-choice"><input type="checkbox" checked={deliveryConfirmed} disabled={!!busy} onChange={event => setDeliveryConfirmed(event.target.checked)} /><span>Die Rechnung wurde tatsächlich über den angegebenen Weg übermittelt.</span></label><div className="ie-footer"><button disabled={!!busy} onClick={() => openForm(null)}>Abbrechen</button><button className="ie-primary" disabled={actionDisabled || !deliveryConfirmed} onClick={() => void saveDelivery()}>{busy === 'delivery' ? 'Wird gespeichert …' : 'Übermittlung dokumentieren'}</button></div></div>}
    </section>
    </div><aside className="ie-panel ie-preview-sticky"><InvoicePdfPreview {...{ tenantId, roleKey, invoice }} proofIds={invoice.selectedProofIds} allowProofSelection={false} disabled={actionDisabled} /></aside></div>
  </section>;
}
