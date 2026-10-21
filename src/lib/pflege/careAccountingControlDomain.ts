export type CareAccountingSourceDocument = {
  accountingDocumentId:string; tenantId:string; clientId:string; claimLineageId:string;
  sourceKind:'approved_invoice'|'approved_credit_note'|'payment_received'|'payment_reversal';
  sourceId:string; invoiceApprovalId:string; documentNumber:string; sourceFingerprint:string;
  effectiveDate:string; recordedAt:string; amountCents:number; receivableEffect:'increase'|'decrease'; sourceState:'valid';
};

export type CareAccountingPosting = {
  journalEntryId:string; clientRequestId:string; tenantId:string; clientId:string; claimLineageId:string;
  accountingDocumentId:string; sourceId:string; sourceFingerprint:string; journalNumber:string;
  postingDate:string; accountingPeriod:string; debitAccount:string; creditAccount:string; amountCents:number; recordedAt:string;
  exportBatchId:string|null; externalJournalReference:string|null;
  reconciliationState:'not_reconciled'|'matched'|'mismatch'; reconciliationReference:string|null; reconciledAt:string|null;
};

export type CareAccountingControlReport = {
  periodFrom:string; periodTo:string; sourceDocumentCount:number; postedDocumentCount:number;
  validInvoiceCents:number; approvedCreditCents:number; paymentCents:number; paymentReversalCents:number;
  netReceivableMovementCents:number; unpostedDocumentIds:readonly string[];
  matchedCount:number; mismatchCount:number; notReconciledCount:number; exportedCount:number;
  reportState:'complete'|'incomplete'; periodCloseState:'not_inferred'; historyMode:'append_only';
};

const dateOnly=/^\d{4}-\d{2}-\d{2}$/;const period=/^\d{4}-\d{2}$/;
const exactUtcMicros=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(?:Z|\+00:00)$/;const fingerprint=/^[0-9a-f]{32}$/;const account=/^[A-Za-z0-9][A-Za-z0-9._/-]{1,31}$/;
function required(value:string,label:string){if(typeof value!=='string'||!value.trim())throw new Error(`${label} fehlt.`);return value.trim();}
function calendar(value:string,label:string){if(!dateOnly.test(value)||Number.isNaN(Date.parse(`${value}T00:00:00Z`)))throw new Error(`${label} ist ungültig.`);}
function micros(value:string,label:string){if(!exactUtcMicros.test(value)||Number.isNaN(Date.parse(value)))throw new Error(`${label} benötigt exakt sechs UTC-Mikrosekundenstellen.`);}
function positive(value:number,label:string){if(!Number.isSafeInteger(value)||value<=0)throw new Error(`${label} ist ungültig.`);}
function validateSource(source:CareAccountingSourceDocument){
  for(const [value,label] of [[source.accountingDocumentId,'Buchungsbeleg-ID'],[source.tenantId,'Mandant'],[source.clientId,'Pflegefall'],[source.claimLineageId,'Forderungshistorie'],[source.sourceId,'Quell-ID'],[source.invoiceApprovalId,'Rechnungsfreigabe'],[source.documentNumber,'Belegnummer']] as const)required(value,label);
  if(!['approved_invoice','approved_credit_note','payment_received','payment_reversal'].includes(source.sourceKind))throw new Error('Quellbelegart ist ungültig.');
  if(source.sourceState!=='valid')throw new Error('Nur tatsächlich gültige Quellbelege dürfen ausgewertet werden.');
  if(!fingerprint.test(source.sourceFingerprint))throw new Error('Quellfingerprint ist ungültig.');calendar(source.effectiveDate,'Belegdatum');micros(source.recordedAt,'Quellerfassungszeit');positive(source.amountCents,'Quellbetrag');
  const expected=source.sourceKind==='approved_invoice'||source.sourceKind==='payment_reversal'?'increase':'decrease';if(source.receivableEffect!==expected)throw new Error('Forderungswirkung passt nicht zur Quellbelegart.');
  return Object.freeze({...source});
}
function validatePosting(posting:CareAccountingPosting){
  for(const [value,label] of [[posting.journalEntryId,'Journal-ID'],[posting.clientRequestId,'Anforderungs-ID'],[posting.tenantId,'Buchungsmandant'],[posting.clientId,'Buchungspflegefall'],[posting.claimLineageId,'Buchungs-Forderungshistorie'],[posting.accountingDocumentId,'Buchungsbeleg-ID'],[posting.sourceId,'Buchungsquelle'],[posting.journalNumber,'Journalnummer']] as const)required(value,label);
  if(!fingerprint.test(posting.sourceFingerprint))throw new Error('Buchungsfingerprint ist ungültig.');calendar(posting.postingDate,'Buchungsdatum');if(!period.test(posting.accountingPeriod)||posting.accountingPeriod!==posting.postingDate.slice(0,7))throw new Error('Buchungsperiode passt nicht zum Buchungsdatum.');
  if(!account.test(posting.debitAccount)||!account.test(posting.creditAccount)||posting.debitAccount===posting.creditAccount)throw new Error('Soll- und Habenkonto sind ungültig oder identisch.');positive(posting.amountCents,'Buchungsbetrag');micros(posting.recordedAt,'Buchungserfassungszeit');
  if((posting.exportBatchId===null)!==(posting.externalJournalReference===null))throw new Error('Exportcharge und externe Journalreferenz müssen gemeinsam dokumentiert werden.');
  if(!['not_reconciled','matched','mismatch'].includes(posting.reconciliationState))throw new Error('Rückabgleichsstatus ist ungültig.');
  if(posting.reconciliationState==='not_reconciled'&&(posting.reconciliationReference||posting.reconciledAt))throw new Error('Offener Rückabgleich darf keine Abgleichsbestätigung enthalten.');
  if(posting.reconciliationState!=='not_reconciled'){required(posting.reconciliationReference??'','Rückabgleichsreferenz');if(!posting.reconciledAt)throw new Error('Rückabgleichszeit fehlt.');micros(posting.reconciledAt,'Rückabgleichszeit');if(posting.reconciledAt<=posting.recordedAt)throw new Error('Rückabgleich muss nach der Buchung liegen.');}
  return Object.freeze({...posting});
}

