export const clientBillingWorkspaceVersion = '2026-10-16.1' as const;

export const clientBillingKinds = [
  'foundation_review', 'invoice_draft', 'invoice_approval', 'carrier_export',
  'carrier_return', 'invoice_adjustment', 'payment_entry', 'payment_reversal',
  'accounting_posting', 'accounting_reconciliation', 'dunning_notice', 'dunning_dispatch',
  'direct_debit_mandate', 'direct_debit_collection', 'cost_share_assessment',
  'period_closure', 'correction',
] as const;
export type ClientBillingKind = (typeof clientBillingKinds)[number];

export const clientBillingLabels: Record<ClientBillingKind, string> = {
  foundation_review: 'Abrechnungsgrundlage prüfen', invoice_draft: 'Rechnungsentwurf erfassen',
  invoice_approval: 'Rechnungsfassung freigeben', carrier_export: 'Kostenträgerexport prüfen',
  carrier_return: 'Kostenträgerrückläufer bearbeiten', invoice_adjustment: 'Storno / Gutschrift',
  payment_entry: 'Zahlung zuordnen', payment_reversal: 'Zahlungsstorno erfassen',
  accounting_posting: 'Buchhaltungskontierung', accounting_reconciliation: 'Rückabgleich',
  dunning_notice: 'Mahnung prüfen', dunning_dispatch: 'Mahnversand belegen',
  direct_debit_mandate: 'SEPA-Mandatsfassung', direct_debit_collection: 'Lastschrifteinzug / Rückgabe',
  cost_share_assessment: 'Eigenanteil / Zuzahlung', period_closure: 'Abrechnungsperiode schließen',
  correction: 'Berichtigung eines Vorgangs',
};

export const clientBillingBaseRights = ['office.clients.view', 'office.clients.view_sensitive', 'office.documents.view', 'office.invoices.view'] as const;
export const clientBillingWriteRights = ['office.clients.edit', 'office.clients.view_sensitive', 'office.documents.view', 'office.invoices.create', 'office.invoices.status_change'] as const;

export type ClientBillingSource = { kind: string; id: string; snapshot: Record<string, unknown> };
export type ClientBillingCommand = { version: typeof clientBillingWorkspaceVersion; requestId: string; eventId: string; tenantId: string; clientId: string; actorId: string; expectedHeadId: string | null; kind: ClientBillingKind; occurredAt: string; note: string; payload: Record<string, unknown> };
export type ClientBillingEvent = { id: string; sequence: number; previousId: string | null; tenantId: string; clientId: string; actorId: string; actorName: string; recordedAt: string; command: ClientBillingCommand };
export type ClientBillingHistory = { version: typeof clientBillingWorkspaceVersion; tenantId: string; clientId: string; count: number; headId: string | null; events: ClientBillingEvent[] };
export type ClientBillingContext = { version: typeof clientBillingWorkspaceVersion; tenantId: string; clientId: string; actorId: string; loadedAt: string; client: Record<string, unknown>; sources: { count: number; rows: ClientBillingSource[] }; history: ClientBillingHistory };
export type ClientBillingReceipt = { version: typeof clientBillingWorkspaceVersion; requestId: string; command: ClientBillingCommand; event: ClientBillingEvent };
export type ClientBillingState = { headId: string | null; events: ClientBillingEvent[]; corrected: string[] };

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const date=/^\d{4}-\d{2}-\d{2}$/;
const instant=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const cents=/^(?:0|[1-9]\d*)$/;
const object=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const required=(value:unknown,label:string)=>{if(typeof value!=='string'||!value.trim())throw Error(`${label} fehlt.`);return value;};
const validId=(value:unknown,label:string)=>{const text=required(value,label);if(!uuid.test(text)||text!==text.toLowerCase())throw Error(`${label} ist ungültig.`);return text;};
const validDate=(value:unknown,label:string)=>{const text=required(value,label);if(!date.test(text)||new Date(`${text}T00:00:00Z`).toISOString().slice(0,10)!==text)throw Error(`${label} ist ungültig.`);return text;};
const validInstant=(value:unknown,label:string)=>{const text=required(value,label);if(!instant.test(text)||Number.isNaN(Date.parse(text)))throw Error(`${label} ist ungültig.`);return text;};
const amount=(payload:Record<string,unknown>,key:string,label:string)=>{const value=required(payload[key],label);if(!cents.test(value))throw Error(`${label} muss als nichtnegativer Centbetrag angegeben werden.`);return value;};

