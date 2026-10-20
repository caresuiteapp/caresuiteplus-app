import { useId } from 'react';
import type { OfficeInvoiceDraftLine, OfficeInvoiceRecipient } from '@/lib/office/invoiceWorkspaceTypes.web';
import type { OfficeEInvoiceAnswer, OfficeEInvoiceLineTax, OfficeEInvoiceMetadata } from '@/lib/office/eInvoiceTypes.web';
import { assessOfficeEInvoiceRequirement, createEmptyOfficeEInvoiceLineTax } from '@/lib/office/eInvoiceModel.web';

type AssessmentContext = {
  invoiceDate: string;
  servicePeriodStart: string | null;
  servicePeriodEnd: string | null;
  totalCents: number | null;
  lines: OfficeInvoiceDraftLine[];
};
type SettingsProps = {
  value: OfficeEInvoiceMetadata;
  onChange: (value: OfficeEInvoiceMetadata) => void;
  recipient: OfficeInvoiceRecipient;
  clientRecipient?: OfficeInvoiceRecipient;
  context: AssessmentContext;
  disabled?: boolean;
};

const answerLabels = { unknown: 'Noch zu prüfen', yes: 'Ja', no: 'Nein' };
const kindLabels = { unknown: 'Noch zu prüfen', b2b: 'Unternehmen · B2B', b2c: 'Privatperson · B2C', b2g: 'Öffentlicher Auftraggeber · B2G' };
export const eInvoiceTaxLabels = { S: 'Steuerpflichtig', Z: 'Nullsteuersatz', E: 'Steuerbefreit', AE: 'Steuerschuldnerschaft des Empfängers', O: 'Nicht umsatzsteuerbar' };
const legalBasisLabels = { unknown: 'Noch zu prüfen', none: 'Keine Steuerbefreiung', ustg_4_8_29: '§ 4 Nr. 8–29 UStG', ustg_19: 'Kleinunternehmer · § 19 UStG', other: 'Andere Rechtsgrundlage' };
const settingsCss = `
.ie-einvoice{border-color:#cbdaf1;background:linear-gradient(145deg,#fff 45%,#f1f6ff)}.ie-einvoice .ie-format-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:16px}.ie-einvoice .ie-format-grid .ie-choice{margin:0;height:100%}.ie-einvoice .ie-format-grid strong{display:block;color:var(--ie-ink)}.ie-einvoice-details{border-top:1px solid var(--ie-border);padding-top:15px;margin-top:17px}.ie-einvoice-details>summary{font-size:14px;font-weight:650;color:#294568;cursor:pointer;list-style-position:inside;padding:4px 0;overflow-wrap:anywhere}.ie-einvoice-details>summary:focus-visible{outline:3px solid #8ab5ff;outline-offset:3px;border-radius:6px}.ie-einvoice-details[open]>summary{margin-bottom:13px}.ie-einvoice-details>p{font-size:12px;color:var(--ie-muted);margin-bottom:14px}.ie-einvoice .ie-notice:last-child{margin-bottom:0}.ie-einvoice .ie-info{margin-top:14px}.ie-einvoice-tax{margin-top:13px;border-top:1px solid #dce5f0;padding-top:12px}.ie-einvoice-tax>summary{font-size:12px;font-weight:650;color:#33557e;cursor:pointer;list-style-position:inside}.ie-einvoice-tax[open]>summary{margin-bottom:12px}.ie-einvoice-tax .ie-inline-note{margin-bottom:10px}.ie-einvoice-status{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.ie-einvoice-status strong{font-size:13px}.ie-einvoice .ie-helper{font-size:12px;color:var(--ie-muted);margin:0 0 14px}.ie-einvoice .ie-proof-warning{margin-top:10px}.ie-einvoice-original{word-break:break-word}.ie-einvoice-readiness{margin-bottom:15px}@container(max-width:640px){.ie-einvoice .ie-format-grid{grid-template-columns:minmax(0,1fr)}}@media(max-width:640px){.ie-einvoice .ie-format-grid{grid-template-columns:minmax(0,1fr)}}
`;

