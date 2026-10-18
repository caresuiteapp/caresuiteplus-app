import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { calculateOfficeInvoiceLines, fetchOfficeInvoiceEditorOptions, saveOfficeInvoiceDraft, validateOfficeInvoiceDraft } from '@/lib/office/invoiceWorkspaceService.web';
import type { InvoiceOfficeDraft, OfficeInvoice, OfficeInvoiceDraftLine, OfficeInvoiceProductKey, OfficeInvoiceRecipient, OfficeInvoiceRecipientType, OfficeInvoiceBillingParty, OfficeInvoiceClient } from '@/lib/office/invoiceWorkspaceService.web';
import type { RoleKey } from '@/types';
import { InvoicePdfPreview } from './InvoicePdfPreview.web';
import { invoiceEditorDueDate, invoiceEditorMoney, invoiceEditorMonthPeriod, invoiceEditorToday, parseInvoiceEditorDecimal, validateInvoiceEditorLineText, type InvoiceEditorLineText } from './invoiceEditorModel.web';

const modules: { value: OfficeInvoiceProductKey; label: string }[] = [{ value: 'assist', label: 'Assist' }, { value: 'pflege', label: 'Pflege' }, { value: 'stationaer', label: 'Stationär' }, { value: 'beratung', label: 'Beratung' }];
const emptyRecipient: OfficeInvoiceRecipient = { name: '', street: '', houseNumber: '', postalCode: '', city: '', country: 'Deutschland', email: '' };
function clientBilling(client: OfficeInvoiceClient): Pick<InvoiceOfficeDraft, 'recipient' | 'recipientType' | 'billingParty'> {
  if (['care_insurance', 'health_insurance', 'social_welfare'].includes(client.billingParty)) return {
    billingParty: client.billingParty as OfficeInvoiceBillingParty,
    recipientType: client.billingParty as OfficeInvoiceRecipientType,
    recipient: { ...emptyRecipient, name: ['care_insurance', 'health_insurance'].includes(client.billingParty) ? client.insuranceName : '' },
  };
  return { recipient: { ...client.recipient }, recipientType: 'client', billingParty: 'self_payer' };
}
type Props = { tenantId: string; roleKey: RoleKey; initialInvoice?: OfficeInvoice; initialModule?: OfficeInvoiceProductKey; initialClientId?: string; scopeKey: string };
function freshLine(productKey: OfficeInvoiceProductKey): OfficeInvoiceDraftLine { return { description: '', quantity: 1, unit: 'hour', unitPriceCents: 0, taxRatePercent: 0, productKey }; }
function lineText(line: OfficeInvoiceDraftLine): InvoiceEditorLineText { return { quantity: Number.isFinite(line.quantity) ? String(line.quantity).replace('.', ',') : '', price: Number.isSafeInteger(line.unitPriceCents) ? (line.unitPriceCents / 100).toFixed(2).replace('.', ',') : '', tax: Number.isFinite(line.taxRatePercent) ? String(line.taxRatePercent).replace('.', ',') : '' }; }

export function makeInvoiceEditorDraft(invoice?: OfficeInvoice, module: OfficeInvoiceProductKey = 'assist'): InvoiceOfficeDraft {
  const today = invoiceEditorToday(); const period = invoiceEditorMonthPeriod(today);
  if (invoice) return { id: invoice.id, expectedUpdatedAt: invoice.updatedAt, requestId: crypto.randomUUID(), clientId: invoice.clientId ?? '', invoiceNumber: invoice.invoiceNumber.startsWith('DRAFT-') ? '' : invoice.invoiceNumber, invoiceDate: invoice.invoiceDate, dueDate: invoice.dueDate ?? '', servicePeriodStart: invoice.servicePeriodStart ?? '', servicePeriodEnd: invoice.servicePeriodEnd ?? '', clientName: invoice.clientName, clientNumber: invoice.clientNumber, insuranceNumber: invoice.insuranceNumber, recipient: { ...invoice.recipient }, recipientType: invoice.recipientType ?? 'other', billingParty: invoice.billingParty ?? 'other', notes: invoice.notes ?? '', footerText: invoice.footerText ?? '', includeProofs: invoice.includeProofs, selectedProofIds: invoice.selectedProofIds, lines: invoice.lines.map(line => ({ ...line })) };
  return { requestId: crypto.randomUUID(), clientId: '', invoiceNumber: '', invoiceDate: today, dueDate: invoiceEditorDueDate(today, 14), servicePeriodStart: period.start, servicePeriodEnd: period.end, recipient: { ...emptyRecipient }, recipientType: 'client', billingParty: 'self_payer', notes: '', footerText: '', includeProofs: false, selectedProofIds: [], lines: [freshLine(module)] };
}