export function clientBillingSource(value:unknown,label='Originalquelle'):asserts value is ClientBillingSource{if(!object(value)||Object.keys(value).sort().join(',')!=='id,kind,snapshot')throw Error(`${label} ist unvollständig.`);validId(value.id,`${label}-ID`);required(value.kind,`${label}-Art`);if(!object(value.snapshot)||value.snapshot.id!==value.id)throw Error(`${label} stimmt nicht mit dem nativen Original überein.`);}
const source=(payload:Record<string,unknown>,key:string,kinds:string[])=>{const value=payload[key];clientBillingSource(value,key);if(!kinds.includes(value.kind))throw Error(`${key} hat die falsche Originalart.`);return value;};
const field=(payload:Record<string,unknown>,key:string,label:string)=>required(payload[key],label);
const dated=(payload:Record<string,unknown>,key:string,label:string)=>validDate(payload[key],label);

export function validateClientBillingCommand(command:ClientBillingCommand):void{
  if(!object(command)||command.version!==clientBillingWorkspaceVersion)throw Error('Abrechnungsvorgang oder Version ist ungültig.');validId(command.requestId,'Anfrage-ID');validId(command.eventId,'Ereignis-ID');validId(command.tenantId,'Mandant');validId(command.clientId,'Pflegefall');validId(command.actorId,'Akteur');if(command.expectedHeadId!==null)validId(command.expectedHeadId,'Erwarteter Verlaufskopf');if(!clientBillingKinds.includes(command.kind))throw Error('Abrechnungsvorgang ist unbekannt.');validInstant(command.occurredAt,'Tatsächlicher Vorgangszeitpunkt');if(required(command.note,'Nachvollziehbarer Anlass').length>4000)throw Error('Anlass ist zu lang.');if(!object(command.payload))throw Error('Vorgangsangaben fehlen.');const p=command.payload;
  switch(command.kind){
    case'foundation_review':source(p,'foundation',['foundation']);source(p,'billingCase',['billing_case']);source(p,'proof',['proof']);source(p,'contract',['contract','financing']);dated(p,'periodFrom','Zeitraum von');dated(p,'periodTo','Zeitraum bis');field(p,'recipientKey','Empfängerschlüssel');field(p,'selectionFingerprint','Auswahlfingerabdruck');break;
    case'invoice_draft':source(p,'foundation',['foundation']);source(p,'draft',['draft']);field(p,'invoiceNumber','Rechnungsnummer');amount(p,'totalCents','Rechnungssumme');dated(p,'dueDate','Zahlungsziel');field(p,'positionFingerprint','Positionsfingerabdruck');break;
    case'invoice_approval':source(p,'draft',['draft']);source(p,'approval',['approval']);source(p,'document',['document']);field(p,'approvalVersion','Freigabeversion');amount(p,'totalCents','Freigabesumme');field(p,'documentFingerprint','Dokumentfingerabdruck');field(p,'taxTreatment','Steuerbehandlung');break;
    case'carrier_export':source(p,'approval',['approval']);source(p,'export',['export']);field(p,'recipientIk','Empfänger-IK');field(p,'specificationVersion','Spezifikationsfassung');field(p,'payloadFingerprint','Dateifingerabdruck');field(p,'validationResult','Unabhängiges Prüfergebnis');break;
    case'carrier_return':source(p,'export',['export']);source(p,'carrierReturn',['carrier_return']);field(p,'returnCode','Rückläufercode');field(p,'returnState','Rückläuferstatus');field(p,'fileFingerprint','Rückläuferfingerabdruck');field(p,'nextAction','Getrennte Folgeaktion');break;
    case'invoice_adjustment':source(p,'approval',['approval']);source(p,'adjustment',['adjustment']);field(p,'adjustmentKind','Gegenbuchungsart');amount(p,'adjustmentCents','Gegenbuchungsbetrag');field(p,'reason','Gegenbuchungsgrund');field(p,'approvalEvidence','Freigabebeleg');break;
    case'payment_entry':source(p,'openItem',['open_item']);source(p,'payment',['payment']);amount(p,'paymentCents','Zahlungsbetrag');dated(p,'valueDate','Wertstellung');field(p,'bookingReference','Buchungsreferenz');field(p,'allocationFingerprint','Zuordnungsfingerabdruck');break;
    case'payment_reversal':source(p,'openItem',['open_item']);source(p,'payment',['payment']);source(p,'reversal',['payment']);amount(p,'reversalCents','Stornobetrag');dated(p,'valueDate','Stornowertstellung');field(p,'reason','Stornogrund');break;
    case'accounting_posting':source(p,'sourceDocument',['accounting_source','approval','adjustment','payment']);source(p,'posting',['accounting_posting']);dated(p,'postingDate','Buchungstag');field(p,'period','Buchungsperiode');field(p,'debitAccount','Sollkonto');field(p,'creditAccount','Habenkonto');amount(p,'amountCents','Buchungsbetrag');break;
    case'accounting_reconciliation':source(p,'posting',['accounting_posting']);field(p,'externalJournalReference','Externe Journalreferenz');field(p,'reconciliationState','Rückabgleichstatus');field(p,'evidenceFingerprint','Abgleichbeleg');break;
    case'dunning_notice':source(p,'openItem',['open_item']);source(p,'notice',['dunning']);field(p,'stage','Mahnstufe');amount(p,'remainingCents','Offener Betrag');field(p,'paymentRevision','Zahlungsrevision');dated(p,'nextReviewOn','Nächste Prüfung');break;
    case'dunning_dispatch':source(p,'notice',['dunning']);source(p,'dispatch',['dunning_dispatch']);field(p,'recipient','Berechtigter Empfänger');field(p,'channel','Versandkanal');field(p,'authorizationEvidence','Berechtigungsbeleg');field(p,'deliveryEvidence','Zustellbeleg');break;
    case'direct_debit_mandate':source(p,'mandate',['mandate']);field(p,'mandateReference','Mandatsreferenz');dated(p,'signedOn','Mandatsdatum');field(p,'creditorId','Gläubiger-ID');field(p,'mandateFingerprint','Mandatsfingerabdruck');break;
    case'direct_debit_collection':source(p,'openItem',['open_item']);source(p,'mandate',['mandate']);source(p,'directDebit',['direct_debit']);amount(p,'collectionCents','Einzugsbetrag');dated(p,'dueDate','Fälligkeitsdatum');field(p,'collectionState','Einzugs-/Rückgabestatus');field(p,'bankReference','Bankreferenz');break;
    case'cost_share_assessment':source(p,'approval',['approval']);source(p,'costShare',['cost_share']);amount(p,'payerCents','Kostenträgeranteil');amount(p,'personalCents','Eigenanteil');field(p,'basis','Berechnungsgrundlage');field(p,'assessmentFingerprint','Berechnungsfingerabdruck');break;
    case'period_closure':source(p,'closure',['period_closure']);dated(p,'periodFrom','Periode von');dated(p,'periodTo','Periode bis');field(p,'invoiceCount','Rechnungsanzahl');amount(p,'invoiceTotalCents','Periodensumme');field(p,'approvalEvidence','Abschlussfreigabe');break;
    case'correction':validId(p.targetId,'Berichtigtes Ereignis');field(p,'reason','Berichtigungsgrund');field(p,'correctionEvidence','Berichtigungsbeleg');break;
  }
}