function AnswerField({ label, value, onChange, disabled }: { label: string; value: OfficeEInvoiceAnswer; onChange: (value: OfficeEInvoiceAnswer) => void; disabled: boolean }) {
  return <label className="ie-field">{label}<select value={value} disabled={disabled} onChange={event => onChange(event.target.value as OfficeEInvoiceAnswer)}>{Object.entries(answerLabels).map(([key, text]) => <option value={key} key={key}>{text}</option>)}</select></label>;
}

export function EInvoiceRequirementSummary({ metadata, context }: { metadata: OfficeEInvoiceMetadata; context: AssessmentContext }) {
  const assessment = assessOfficeEInvoiceRequirement(metadata, context);
  const tone = assessment.status === 'review' || assessment.consentMissing ? 'warning' : assessment.status === 'required' ? 'blue' : undefined;
  return <div className="ie-notice ie-einvoice-readiness" data-tone={tone} data-testid="einvoice-requirement-summary">
    <strong>{assessment.label}</strong>
    {assessment.reasons.length > 0 && <ul>{assessment.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
    <p className="ie-inline-note">Diese Einordnung beruht auf den bestätigten Angaben. Sie ist keine Formatprüfung der Datei.</p>
  </div>;
}

export function EInvoiceSettingsPanel({ value, onChange, recipient, clientRecipient, context, disabled = false }: SettingsProps) {
  const id = useId();
  const xrechnung = value.format === 'xrechnung';
  function patch<K extends keyof OfficeEInvoiceMetadata>(key: K, next: OfficeEInvoiceMetadata[K]) { if (!disabled) onChange({ ...value, [key]: next }); }
  function legal<K extends keyof OfficeEInvoiceMetadata['legal']>(key: K, next: OfficeEInvoiceMetadata['legal'][K]) { patch('legal', { ...value.legal, [key]: next }); }
  function buyer<K extends keyof OfficeInvoiceRecipient>(key: K, next: OfficeInvoiceRecipient[K]) { if (!disabled) onChange({ ...value, buyer: { ...value.buyer, [key]: next }, buyerConfirmed: false }); }
  function copyBuyer(source: OfficeInvoiceRecipient) {
    if (disabled || !window.confirm('Diese Anschrift als Leistungsempfänger übernehmen? Bitte danach prüfen, ob die Leistung tatsächlich für diese Person oder dieses Unternehmen erbracht wurde.')) return;
    onChange({ ...value, buyer: { ...source }, buyerCountryCode: '', buyerConfirmed: false });
  }
  return <section className="ie-panel ie-einvoice" data-testid="einvoice-settings">
    <style>{settingsCss}</style>
    <div className="ie-panel-head"><div><p className="ie-step">FORMAT & EINORDNUNG</p><h2>Elektronische Rechnung</h2><p>Ausgabeformat und tatsächlichen Leistungsempfänger festlegen.</p></div><span className="ie-badge" data-tone="blue">Rechnungsentwurf</span></div>
    <div className="ie-format-grid" role="group" aria-label="Rechnungsformat">
      <label className="ie-choice"><input type="radio" name={`${id}-format`} checked={!xrechnung} disabled={disabled} onChange={() => patch('format', 'pdf')} /><span><strong>PDF-Rechnung</strong><small>Lesbare Rechnung ohne strukturierten E-Rechnungsdatensatz.</small></span></label>
      <label className="ie-choice"><input type="radio" name={`${id}-format`} checked={xrechnung} disabled={disabled} onChange={() => patch('format', 'xrechnung')} /><span><strong>XRechnung</strong><small>Strukturierte XML-Datei. Eine Freigabe setzt die vollständige Normprüfung voraus.</small></span></label>
    </div>
    <EInvoiceRequirementSummary metadata={value} context={context} />
    <div className="ie-fields">
      <label className="ie-field">Art des Leistungsempfängers<select value={value.legal.recipientKind} disabled={disabled} onChange={event => legal('recipientKind', event.target.value as OfficeEInvoiceMetadata['legal']['recipientKind'])}>{Object.entries(kindLabels).map(([key, text]) => <option value={key} key={key}>{text}</option>)}</select></label>
      <label className="ie-field">Geplante Übermittlung<input type="date" value={value.legal.transmissionDate} disabled={disabled} onChange={event => legal('transmissionDate', event.target.value)} /><small>Für Übergangsfristen zählt auch der Übermittlungszeitpunkt.</small></label>
      <AnswerField label="Leistung für das Unternehmen des Empfängers?" value={value.legal.buyerBusinessUse} disabled={disabled} onChange={next => legal('buyerBusinessUse', next)} />
      <AnswerField label="Empfänger im Inland ansässig?" value={value.legal.buyerDomestic} disabled={disabled} onChange={next => legal('buyerDomestic', next)} />
    </div>

    <details className="ie-einvoice-details">
      <summary>Leistungsempfänger und elektronische Zustellung{value.buyer.name ? ` · ${value.buyer.name}` : ''}</summary>
      <p>Die Zahlstelle oder Pflegekasse kann von demjenigen abweichen, der die Leistung erhält. Keine Adresse wird automatisch als Leistungsempfänger übernommen.</p>
      <div className="ie-actions" style={{ marginBottom: 13 }}>
        <button type="button" disabled={disabled || !recipient.name.trim()} onClick={() => copyBuyer(recipient)}>Rechnungsanschrift übernehmen</button>
        {clientRecipient && <button type="button" disabled={disabled || !clientRecipient.name.trim()} onClick={() => copyBuyer(clientRecipient)}>Klientenanschrift als Leistungsempfänger</button>}
      </div>
      <div className="ie-fields">
        <label className="ie-field ie-field-wide">Name des Leistungsempfängers<input maxLength={250} value={value.buyer.name} disabled={disabled} onChange={event => buyer('name', event.target.value)} /></label>
        <label className="ie-field">Straße des Leistungsempfängers<input maxLength={250} value={value.buyer.street} disabled={disabled} onChange={event => buyer('street', event.target.value)} /></label>
        <label className="ie-field">Hausnummer des Leistungsempfängers<input maxLength={40} value={value.buyer.houseNumber} disabled={disabled} onChange={event => buyer('houseNumber', event.target.value)} /></label>
        <label className="ie-field">Postleitzahl des Leistungsempfängers<input maxLength={20} value={value.buyer.postalCode} disabled={disabled} onChange={event => buyer('postalCode', event.target.value)} /></label>
        <label className="ie-field">Ort des Leistungsempfängers<input maxLength={150} value={value.buyer.city} disabled={disabled} onChange={event => buyer('city', event.target.value)} /></label>
        <label className="ie-field">Land des Leistungsempfängers<input maxLength={100} value={value.buyer.country} disabled={disabled} onChange={event => buyer('country', event.target.value)} /></label>
        <label className="ie-field">Ländercode des Leistungsempfängers<input maxLength={2} list={`${id}-countries`} value={value.buyerCountryCode} disabled={disabled} placeholder="Zum Beispiel DE" onChange={event => { if (!disabled) onChange({ ...value, buyerCountryCode: event.target.value.toUpperCase(), buyerConfirmed: false }); }} /><small>Zweistelliger ISO-Ländercode.</small></label>
        <label className="ie-field">E-Mail des Leistungsempfängers<input type="email" maxLength={254} value={value.buyer.email} disabled={disabled} onChange={event => buyer('email', event.target.value)} /></label>
        <label className="ie-field">USt-ID des Leistungsempfängers, falls erforderlich<input maxLength={50} value={value.buyerVatId} disabled={disabled} onChange={event => patch('buyerVatId', event.target.value)} /></label>
        <label className="ie-field">Registerkennung des Leistungsempfängers, optional<input maxLength={100} value={value.buyerLegalRegistrationId} disabled={disabled} onChange={event => patch('buyerLegalRegistrationId', event.target.value)} /></label>
        <label className="ie-field">Käuferreferenz / Leitweg-ID<input maxLength={200} value={value.buyerReference} disabled={disabled} onChange={event => patch('buyerReference', event.target.value)} /><small>Die vom Empfänger vorgegebene Referenz verwenden.</small></label>
        <label className="ie-field">Kennzeichnung der Empfängeradresse<input maxLength={10} list={`${id}-schemes`} value={value.buyerEndpoint.schemeId} disabled={disabled} placeholder="Zum Beispiel EM für E-Mail" onChange={event => patch('buyerEndpoint', { ...value.buyerEndpoint, schemeId: event.target.value.trim().toUpperCase() })} /></label>
        <label className="ie-field">Elektronische Adresse des Empfängers<input maxLength={254} value={value.buyerEndpoint.value} disabled={disabled} onChange={event => patch('buyerEndpoint', { ...value.buyerEndpoint, value: event.target.value })} /><small>Adresse und Kennzeichnung müssen zusammenpassen. Hierdurch wird keine Rechnung versendet.</small></label>
      </div>
      <label className="ie-choice"><input type="checkbox" checked={value.buyerConfirmed} disabled={disabled || !value.buyer.name.trim()} onChange={event => patch('buyerConfirmed', event.target.checked)} /><span>Ich habe den tatsächlichen Leistungsempfänger und seine Anschrift geprüft.<small>Eine Änderung seiner Anschrift hebt diese Bestätigung wieder auf.</small></span></label>
    </details>

    <details className="ie-einvoice-details">
      <summary>Eigene Unternehmensangaben für die E-Rechnung</summary>
      <p>Name, Anschrift, Steuernummer und Bankverbindung kommen bei der Ausstellung aus den Unternehmensdaten. Hier die elektronische Adresse und den Ansprechpartner ergänzen.</p>
      <div className="ie-fields">
        <label className="ie-field">Ländercode des eigenen Unternehmens<input maxLength={2} list={`${id}-countries`} value={value.sellerCountryCode} disabled={disabled} placeholder="Zum Beispiel DE" onChange={event => patch('sellerCountryCode', event.target.value.toUpperCase())} /></label>
        <AnswerField label="Eigenes Unternehmen im Inland ansässig?" value={value.legal.sellerDomestic} disabled={disabled} onChange={next => legal('sellerDomestic', next)} />
        <label className="ie-field">Kennzeichnung der eigenen elektronischen Adresse<input maxLength={10} list={`${id}-schemes`} value={value.sellerEndpoint.schemeId} disabled={disabled} placeholder="Zum Beispiel EM für E-Mail" onChange={event => patch('sellerEndpoint', { ...value.sellerEndpoint, schemeId: event.target.value.trim().toUpperCase() })} /></label>
        <label className="ie-field">Eigene elektronische Adresse<input maxLength={254} value={value.sellerEndpoint.value} disabled={disabled} onChange={event => patch('sellerEndpoint', { ...value.sellerEndpoint, value: event.target.value })} /></label>
        <label className="ie-field ie-field-wide">Lieferantenkennung beim Empfänger, falls erforderlich<input maxLength={100} value={value.sellerIdentifier} disabled={disabled} onChange={event => patch('sellerIdentifier', event.target.value)} /><small>Nur eine vereinbarte Kennung eintragen. Erforderlich, wenn weder USt-ID noch geeignete Registerkennung des Unternehmens vorliegt.</small></label>
        <label className="ie-field ie-field-wide">Ansprechpartner für Rechnungsfragen<input maxLength={200} value={value.sellerContact.name} disabled={disabled} onChange={event => patch('sellerContact', { ...value.sellerContact, name: event.target.value })} /></label>
        <label className="ie-field">Telefon für Rechnungsfragen<input type="tel" maxLength={100} value={value.sellerContact.phone} disabled={disabled} onChange={event => patch('sellerContact', { ...value.sellerContact, phone: event.target.value })} /></label>
        <label className="ie-field">E-Mail für Rechnungsfragen<input type="email" maxLength={254} value={value.sellerContact.email} disabled={disabled} onChange={event => patch('sellerContact', { ...value.sellerContact, email: event.target.value })} /></label>
      </div>
    </details>

    <details className="ie-einvoice-details">
      <summary>Ausnahmen, Übergangsfrist und PDF-Zustimmung</summary>
      <p>Nur zutreffende und geprüfte Angaben auswählen. Steuerbefreiungen werden bei den einzelnen Positionen erfasst.</p>
      <div className="ie-fields">
        <AnswerField label="Eigenes Unternehmen ist Kleinunternehmer (§ 19 UStG)?" value={value.legal.sellerSmallBusiness} disabled={disabled} onChange={next => legal('sellerSmallBusiness', next)} />
        <AnswerField label="Kleinbetragsregelung ist auf diese Rechnung anwendbar?" value={value.legal.smallAmountRuleEligible} disabled={disabled} onChange={next => legal('smallAmountRuleEligible', next)} />
        <AnswerField label="Fahrausweis im Sinne der Rechnungsvorschriften?" value={value.legal.passengerTicket} disabled={disabled} onChange={next => legal('passengerTicket', next)} />
        <AnswerField label="Empfänger stimmt einer PDF-Übermittlung zu?" value={value.legal.pdfConsent} disabled={disabled} onChange={next => legal('pdfConsent', next)} />
        <label className="ie-field">Maßgebliches Vorjahr<input inputMode="numeric" type="number" min="2025" max="2099" step="1" value={value.legal.priorYearRevenueYear ?? ''} disabled={disabled} onChange={event => legal('priorYearRevenueYear', event.target.value === '' ? null : Number(event.target.value))} /><small>Für die Umsatzgrenze das Vorjahr des Umsatzes angeben.</small></label>
        <label className="ie-field">Vorjahresgesamtumsatz (€)<input inputMode="decimal" type="number" min="0" step="0.01" value={value.legal.priorYearRevenueCents == null ? '' : value.legal.priorYearRevenueCents / 100} disabled={disabled} onChange={event => legal('priorYearRevenueCents', event.target.value === '' ? null : Math.round(Number(event.target.value) * 100))} /><small>Gesamtumsatz nach der anwendbaren Übergangsregel.</small></label>
      </div>
    </details>
    <datalist id={`${id}-countries`}><option value="DE">Deutschland</option><option value="AT">Österreich</option><option value="CH">Schweiz</option></datalist>
    <datalist id={`${id}-schemes`}><option value="EM">E-Mail</option><option value="0204">Leitweg-ID</option><option value="9930">Deutsche USt-ID</option><option value="0088">GLN</option></datalist>
    {xrechnung && <p className="ie-inline-note ie-proof-warning">Die Auswahl speichert die Vorbereitung als XRechnung. Eine gewöhnliche PDF wird dadurch nicht zur E-Rechnung. Freigegeben werden kann XML erst nach einer erfolgreichen vollständigen Normprüfung.</p>}
  </section>;
}

export function EInvoiceLineTaxFields({ value, onChange, position, disabled = false }: { value?: OfficeEInvoiceLineTax; onChange: (value: OfficeEInvoiceLineTax) => void; position: number; disabled?: boolean }) {
  const id = useId();
  const tax = value ?? createEmptyOfficeEInvoiceLineTax();
  function patch<K extends keyof OfficeEInvoiceLineTax>(key: K, next: OfficeEInvoiceLineTax[K]) { if (!disabled) onChange({ ...tax, [key]: next }); }
  return <details className="ie-einvoice-tax" data-testid={`einvoice-tax-${position}`}>
    <summary>Steuerliche Einordnung{tax.category ? ` · ${eInvoiceTaxLabels[tax.category]}` : ' · noch zu prüfen'}</summary>
    <p className="ie-inline-note">Ein Steuersatz von 0 % belegt keine Steuerbefreiung. Die Einordnung gilt nur für diese Position.</p>
    <div className="ie-fields">
      <label className="ie-field">Steuerkategorie, Position {position}<select value={tax.category} disabled={disabled} onChange={event => patch('category', event.target.value as OfficeEInvoiceLineTax['category'])}><option value="">Noch zu prüfen</option>{Object.entries(eInvoiceTaxLabels).map(([key, text]) => <option value={key} key={key}>{text} ({key})</option>)}</select></label>
      <label className="ie-field">Einheit im XML, Position {position}<input maxLength={3} value={tax.unitCode} list={`${id}-units`} disabled={disabled} placeholder="Zum Beispiel HUR für Stunden" onChange={event => patch('unitCode', event.target.value.toUpperCase())} /></label>
      <label className="ie-field ie-field-wide">Rechtsgrundlage, Position {position}<select value={tax.legalBasis} disabled={disabled} onChange={event => patch('legalBasis', event.target.value as OfficeEInvoiceLineTax['legalBasis'])}>{Object.entries(legalBasisLabels).map(([key, text]) => <option value={key} key={key}>{text}</option>)}</select></label>
      <label className="ie-field ie-field-wide">Begründung der Steuerbefreiung, Position {position}<input maxLength={1000} value={tax.exemptionReason} disabled={disabled} onChange={event => patch('exemptionReason', event.target.value)} /><small>Die zutreffende Grundlage mit genauer Vorschrift angeben, soweit für die Steuerkategorie erforderlich.</small></label>
      <label className="ie-field ie-field-wide">Befreiungscode, Position {position}, optional<input maxLength={100} value={tax.exemptionReasonCode} disabled={disabled} onChange={event => patch('exemptionReasonCode', event.target.value)} /><small>Nur einen zur Begründung passenden VATEX-Code eintragen.</small></label>
    </div>
    <datalist id={`${id}-units`}><option value="HUR">Stunde</option><option value="MIN">Minute</option><option value="DAY">Tag</option><option value="KMT">Kilometer</option><option value="C62">Stück / Leistung</option></datalist>
  </details>;
}

export function EInvoiceReadOnlySummary({ value, context, draft }: { value: OfficeEInvoiceMetadata; context: AssessmentContext; draft: boolean }) {
  return <section className="ie-panel ie-einvoice" data-testid="einvoice-detail-summary"><style>{settingsCss}</style><div className="ie-panel-head"><div><h2>Rechnungsformat & Leistungsempfänger</h2><p>{draft ? 'Gespeicherte Angaben für die Ausstellung' : 'Mit der Rechnung gespeicherte Angaben'}</p></div><span className="ie-badge" data-tone={value.format === 'xrechnung' ? 'blue' : undefined}>{value.format === 'xrechnung' ? draft ? 'XRechnung vorgesehen' : 'XRechnung' : 'PDF'}</span></div>
    <EInvoiceRequirementSummary metadata={value} context={context} />
    <div className="ie-info">
      <dl><dt>Tatsächlicher Leistungsempfänger</dt><dd>{value.buyer.name ? `${value.buyer.name}\n${value.buyer.street} ${value.buyer.houseNumber}\n${value.buyer.postalCode} ${value.buyer.city}\n${value.buyer.country}` : 'Noch nicht angegeben'}<br /><small>{value.buyerConfirmed ? 'Vom Bearbeiter bestätigt' : 'Noch nicht bestätigt'}</small></dd></dl>
      <dl><dt>Einordnung</dt><dd>{kindLabels[value.legal.recipientKind]}</dd></dl>
      <dl><dt>Käuferreferenz / Leitweg-ID</dt><dd>{value.buyerReference || 'Nicht angegeben'}</dd></dl>
      <dl><dt>Elektronische Empfängeradresse</dt><dd>{value.buyerEndpoint.value ? `${value.buyerEndpoint.value}\n${value.buyerEndpoint.schemeId || 'Kennzeichnung fehlt'}` : 'Nicht angegeben'}</dd></dl>
      <dl><dt>Geplante Übermittlung</dt><dd>{value.legal.transmissionDate ? value.legal.transmissionDate.split('-').reverse().join('.') : 'Noch nicht angegeben'}</dd></dl>
      <dl><dt>Zustimmung zur PDF-Übermittlung</dt><dd>{answerLabels[value.legal.pdfConsent]}</dd></dl>
    </div>
    {value.format === 'pdf' && <p className="ie-inline-note">Die PDF enthält keinen strukturierten E-Rechnungsdatensatz.</p>}
  </section>;
}
