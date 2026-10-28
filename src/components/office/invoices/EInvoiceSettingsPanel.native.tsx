// Generated native presentation from src/components/office/invoices/EInvoiceSettingsPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeLabel,NativeSelect,NativeOption,NativeDiv,NativeStrong,NativeUl,NativeLi,NativeP,NativeSection,NativeStyle,NativeH2,NativeSpan,NativeInput,NativeSmall,NativeDetails,NativeSummary,NativeButton,NativeDatalist,NativeDl,NativeDt,NativeDd,NativeBr,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useId } from 'react';
import type { OfficeInvoiceDraftLine, OfficeInvoiceRecipient } from "../../../lib/office/invoiceWorkspaceTypes.native.ts";
import type { OfficeEInvoiceAnswer, OfficeEInvoiceLineTax, OfficeEInvoiceMetadata } from "../../../lib/office/eInvoiceTypes.native.ts";
import { assessOfficeEInvoiceRequirement, createEmptyOfficeEInvoiceLineTax } from "../../../lib/office/eInvoiceModel.native.ts";
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
function AnswerField({ label, value, onChange, disabled }: {
    label: string;
    value: OfficeEInvoiceAnswer;
    onChange: (value: OfficeEInvoiceAnswer) => void;
    disabled: boolean;
}) {
    return <NativeWorkspaceStyleScope css={[settingsCss]}>{<NativeLabel className="ie-field">{label}<NativeSelect value={value} disabled={disabled} onChange={event => onChange(event.target.value as OfficeEInvoiceAnswer)}>{Object.entries(answerLabels).map(([key, text]) => <NativeOption value={key} key={key}>{text}</NativeOption>)}</NativeSelect></NativeLabel>}</NativeWorkspaceStyleScope>;
}
export function EInvoiceRequirementSummary({ metadata, context }: {
    metadata: OfficeEInvoiceMetadata;
    context: AssessmentContext;
}) {
    const assessment = assessOfficeEInvoiceRequirement(metadata, context);
    const tone = assessment.status === 'review' || assessment.consentMissing ? 'warning' : assessment.status === 'required' ? 'blue' : undefined;
    return <NativeWorkspaceStyleScope css={[settingsCss]}>{<NativeDiv className="ie-notice ie-einvoice-readiness" data-tone={tone} data-testid="einvoice-requirement-summary">
    <NativeStrong>{assessment.label}</NativeStrong>
    {assessment.reasons.length > 0 && <NativeUl>{assessment.reasons.map(reason => <NativeLi key={reason}>{reason}</NativeLi>)}</NativeUl>}
    <NativeP className="ie-inline-note">Diese Einordnung beruht auf den bestätigten Angaben. Sie ist keine Formatprüfung der Datei.</NativeP>
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
export function EInvoiceSettingsPanel({ value, onChange, recipient, clientRecipient, context, disabled = false }: SettingsProps) {
    const id = useId();
    const xrechnung = value.format === 'xrechnung';
    function patch<K extends keyof OfficeEInvoiceMetadata>(key: K, next: OfficeEInvoiceMetadata[K]) { if (!disabled)
        onChange({ ...value, [key]: next }); }
    function legal<K extends keyof OfficeEInvoiceMetadata['legal']>(key: K, next: OfficeEInvoiceMetadata['legal'][K]) { patch('legal', { ...value.legal, [key]: next }); }
    function buyer<K extends keyof OfficeInvoiceRecipient>(key: K, next: OfficeInvoiceRecipient[K]) { if (!disabled)
        onChange({ ...value, buyer: { ...value.buyer, [key]: next }, buyerConfirmed: false }); }
    async function copyBuyer(source: OfficeInvoiceRecipient) {
        if (disabled || !await confirmNativeWorkspaceAction('Diese Anschrift als Leistungsempfänger übernehmen? Bitte danach prüfen, ob die Leistung tatsächlich für diese Person oder dieses Unternehmen erbracht wurde.'))
            return;
        onChange({ ...value, buyer: { ...source }, buyerCountryCode: '', buyerConfirmed: false });
    }
    return <NativeWorkspaceStyleScope css={[settingsCss, settingsCss]}>{<NativeSection className="ie-panel ie-einvoice" data-testid="einvoice-settings">
    <NativeStyle>{settingsCss}</NativeStyle>
    <NativeDiv className="ie-panel-head"><NativeDiv><NativeP className="ie-step">FORMAT & EINORDNUNG</NativeP><NativeH2>Elektronische Rechnung</NativeH2><NativeP>Ausgabeformat und tatsächlichen Leistungsempfänger festlegen.</NativeP></NativeDiv><NativeSpan className="ie-badge" data-tone="blue">Rechnungsentwurf</NativeSpan></NativeDiv>
    <NativeDiv className="ie-format-grid" role="group" aria-label="Rechnungsformat">
      <NativeLabel className="ie-choice"><NativeInput type="radio" name={`${id}-format`} checked={!xrechnung} disabled={disabled} onChange={() => patch('format', 'pdf')}/><NativeSpan><NativeStrong>PDF-Rechnung</NativeStrong><NativeSmall>Lesbare Rechnung ohne strukturierten E-Rechnungsdatensatz.</NativeSmall></NativeSpan></NativeLabel>
      <NativeLabel className="ie-choice"><NativeInput type="radio" name={`${id}-format`} checked={xrechnung} disabled={disabled} onChange={() => patch('format', 'xrechnung')}/><NativeSpan><NativeStrong>XRechnung</NativeStrong><NativeSmall>Strukturierte XML-Datei. Eine Freigabe setzt die vollständige Normprüfung voraus.</NativeSmall></NativeSpan></NativeLabel>
    </NativeDiv>
    <EInvoiceRequirementSummary metadata={value} context={context}/>
    <NativeDiv className="ie-fields">
      <NativeLabel className="ie-field">Art des Leistungsempfängers<NativeSelect value={value.legal.recipientKind} disabled={disabled} onChange={event => legal('recipientKind', event.target.value as OfficeEInvoiceMetadata['legal']['recipientKind'])}>{Object.entries(kindLabels).map(([key, text]) => <NativeOption value={key} key={key}>{text}</NativeOption>)}</NativeSelect></NativeLabel>
      <NativeLabel className="ie-field">Geplante Übermittlung<NativeInput type="date" value={value.legal.transmissionDate} disabled={disabled} onChange={event => legal('transmissionDate', event.target.value)}/><NativeSmall>Für Übergangsfristen zählt auch der Übermittlungszeitpunkt.</NativeSmall></NativeLabel>
      <AnswerField label="Leistung für das Unternehmen des Empfängers?" value={value.legal.buyerBusinessUse} disabled={disabled} onChange={next => legal('buyerBusinessUse', next)}/>
      <AnswerField label="Empfänger im Inland ansässig?" value={value.legal.buyerDomestic} disabled={disabled} onChange={next => legal('buyerDomestic', next)}/>
    </NativeDiv>

    <NativeDetails className="ie-einvoice-details">
      <NativeSummary>Leistungsempfänger und elektronische Zustellung{value.buyer.name ? ` · ${value.buyer.name}` : ''}</NativeSummary>
      <NativeP>Die Zahlstelle oder Pflegekasse kann von demjenigen abweichen, der die Leistung erhält. Keine Adresse wird automatisch als Leistungsempfänger übernommen.</NativeP>
      <NativeDiv className="ie-actions" style={{ marginBottom: 13 }}>
        <NativeButton type="button" disabled={disabled || !recipient.name.trim()} onClick={async () => await copyBuyer(recipient)}>Rechnungsanschrift übernehmen</NativeButton>
        {clientRecipient && <NativeButton type="button" disabled={disabled || !clientRecipient.name.trim()} onClick={async () => await copyBuyer(clientRecipient)}>Klientenanschrift als Leistungsempfänger</NativeButton>}
      </NativeDiv>
      <NativeDiv className="ie-fields">
        <NativeLabel className="ie-field ie-field-wide">Name des Leistungsempfängers<NativeInput maxLength={250} value={value.buyer.name} disabled={disabled} onChange={event => buyer('name', event.target.value)}/></NativeLabel>
        <NativeLabel className="ie-field">Straße des Leistungsempfängers<NativeInput maxLength={250} value={value.buyer.street} disabled={disabled} onChange={event => buyer('street', event.target.value)}/></NativeLabel>
        <NativeLabel className="ie-field">Hausnummer des Leistungsempfängers<NativeInput maxLength={40} value={value.buyer.houseNumber} disabled={disabled} onChange={event => buyer('houseNumber', event.target.value)}/></NativeLabel>
        <NativeLabel className="ie-field">Postleitzahl des Leistungsempfängers<NativeInput maxLength={20} value={value.buyer.postalCode} disabled={disabled} onChange={event => buyer('postalCode', event.target.value)}/></NativeLabel>
        <NativeLabel className="ie-field">Ort des Leistungsempfängers<NativeInput maxLength={150} value={value.buyer.city} disabled={disabled} onChange={event => buyer('city', event.target.value)}/></NativeLabel>
        <NativeLabel className="ie-field">Land des Leistungsempfängers<NativeInput maxLength={100} value={value.buyer.country} disabled={disabled} onChange={event => buyer('country', event.target.value)}/></NativeLabel>
        <NativeLabel className="ie-field">Ländercode des Leistungsempfängers<NativeInput maxLength={2} list={`${id}-countries`} value={value.buyerCountryCode} disabled={disabled} placeholder="Zum Beispiel DE" onChange={event => { if (!disabled)
        onChange({ ...value, buyerCountryCode: event.target.value.toUpperCase(), buyerConfirmed: false }); }}/><NativeSmall>Zweistelliger ISO-Ländercode.</NativeSmall></NativeLabel>
        <NativeLabel className="ie-field">E-Mail des Leistungsempfängers<NativeInput type="email" maxLength={254} value={value.buyer.email} disabled={disabled} onChange={event => buyer('email', event.target.value)}/></NativeLabel>
        <NativeLabel className="ie-field">USt-ID des Leistungsempfängers, falls erforderlich<NativeInput maxLength={50} value={value.buyerVatId} disabled={disabled} onChange={event => patch('buyerVatId', event.target.value)}/></NativeLabel>
        <NativeLabel className="ie-field">Registerkennung des Leistungsempfängers, optional<NativeInput maxLength={100} value={value.buyerLegalRegistrationId} disabled={disabled} onChange={event => patch('buyerLegalRegistrationId', event.target.value)}/></NativeLabel>
        <NativeLabel className="ie-field">Käuferreferenz / Leitweg-ID<NativeInput maxLength={200} value={value.buyerReference} disabled={disabled} onChange={event => patch('buyerReference', event.target.value)}/><NativeSmall>Die vom Empfänger vorgegebene Referenz verwenden.</NativeSmall></NativeLabel>
        <NativeLabel className="ie-field">Kennzeichnung der Empfängeradresse<NativeInput maxLength={10} list={`${id}-schemes`} value={value.buyerEndpoint.schemeId} disabled={disabled} placeholder="Zum Beispiel EM für E-Mail" onChange={event => patch('buyerEndpoint', { ...value.buyerEndpoint, schemeId: event.target.value.trim().toUpperCase() })}/></NativeLabel>
        <NativeLabel className="ie-field">Elektronische Adresse des Empfängers<NativeInput maxLength={254} value={value.buyerEndpoint.value} disabled={disabled} onChange={event => patch('buyerEndpoint', { ...value.buyerEndpoint, value: event.target.value })}/><NativeSmall>Adresse und Kennzeichnung müssen zusammenpassen. Hierdurch wird keine Rechnung versendet.</NativeSmall></NativeLabel>
      </NativeDiv>
      <NativeLabel className="ie-choice"><NativeInput type="checkbox" checked={value.buyerConfirmed} disabled={disabled || !value.buyer.name.trim()} onChange={event => patch('buyerConfirmed', event.target.checked)}/><NativeSpan>Ich habe den tatsächlichen Leistungsempfänger und seine Anschrift geprüft.<NativeSmall>Eine Änderung seiner Anschrift hebt diese Bestätigung wieder auf.</NativeSmall></NativeSpan></NativeLabel>
    </NativeDetails>

    <NativeDetails className="ie-einvoice-details">
      <NativeSummary>Eigene Unternehmensangaben für die E-Rechnung</NativeSummary>
      <NativeP>Name, Anschrift, Steuernummer und Bankverbindung kommen bei der Ausstellung aus den Unternehmensdaten. Hier die elektronische Adresse und den Ansprechpartner ergänzen.</NativeP>
      <NativeDiv className="ie-fields">
        <NativeLabel className="ie-field">Ländercode des eigenen Unternehmens<NativeInput maxLength={2} list={`${id}-countries`} value={value.sellerCountryCode} disabled={disabled} placeholder="Zum Beispiel DE" onChange={event => patch('sellerCountryCode', event.target.value.toUpperCase())}/></NativeLabel>
        <AnswerField label="Eigenes Unternehmen im Inland ansässig?" value={value.legal.sellerDomestic} disabled={disabled} onChange={next => legal('sellerDomestic', next)}/>
        <NativeLabel className="ie-field">Kennzeichnung der eigenen elektronischen Adresse<NativeInput maxLength={10} list={`${id}-schemes`} value={value.sellerEndpoint.schemeId} disabled={disabled} placeholder="Zum Beispiel EM für E-Mail" onChange={event => patch('sellerEndpoint', { ...value.sellerEndpoint, schemeId: event.target.value.trim().toUpperCase() })}/></NativeLabel>
        <NativeLabel className="ie-field">Eigene elektronische Adresse<NativeInput maxLength={254} value={value.sellerEndpoint.value} disabled={disabled} onChange={event => patch('sellerEndpoint', { ...value.sellerEndpoint, value: event.target.value })}/></NativeLabel>
        <NativeLabel className="ie-field ie-field-wide">Lieferantenkennung beim Empfänger, falls erforderlich<NativeInput maxLength={100} value={value.sellerIdentifier} disabled={disabled} onChange={event => patch('sellerIdentifier', event.target.value)}/><NativeSmall>Nur eine vereinbarte Kennung eintragen. Erforderlich, wenn weder USt-ID noch geeignete Registerkennung des Unternehmens vorliegt.</NativeSmall></NativeLabel>
        <NativeLabel className="ie-field ie-field-wide">Ansprechpartner für Rechnungsfragen<NativeInput maxLength={200} value={value.sellerContact.name} disabled={disabled} onChange={event => patch('sellerContact', { ...value.sellerContact, name: event.target.value })}/></NativeLabel>
        <NativeLabel className="ie-field">Telefon für Rechnungsfragen<NativeInput type="tel" maxLength={100} value={value.sellerContact.phone} disabled={disabled} onChange={event => patch('sellerContact', { ...value.sellerContact, phone: event.target.value })}/></NativeLabel>
        <NativeLabel className="ie-field">E-Mail für Rechnungsfragen<NativeInput type="email" maxLength={254} value={value.sellerContact.email} disabled={disabled} onChange={event => patch('sellerContact', { ...value.sellerContact, email: event.target.value })}/></NativeLabel>
      </NativeDiv>
    </NativeDetails>

    <NativeDetails className="ie-einvoice-details">
      <NativeSummary>Ausnahmen, Übergangsfrist und PDF-Zustimmung</NativeSummary>
      <NativeP>Nur zutreffende und geprüfte Angaben auswählen. Steuerbefreiungen werden bei den einzelnen Positionen erfasst.</NativeP>
      <NativeDiv className="ie-fields">
        <AnswerField label="Eigenes Unternehmen ist Kleinunternehmer (§ 19 UStG)?" value={value.legal.sellerSmallBusiness} disabled={disabled} onChange={next => legal('sellerSmallBusiness', next)}/>
        <AnswerField label="Kleinbetragsregelung ist auf diese Rechnung anwendbar?" value={value.legal.smallAmountRuleEligible} disabled={disabled} onChange={next => legal('smallAmountRuleEligible', next)}/>
        <AnswerField label="Fahrausweis im Sinne der Rechnungsvorschriften?" value={value.legal.passengerTicket} disabled={disabled} onChange={next => legal('passengerTicket', next)}/>
        <AnswerField label="Empfänger stimmt einer PDF-Übermittlung zu?" value={value.legal.pdfConsent} disabled={disabled} onChange={next => legal('pdfConsent', next)}/>
        <NativeLabel className="ie-field">Maßgebliches Vorjahr<NativeInput inputMode="numeric" type="number" min="2025" max="2099" step="1" value={value.legal.priorYearRevenueYear ?? ''} disabled={disabled} onChange={event => legal('priorYearRevenueYear', event.target.value === '' ? null : Number(event.target.value))}/><NativeSmall>Für die Umsatzgrenze das Vorjahr des Umsatzes angeben.</NativeSmall></NativeLabel>
        <NativeLabel className="ie-field">Vorjahresgesamtumsatz (€)<NativeInput inputMode="decimal" type="number" min="0" step="0.01" value={value.legal.priorYearRevenueCents == null ? '' : value.legal.priorYearRevenueCents / 100} disabled={disabled} onChange={event => legal('priorYearRevenueCents', event.target.value === '' ? null : Math.round(Number(event.target.value) * 100))}/><NativeSmall>Gesamtumsatz nach der anwendbaren Übergangsregel.</NativeSmall></NativeLabel>
      </NativeDiv>
    </NativeDetails>
    <NativeDatalist id={`${id}-countries`}><NativeOption value="DE">Deutschland</NativeOption><NativeOption value="AT">Österreich</NativeOption><NativeOption value="CH">Schweiz</NativeOption></NativeDatalist>
    <NativeDatalist id={`${id}-schemes`}><NativeOption value="EM">E-Mail</NativeOption><NativeOption value="0204">Leitweg-ID</NativeOption><NativeOption value="9930">Deutsche USt-ID</NativeOption><NativeOption value="0088">GLN</NativeOption></NativeDatalist>
    {xrechnung && <NativeP className="ie-inline-note ie-proof-warning">Die Auswahl speichert die Vorbereitung als XRechnung. Eine gewöhnliche PDF wird dadurch nicht zur E-Rechnung. Freigegeben werden kann XML erst nach einer erfolgreichen vollständigen Normprüfung.</NativeP>}
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
export function EInvoiceLineTaxFields({ value, onChange, position, disabled = false }: {
    value?: OfficeEInvoiceLineTax;
    onChange: (value: OfficeEInvoiceLineTax) => void;
    position: number;
    disabled?: boolean;
}) {
    const id = useId();
    const tax = value ?? createEmptyOfficeEInvoiceLineTax();
    function patch<K extends keyof OfficeEInvoiceLineTax>(key: K, next: OfficeEInvoiceLineTax[K]) { if (!disabled)
        onChange({ ...tax, [key]: next }); }
    return <NativeWorkspaceStyleScope css={[settingsCss]}>{<NativeDetails className="ie-einvoice-tax" data-testid={`einvoice-tax-${position}`}>
    <NativeSummary>Steuerliche Einordnung{tax.category ? ` · ${eInvoiceTaxLabels[tax.category]}` : ' · noch zu prüfen'}</NativeSummary>
    <NativeP className="ie-inline-note">Ein Steuersatz von 0 % belegt keine Steuerbefreiung. Die Einordnung gilt nur für diese Position.</NativeP>
    <NativeDiv className="ie-fields">
      <NativeLabel className="ie-field">Steuerkategorie, Position {position}<NativeSelect value={tax.category} disabled={disabled} onChange={event => patch('category', event.target.value as OfficeEInvoiceLineTax['category'])}><NativeOption value="">Noch zu prüfen</NativeOption>{Object.entries(eInvoiceTaxLabels).map(([key, text]) => <NativeOption value={key} key={key}>{text} ({key})</NativeOption>)}</NativeSelect></NativeLabel>
      <NativeLabel className="ie-field">Einheit im XML, Position {position}<NativeInput maxLength={3} value={tax.unitCode} list={`${id}-units`} disabled={disabled} placeholder="Zum Beispiel HUR für Stunden" onChange={event => patch('unitCode', event.target.value.toUpperCase())}/></NativeLabel>
      <NativeLabel className="ie-field ie-field-wide">Rechtsgrundlage, Position {position}<NativeSelect value={tax.legalBasis} disabled={disabled} onChange={event => patch('legalBasis', event.target.value as OfficeEInvoiceLineTax['legalBasis'])}>{Object.entries(legalBasisLabels).map(([key, text]) => <NativeOption value={key} key={key}>{text}</NativeOption>)}</NativeSelect></NativeLabel>
      <NativeLabel className="ie-field ie-field-wide">Begründung der Steuerbefreiung, Position {position}<NativeInput maxLength={1000} value={tax.exemptionReason} disabled={disabled} onChange={event => patch('exemptionReason', event.target.value)}/><NativeSmall>Die zutreffende Grundlage mit genauer Vorschrift angeben, soweit für die Steuerkategorie erforderlich.</NativeSmall></NativeLabel>
      <NativeLabel className="ie-field ie-field-wide">Befreiungscode, Position {position}, optional<NativeInput maxLength={100} value={tax.exemptionReasonCode} disabled={disabled} onChange={event => patch('exemptionReasonCode', event.target.value)}/><NativeSmall>Nur einen zur Begründung passenden VATEX-Code eintragen.</NativeSmall></NativeLabel>
    </NativeDiv>
    <NativeDatalist id={`${id}-units`}><NativeOption value="HUR">Stunde</NativeOption><NativeOption value="MIN">Minute</NativeOption><NativeOption value="DAY">Tag</NativeOption><NativeOption value="KMT">Kilometer</NativeOption><NativeOption value="C62">Stück / Leistung</NativeOption></NativeDatalist>
  </NativeDetails>}</NativeWorkspaceStyleScope>;
}
export function EInvoiceReadOnlySummary({ value, context, draft }: {
    value: OfficeEInvoiceMetadata;
    context: AssessmentContext;
    draft: boolean;
}) {
    return <NativeWorkspaceStyleScope css={[settingsCss, settingsCss]}>{<NativeSection className="ie-panel ie-einvoice" data-testid="einvoice-detail-summary"><NativeStyle>{settingsCss}</NativeStyle><NativeDiv className="ie-panel-head"><NativeDiv><NativeH2>Rechnungsformat & Leistungsempfänger</NativeH2><NativeP>{draft ? 'Gespeicherte Angaben für die Ausstellung' : 'Mit der Rechnung gespeicherte Angaben'}</NativeP></NativeDiv><NativeSpan className="ie-badge" data-tone={value.format === 'xrechnung' ? 'blue' : undefined}>{value.format === 'xrechnung' ? draft ? 'XRechnung vorgesehen' : 'XRechnung' : 'PDF'}</NativeSpan></NativeDiv>
    <EInvoiceRequirementSummary metadata={value} context={context}/>
    <NativeDiv className="ie-info">
      <NativeDl><NativeDt>Tatsächlicher Leistungsempfänger</NativeDt><NativeDd>{value.buyer.name ? `${value.buyer.name}\n${value.buyer.street} ${value.buyer.houseNumber}\n${value.buyer.postalCode} ${value.buyer.city}\n${value.buyer.country}` : 'Noch nicht angegeben'}<NativeBr /><NativeSmall>{value.buyerConfirmed ? 'Vom Bearbeiter bestätigt' : 'Noch nicht bestätigt'}</NativeSmall></NativeDd></NativeDl>
      <NativeDl><NativeDt>Einordnung</NativeDt><NativeDd>{kindLabels[value.legal.recipientKind]}</NativeDd></NativeDl>
      <NativeDl><NativeDt>Käuferreferenz / Leitweg-ID</NativeDt><NativeDd>{value.buyerReference || 'Nicht angegeben'}</NativeDd></NativeDl>
      <NativeDl><NativeDt>Elektronische Empfängeradresse</NativeDt><NativeDd>{value.buyerEndpoint.value ? `${value.buyerEndpoint.value}\n${value.buyerEndpoint.schemeId || 'Kennzeichnung fehlt'}` : 'Nicht angegeben'}</NativeDd></NativeDl>
      <NativeDl><NativeDt>Geplante Übermittlung</NativeDt><NativeDd>{value.legal.transmissionDate ? value.legal.transmissionDate.split('-').reverse().join('.') : 'Noch nicht angegeben'}</NativeDd></NativeDl>
      <NativeDl><NativeDt>Zustimmung zur PDF-Übermittlung</NativeDt><NativeDd>{answerLabels[value.legal.pdfConsent]}</NativeDd></NativeDl>
    </NativeDiv>
    {value.format === 'pdf' && <NativeP className="ie-inline-note">Die PDF enthält keinen strukturierten E-Rechnungsdatensatz.</NativeP>}
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