export function emptyClientBillingState():ClientBillingState{return{headId:null,events:[],corrected:[]};}
export function applyClientBillingCommand(state:ClientBillingState,command:ClientBillingCommand):ClientBillingState{validateClientBillingCommand(command);if(command.expectedHeadId!==state.headId)throw Error('Der Abrechnungsverlauf wurde zwischenzeitlich geändert.');if(state.events.some(event=>event.command.requestId===command.requestId||event.id===command.eventId))throw Error('Anfrage oder Ereignis ist bereits vorhanden.');const corrected=[...state.corrected];if(command.kind==='correction'){const target=String(command.payload.targetId);if(!state.events.some(event=>event.id===target&&event.command.kind!=='correction')||corrected.includes(target))throw Error('Nur ein vorhandener noch nicht berichtigter Originalvorgang kann berichtigt werden.');corrected.push(target);}return{headId:command.eventId,events:[...state.events],corrected};}
export function decodeClientBillingHistory(value:unknown,scope:{tenantId:string;clientId:string}):{history:ClientBillingHistory;state:ClientBillingState}{if(!object(value)||value.version!==clientBillingWorkspaceVersion||value.tenantId!==scope.tenantId||value.clientId!==scope.clientId||!Array.isArray(value.events)||value.count!==value.events.length)throw Error('Der Abrechnungsverlauf ist unvollständig.');let state=emptyClientBillingState();const ids=new Set<string>();for(let index=0;index<value.events.length;index++){const raw=value.events[index];if(!object(raw)||raw.sequence!==index+1||raw.previousId!==state.headId||raw.tenantId!==scope.tenantId||raw.clientId!==scope.clientId||!object(raw.command))throw Error('Der Abrechnungsverlauf ist abgeschnitten oder falsch zugeordnet.');const command=structuredClone(raw.command)as ClientBillingCommand;validateClientBillingCommand(command);if(command.tenantId!==scope.tenantId||command.clientId!==scope.clientId||raw.id!==command.eventId||ids.has(raw.id as string))throw Error('Der Abrechnungsverlauf enthält fremde oder doppelte Originale.');ids.add(raw.id as string);state=applyClientBillingCommand(state,command);state.events.push(structuredClone(raw)as ClientBillingEvent);}if(value.headId!==state.headId)throw Error('Der Abrechnungsverlauf hat keinen eindeutigen Kopf.');return{history:structuredClone(value)as ClientBillingHistory,state};}
export function decodeClientBillingContext(value:unknown,expected:{tenantId:string;clientId:string;actorId:string}):ClientBillingContext{if(!object(value)||Object.keys(value).sort().join(',')!=='actorId,client,clientId,history,loadedAt,sources,tenantId,version'||value.version!==clientBillingWorkspaceVersion||value.tenantId!==expected.tenantId||value.clientId!==expected.clientId||value.actorId!==expected.actorId||!object(value.client)||!object(value.sources)||!Array.isArray(value.sources.rows)||value.sources.count!==value.sources.rows.length)throw Error('Vollständige Abrechnungsoriginale konnten nicht bestätigt werden.');validInstant(value.loadedAt,'Lesezeitpunkt');const ids=new Set<string>();for(const raw of value.sources.rows){clientBillingSource(raw);if(ids.has(`${raw.kind}:${raw.id}`))throw Error('Originalquelle ist doppelt.');ids.add(`${raw.kind}:${raw.id}`);const tenant=raw.snapshot.tenant_id,client=raw.snapshot.client_id;if(tenant!==undefined&&tenant!==expected.tenantId||client!==undefined&&client!==expected.clientId)throw Error('Originalquelle gehört zu einem anderen Mandanten oder Pflegefall.');}decodeClientBillingHistory(value.history,expected);return structuredClone(value)as ClientBillingContext;}
export function assertClientBillingSelectionCurrent(command:ClientBillingCommand,context:ClientBillingContext):void{validateClientBillingCommand(command);const inspect=(value:unknown):void=>{if(Array.isArray(value))value.forEach(inspect);else if(object(value)){if(Object.keys(value).sort().join(',')==='id,kind,snapshot'){clientBillingSource(value);const found=context.sources.rows.find(row=>row.kind===value.kind&&row.id===value.id);if(!found||JSON.stringify(found)!==JSON.stringify(value))throw Error('Eine ausgewählte Abrechnungsgrundlage ist nicht mehr aktuell.');}else Object.values(value).forEach(inspect);}};inspect(command.payload);}
export function decodeClientBillingReceipt(value:unknown,command:ClientBillingCommand):ClientBillingReceipt{if(!object(value)||value.version!==clientBillingWorkspaceVersion||value.requestId!==command.requestId||!object(value.command)||JSON.stringify(value.command)!==JSON.stringify(command)||!object(value.event)||value.event.id!==command.eventId||JSON.stringify(value.event.command)!==JSON.stringify(command))throw Error('Die native Abrechnungsquittung stimmt nicht mit der gesicherten Anfrage überein.');return structuredClone(value)as ClientBillingReceipt;}