export function buildCareAccountingControlReport(sourceDocuments:readonly CareAccountingSourceDocument[],postings:readonly CareAccountingPosting[],periodFrom:string,periodTo:string):CareAccountingControlReport{
  calendar(periodFrom,'Zeitraumbeginn');calendar(periodTo,'Zeitraumende');if(periodFrom>periodTo)throw new Error('Zeitraumbeginn liegt nach dem Zeitraumende.');
  if(!Array.isArray(sourceDocuments)||!sourceDocuments.length)throw new Error('Tatsächlich gültige Quellbelege fehlen.');const sources=sourceDocuments.map(validateSource);const sourceMap=new Map<string,CareAccountingSourceDocument>();const sourceIds=new Set<string>();const documentNumbers=new Set<string>();
  const tenantId=sources[0].tenantId,clientId=sources[0].clientId;
  for(const source of sources){if(source.tenantId!==tenantId||source.clientId!==clientId)throw new Error('Quellbelege müssen demselben Mandanten und Pflegefall angehören.');if(sourceMap.has(source.accountingDocumentId)||sourceIds.has(source.sourceId)||documentNumbers.has(source.documentNumber))throw new Error('Quellbelege enthalten doppelte native Identitäten.');sourceMap.set(source.accountingDocumentId,source);sourceIds.add(source.sourceId);documentNumbers.add(source.documentNumber);}
  const validPostings=postings.map(validatePosting);const journalIds=new Set<string>();const requestIds=new Set<string>();const journalNumbers=new Set<string>();const postedSources=new Set<string>();
  for(const posting of validPostings){if(journalIds.has(posting.journalEntryId)||requestIds.has(posting.clientRequestId)||journalNumbers.has(posting.journalNumber)||postedSources.has(posting.accountingDocumentId))throw new Error('Journal enthält doppelte Buchungs- oder Anforderungsidentitäten.');journalIds.add(posting.journalEntryId);requestIds.add(posting.clientRequestId);journalNumbers.add(posting.journalNumber);postedSources.add(posting.accountingDocumentId);const source=sourceMap.get(posting.accountingDocumentId);if(!source||posting.tenantId!==source.tenantId||posting.clientId!==source.clientId||posting.claimLineageId!==source.claimLineageId||posting.sourceId!==source.sourceId||posting.sourceFingerprint!==source.sourceFingerprint||posting.amountCents!==source.amountCents)throw new Error('Buchung ist nicht exakt an den gültigen Quellbeleg gebunden.');if(posting.postingDate<source.effectiveDate||posting.recordedAt<=source.recordedAt)throw new Error('Buchung liegt vor dem gültigen Quellbeleg.');}
  const periodSources=sources.filter(source=>source.effectiveDate>=periodFrom&&source.effectiveDate<=periodTo);const periodIds=new Set(periodSources.map(source=>source.accountingDocumentId));const periodPostings=validPostings.filter(posting=>periodIds.has(posting.accountingDocumentId));const sum=(kind:CareAccountingSourceDocument['sourceKind'])=>periodSources.filter(source=>source.sourceKind===kind).reduce((total,source)=>total+source.amountCents,0);
  const validInvoiceCents=sum('approved_invoice'),approvedCreditCents=sum('approved_credit_note'),paymentCents=sum('payment_received'),paymentReversalCents=sum('payment_reversal');const unpostedDocumentIds=periodSources.filter(source=>!postedSources.has(source.accountingDocumentId)).map(source=>source.accountingDocumentId).sort();
  return Object.freeze({periodFrom,periodTo,sourceDocumentCount:periodSources.length,postedDocumentCount:periodPostings.length,validInvoiceCents,approvedCreditCents,paymentCents,paymentReversalCents,netReceivableMovementCents:validInvoiceCents-approvedCreditCents-paymentCents+paymentReversalCents,unpostedDocumentIds:Object.freeze(unpostedDocumentIds),matchedCount:periodPostings.filter(p=>p.reconciliationState==='matched').length,mismatchCount:periodPostings.filter(p=>p.reconciliationState==='mismatch').length,notReconciledCount:periodPostings.filter(p=>p.reconciliationState==='not_reconciled').length,exportedCount:periodPostings.filter(p=>p.exportBatchId!==null).length,reportState:unpostedDocumentIds.length?'incomplete':'complete',periodCloseState:'not_inferred',historyMode:'append_only'});
}