export function InvoiceEditor({ tenantId, roleKey, initialInvoice, initialModule = 'assist', initialClientId, scopeKey }: Props) {
  const router = useRouter(); const navigation = useNavigation();
  const [draft, setDraft] = useState(() => makeInvoiceEditorDraft(initialInvoice, initialModule));
  const [texts, setTexts] = useState(() => draft.lines.map(lineText));
  const [catalogId, setCatalogId] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState(''); const [showIssues, setShowIssues] = useState(false);
  const initial = useRef(JSON.stringify(draft)); const lock = useRef(false); const mounted = useRef(true);
  const leaveAllowed = useRef(false); const requestSnapshot = useRef({ key: '', id: draft.requestId });
  const options = useAsyncQuery(() => fetchOfficeInvoiceEditorOptions(tenantId, roleKey), [tenantId, roleKey], { queryKey: scopeKey, retryCount: 0 });
  const dirty = JSON.stringify(draft) !== initial.current && !savedId; const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
  const validation = useMemo(() => [...texts.flatMap((text, index) => { const issue = validateInvoiceEditorLineText(text); return issue ? [`Position ${index + 1}: ${issue}`] : []; }), ...validateOfficeInvoiceDraft(draft)], [draft, texts]);
  const validLines = texts.every(text => !validateInvoiceEditorLineText(text));
  const totals = useMemo(() => { try { return validLines ? calculateOfficeInvoiceLines(draft.lines) : null; } catch { return null; } }, [draft.lines, validLines]);
  const stale = !!options.error || !!options.refreshError || options.loading || options.refreshing || !options.data;
  const selectedClient = options.data?.clients.find(client => client.id === draft.clientId);
  const linked = draft.lines.some(line => !!line.serviceRecordId);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!initialClientId || initialInvoice || dirtyRef.current || !options.data) return;
    const client = options.data.clients.find(item => item.id === initialClientId);
    if (client) { const next = { ...draft, clientId: client.id, clientName: client.name, clientNumber: client.clientNumber, insuranceNumber: client.insuranceNumber, ...clientBilling(client) }; setDraft(next); initial.current = JSON.stringify(next); }
  // Initial URL selection is applied once, after the authoritative client list is ready.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.data, initialClientId, initialInvoice]);
  function canLeave() {
    if (lock.current) return false;
    if (leaveAllowed.current || !dirtyRef.current) return true;
    if (!window.confirm('Ungespeicherte Änderungen an der Rechnung verwerfen?')) return false;
    leaveAllowed.current = true; dirtyRef.current = false; return true;
  }
  usePreventRemove(dirty || busy, ({ data }) => { if (canLeave()) navigation.dispatch(data.action); });
  useEffect(() => { if (!dirty && !busy) return; const leave = (event: BeforeUnloadEvent) => { if (!leaveAllowed.current) { event.preventDefault(); event.returnValue = ''; } }; window.addEventListener('beforeunload', leave); return () => window.removeEventListener('beforeunload', leave); }, [dirty, busy]);
  function patch<K extends keyof InvoiceOfficeDraft>(key: K, value: InvoiceOfficeDraft[K]) { if (lock.current) return; leaveAllowed.current = false; setDraft(current => ({ ...current, [key]: value })); setError(''); }
  function recipient<K extends keyof OfficeInvoiceRecipient>(key: K, value: OfficeInvoiceRecipient[K]) { patch('recipient', { ...draft.recipient, [key]: value }); }
  function patchLine(index: number, change: Partial<OfficeInvoiceDraftLine>) { patch('lines', draft.lines.map((line, position) => position === index ? { ...line, ...change } : line)); }
  function numericLine(index: number, key: keyof InvoiceEditorLineText, text: string) {
    if (lock.current) return;
    setTexts(current => current.map((line, position) => position === index ? { ...line, [key]: text } : line));
    const value = parseInvoiceEditorDecimal(text, 2);
    patchLine(index, key === 'quantity' ? { quantity: value ?? Number.NaN } : key === 'price' ? { unitPriceCents: value == null ? Number.NaN : Math.round(value * 100) } : { taxRatePercent: value ?? Number.NaN });
  }
  function addLine() { const line = freshLine(initialModule); patch('lines', [...draft.lines, line]); setTexts(current => [...current, lineText(line)]); }
  function removeLine(index: number) {
    if (lock.current) return;
    if (draft.lines[index]?.serviceRecordId && !window.confirm('Diese Position aus dem Entwurf entfernen? Der Leistungsnachweis wird nach dem Speichern wieder für einen späteren Rechnungslauf frei.')) return;
    patch('lines', draft.lines.filter((_, position) => position !== index)); setTexts(current => current.filter((_, position) => position !== index));
  }
  function addCatalog() {
    const item = options.data?.catalog.find(entry => entry.id === catalogId); if (!item || lock.current) return;
    const line: OfficeInvoiceDraftLine = { description: item.name, quantity: 1, unit: item.unit, unitPriceCents: item.unitPriceCents, taxRatePercent: item.taxRatePercent, productKey: item.productKey };
    const replaceEmpty = draft.lines.length === 1 && !draft.lines[0].description.trim() && !draft.lines[0].serviceRecordId && draft.lines[0].unitPriceCents === 0;
    setDraft(current => ({ ...current, lines: replaceEmpty ? [line] : [...current.lines, line], footerText: current.footerText || item.taxNotice }));
    setTexts(current => replaceEmpty ? [lineText(line)] : [...current, lineText(line)]); setCatalogId(''); setError('');
  }
  function changeClient(id: string) {
    if (linked || lock.current || (draft.clientId && draft.clientId !== id && !window.confirm('Klientenzuordnung und Empfängeranschrift wechseln? Bereits eingegebene Positionen bleiben erhalten.'))) return;
    const client = options.data?.clients.find(item => item.id === id);
    setDraft(current => ({ ...current, clientId: id, clientName: client?.name ?? '', clientNumber: client?.clientNumber ?? '', insuranceNumber: client?.insuranceNumber ?? '', ...(client ? clientBilling(client) : { recipient: { ...emptyRecipient }, recipientType: 'client' as const, billingParty: 'self_payer' as const }), selectedProofIds: [] }));
  }
  async function save() {
    if (lock.current || stale || savedId) return;
    setShowIssues(true); setError(''); if (validation.length) return;
    const payloadKey = JSON.stringify({ ...draft, requestId: undefined });
    if (requestSnapshot.current.key !== payloadKey) requestSnapshot.current = { key: payloadKey, id: crypto.randomUUID() };
    lock.current = true; setBusy(true);
    try {
      const result = await saveOfficeInvoiceDraft(tenantId, { ...draft, requestId: requestSnapshot.current.id }, roleKey);
      if (!mounted.current) return;
      if (!result.ok) { setError(result.error); return; }
      leaveAllowed.current = true; dirtyRef.current = false; initial.current = JSON.stringify(draft); setSavedId(result.data.id);
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Der Entwurf konnte nicht gespeichert werden. Bitte den gespeicherten Stand prüfen.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  if (savedId) return <section className="ie ie-panel ie-empty" data-testid="invoice-editor-saved"><span className="ie-badge" data-tone="success">Gespeichert</span><h2>Rechnungsentwurf gespeichert</h2><p>Der Entwurf kann jetzt geprüft, weiterbearbeitet oder freigegeben werden.</p><button className="ie-primary" onClick={() => router.replace(`/business/office/invoices/${savedId}` as never)}>Rechnung öffnen</button></section>;
  return <section className="ie ie-fade" data-testid="invoice-editor">
    <header className="ie-header"><div className="ie-heading"><span className="ie-mark" aria-hidden="true">▤</span><div><p className="ie-eyebrow">Office · Rechnungen</p><h1>{initialInvoice ? 'Entwurf bearbeiten' : 'Einzelrechnung erstellen'}</h1><p>{(initialInvoice?.invoiceNumber.startsWith('DRAFT-') ? '' : initialInvoice?.invoiceNumber) || 'Empfänger und Positionen festlegen. Vor dem Speichern als PDF prüfen.'}</p></div></div><div className="ie-actions"><button disabled={busy} onClick={() => { if (canLeave()) router.back(); }}>Zurück</button><button className="ie-primary" disabled={busy || stale} onClick={() => void save()}>{busy ? 'Wird gespeichert …' : 'Entwurf speichern'}</button></div></header>
    {(options.error || options.refreshError) && <div className="ie-notice" data-tone="error" role="alert">{options.error || options.refreshError}<br />Änderungen bleiben bis zum erfolgreichen Laden gesperrt. <button disabled={busy} onClick={() => void options.refresh()}>Erneut laden</button></div>}
    {error && <div className="ie-notice" data-tone="error" role="alert">{error}</div>}
    {showIssues && validation.length > 0 && <div className="ie-notice" data-tone="error" role="alert"><strong>Bitte vor dem Speichern prüfen:</strong><ul>{[...new Set(validation)].map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
    {initialInvoice && (!initialInvoice.recipientType || !initialInvoice.billingParty) && <div className="ie-notice" data-tone="warning">In diesem älteren Entwurf fehlen Empfängerart und Kostenträger. Bitte die Zuordnung vor dem Speichern prüfen.</div>}{options.loading && <div className="ie-notice" role="status">Klienten und Leistungskatalog werden geladen …</div>}
    <div className="ie-layout"><div className="ie-main"><section className="ie-panel"><div className="ie-panel-head"><div><p className="ie-step">01 · EMPFÄNGER & ZEITRAUM</p><h2>Rechnungsangaben</h2></div><span className="ie-badge">Entwurf</span></div>
      <div className="ie-fields"><label className="ie-field ie-field-wide">Klient:in<select value={draft.clientId} disabled={busy || stale || linked} onChange={event => changeClient(event.target.value)}><option value="">Klient:in auswählen</option>{options.data?.clients.map(client => <option value={client.id} key={client.id}>{client.name}{client.clientNumber ? ` · ${client.clientNumber}` : ''}{client.status !== 'active' && client.status !== 'aktiv' ? ' · nicht aktiv' : ''}</option>)}{draft.clientId && !selectedClient && <option value={draft.clientId}>{initialInvoice?.clientName ?? 'Zugeordnete Klientenakte'}</option>}</select>{linked && <small>Die Zuordnung ist durch die übernommenen Leistungsnachweise festgelegt.</small>}{selectedClient?.insuranceName && <small>{selectedClient.insuranceName}{selectedClient.insuranceNumber ? ` · Versichertennummer ${selectedClient.insuranceNumber}` : ''}</small>}</label>
      <label className="ie-field">Rechnungsdatum<input type="date" value={draft.invoiceDate} disabled={busy} onChange={event => patch('invoiceDate', event.target.value)} /></label><label className="ie-field">Fällig am<input type="date" min={draft.invoiceDate} value={draft.dueDate} disabled={busy} onChange={event => patch('dueDate', event.target.value)} /><div className="ie-actions">{[7, 14, 30].map(days => <button type="button" className="ie-link" key={days} disabled={busy} onClick={() => patch('dueDate', invoiceEditorDueDate(draft.invoiceDate, days))}>{days} Tage</button>)}</div></label>
      <label className="ie-field">Leistungszeitraum von<input type="date" value={draft.servicePeriodStart} max={draft.servicePeriodEnd || undefined} disabled={busy || linked} onChange={event => { patch('servicePeriodStart', event.target.value); }} /></label><label className="ie-field">Leistungszeitraum bis<input type="date" value={draft.servicePeriodEnd} min={draft.servicePeriodStart || undefined} disabled={busy || linked} onChange={event => patch('servicePeriodEnd', event.target.value)} /></label>
      <label className="ie-field ie-field-wide">Rechnungsnummer<input value={draft.invoiceNumber} maxLength={120} disabled placeholder="Wird bei der Freigabe automatisch vergeben" /><small>Die endgültige Rechnungsnummer wird bei der Freigabe automatisch vergeben.</small></label></div>
      <div className="ie-divider" /><div className="ie-panel-head"><div><h3>Rechnungsempfänger</h3><p>Die Anschrift wird mit der Rechnung gespeichert.</p></div>{selectedClient && <button className="ie-link" disabled={busy} onClick={() => { if (window.confirm('Empfängeranschrift aus der Klientenakte übernehmen?')) setDraft(current => ({ ...current, recipient: { ...selectedClient.recipient }, recipientType: 'client', billingParty: 'self_payer' })); }}>Klientenanschrift übernehmen</button>}</div>
      <div className="ie-fields"><label className="ie-field">Abrechnung über<select value={draft.billingParty} disabled={busy} onChange={event => patch('billingParty', event.target.value as OfficeInvoiceBillingParty)}><option value="self_payer">Selbstzahler</option><option value="care_insurance">Pflegekasse</option><option value="health_insurance">Krankenkasse</option><option value="social_welfare">Sozialhilfeträger</option><option value="other">Sonstiger Kostenträger</option></select></label><label className="ie-field">Empfängerart<select value={draft.recipientType} disabled={busy} onChange={event => patch('recipientType', event.target.value as OfficeInvoiceRecipientType)}><option value="client">Klient:in</option><option value="relative">Angehörige / Vertretung</option><option value="care_insurance">Pflegekasse</option><option value="health_insurance">Krankenkasse</option><option value="social_welfare">Sozialhilfeträger</option><option value="company">Unternehmen</option><option value="other">Sonstiger Empfänger</option></select></label><label className="ie-field ie-field-wide">Name / Kostenträger<input maxLength={250} value={draft.recipient.name} disabled={busy} onChange={event => recipient('name', event.target.value)} /></label><label className="ie-field">Straße<input maxLength={250} value={draft.recipient.street} disabled={busy} onChange={event => recipient('street', event.target.value)} /></label><label className="ie-field">Hausnummer<input maxLength={40} value={draft.recipient.houseNumber} disabled={busy} onChange={event => recipient('houseNumber', event.target.value)} /></label><label className="ie-field">Postleitzahl<input maxLength={20} value={draft.recipient.postalCode} disabled={busy} onChange={event => recipient('postalCode', event.target.value)} /></label><label className="ie-field">Ort<input maxLength={150} value={draft.recipient.city} disabled={busy} onChange={event => recipient('city', event.target.value)} /></label><label className="ie-field">Land<input maxLength={100} list="invoice-country-options" value={draft.recipient.country} disabled={busy} onChange={event => recipient('country', event.target.value)} /><datalist id="invoice-country-options"><option>Deutschland</option><option>Österreich</option><option>Schweiz</option></datalist></label><label className="ie-field">E-Mail, optional<input type="email" maxLength={254} value={draft.recipient.email} disabled={busy} onChange={event => recipient('email', event.target.value)} /></label></div>
    </section>
    <section className="ie-panel"><div className="ie-panel-head"><div><p className="ie-step">02 · LEISTUNGEN & BETRÄGE</p><h2>Positionen</h2><p>Einzelpreise netto. Steuern und Summen werden je Position berechnet.</p></div><span className="ie-badge">{draft.lines.length} Positionen</span></div>
      {draft.lines.map((line, index) => <div className="ie-line" key={line.id ?? `line-${index}`}><div className="ie-line-top"><strong>Position {index + 1}</strong><button className="ie-remove ie-danger" disabled={busy} aria-label={`Position ${index + 1} entfernen`} onClick={() => removeLine(index)}>Entfernen</button></div><div className="ie-line-grid"><label className="ie-field ie-line-description">Leistungsbeschreibung<input maxLength={1000} value={line.description} disabled={busy} onChange={event => patchLine(index, { description: event.target.value })} /></label><label className="ie-field ie-product">Bereich<select disabled={busy || !!line.serviceRecordId} value={line.productKey} onChange={event => patchLine(index, { productKey: event.target.value as OfficeInvoiceProductKey })}>{modules.map(module => <option key={module.value} value={module.value}>{module.label}</option>)}</select></label><label className="ie-field">Menge<input inputMode="decimal" value={texts[index]?.quantity ?? ''} disabled={busy || !!line.serviceRecordId} onChange={event => numericLine(index, 'quantity', event.target.value)} /></label><label className="ie-field">Einheit<select value={line.unit} disabled={busy || !!line.serviceRecordId} onChange={event => patchLine(index, { unit: event.target.value })}><option value="hour">Stunden</option><option value="minute">Minuten</option><option value="visit">Leistung</option><option value="day">Tage</option><option value="km">km</option><option value="flat">Pauschale</option>{!['hour', 'minute', 'visit', 'day', 'km', 'flat'].includes(line.unit) && <option value={line.unit}>{line.unit}</option>}</select></label><label className="ie-field">Einzelpreis (€)<input inputMode="decimal" value={texts[index]?.price ?? ''} disabled={busy || !!line.serviceRecordId} onChange={event => numericLine(index, 'price', event.target.value)} /></label><label className="ie-field">USt. (%)<input inputMode="decimal" list="invoice-tax-rates" value={texts[index]?.tax ?? ''} disabled={busy || !!line.serviceRecordId} onChange={event => numericLine(index, 'tax', event.target.value)} /></label></div>{line.serviceRecordId && <p className="ie-source-lock">Aus freigegebenem Leistungsnachweis übernommen. Mengen und Preise bleiben an den Nachweis gebunden.</p>}<div className="ie-line-foot"><span>{line.serviceDate ? `Leistung vom ${line.serviceDate.split('-').reverse().join('.')}` : 'Leistung im angegebenen Zeitraum'}</span><strong>{totals?.lines[index] ? invoiceEditorMoney(totals.lines[index].totalCents) : '—'}</strong></div></div>)}
      <datalist id="invoice-tax-rates"><option>0</option><option>7</option><option>19</option></datalist>
      <div className="ie-catalog"><label className="ie-field">Leistung aus dem Katalog<select value={catalogId} disabled={busy || stale} onChange={event => setCatalogId(event.target.value)}><option value="">Leistung auswählen</option>{options.data?.catalog.map(item => <option value={item.id} key={item.id}>{item.name} · {invoiceEditorMoney(item.unitPriceCents)} netto</option>)}</select></label><button disabled={busy || stale || !catalogId} onClick={addCatalog}>Übernehmen</button></div><button disabled={busy || draft.lines.length >= 200} onClick={addLine}>+ Freie Position</button>
      <p className="ie-inline-note">Vereinbarte Preisnachlässe direkt im Einzelpreis berücksichtigen und in der Leistungsbeschreibung benennen.</p><div className="ie-divider" /><div className="ie-summary"><div><span>Nettobetrag</span><strong>{totals ? invoiceEditorMoney(totals.netCents) : '—'}</strong></div><div><span>Umsatzsteuer</span><strong>{totals ? invoiceEditorMoney(totals.taxCents) : '—'}</strong></div><div className="ie-total"><span>Rechnungsbetrag</span><strong>{totals ? invoiceEditorMoney(totals.totalCents) : '—'}</strong></div></div>
    </section>
    <section className="ie-panel"><div className="ie-panel-head"><div><p className="ie-step">03 · ANLAGEN & HINWEISE</p><h2>Ausgabe vorbereiten</h2></div></div><label className="ie-choice"><input type="radio" name="invoice-proofs" checked={!draft.includeProofs} disabled={busy} onChange={() => { setDraft(current => ({ ...current, includeProofs: false, selectedProofIds: [] })); }} /><span>Ohne Leistungsnachweise<small>Nur die Rechnung als PDF ausgeben.</small></span></label><label className="ie-choice"><input type="radio" name="invoice-proofs" checked={draft.includeProofs} disabled={busy} onChange={() => patch('includeProofs', true)} /><span>Mit Leistungsnachweisen<small>Verfügbare Nachweise rechts in der Vorschau auswählen.</small></span></label><div className="ie-divider" /><div className="ie-fields"><label className="ie-field ie-field-wide">Hinweis auf der Rechnung<textarea maxLength={10000} value={draft.footerText} disabled={busy} placeholder="Zum Beispiel vereinbarte Zahlungsangaben oder zutreffender Steuerhinweis" onChange={event => patch('footerText', event.target.value)} /></label><label className="ie-field ie-field-wide">Interne Notiz<textarea maxLength={10000} value={draft.notes} disabled={busy} onChange={event => patch('notes', event.target.value)} /><small>Die interne Notiz wird nicht als Rechnungstext verwendet.</small></label></div></section>
    </div><aside className="ie-panel ie-preview-sticky"><InvoicePdfPreview tenantId={tenantId} roleKey={roleKey} draft={draft} proofIds={draft.selectedProofIds} onProofIdsChange={ids => patch('selectedProofIds', ids)} disabled={busy || stale} invalid={validation.length > 0} />{validation.length > 0 && <p className="ie-inline-note">Die Vorschau wird verfügbar, sobald Empfänger, Zeitraum und Positionen vollständig sind. <button className="ie-link" onClick={() => setShowIssues(true)}>Fehlende Angaben anzeigen</button></p>}</aside></div>
    <footer className="ie-footer"><p>{dirty ? 'Ungespeicherte Änderungen' : 'Alle Änderungen gespeichert bzw. noch keine Eingaben'}</p><div className="ie-actions"><button disabled={busy} onClick={() => { if (canLeave()) router.back(); }}>Abbrechen</button><button className="ie-primary" disabled={busy || stale} onClick={() => void save()}>{busy ? 'Wird gespeichert …' : 'Entwurf speichern'}</button></div></footer>
  </section>;
}
