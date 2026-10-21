import type { CareReceivableOpenItem } from './careReceivablesDomain';

export type CareSepaMandate = {
  mandateVersionId: string;
  mandateId: string;
  revision: number;
  tenantId: string;
  clientId: string;
  mandateReference: string;
  creditorIdentifier: string;
  debtorAccountFingerprint: string;
  authorizationEvidenceId: string;
  authorizationFingerprint: string;
  signedAt: string;
  validFrom: string;
  validUntil: string | null;
  revokedAt: string | null;
  recordedAt: string;
};

export type CareDirectDebitOrder = {
  directDebitOrderId: string;
  clientRequestId: string;
  tenantId: string;
  clientId: string;
  openItemId: string;
  invoiceApprovalId: string;
  claimLineageId: string;
  documentFingerprint: string;
  invoiceNumber: string;
  mandateVersionId: string;
  mandateId: string;
  mandateReference: string;
  amountCents: number;
  collectionDate: string;
  preparedAt: string;
  orderState: 'prepared';
  fileReleaseState: 'not_inferred';
  paymentState: 'not_inferred';
};

export type CareDirectDebitRelease = {
  directDebitReleaseId: string;
  clientRequestId: string;
  tenantId: string;
  clientId: string;
  directDebitOrderId: string;
  mandateVersionId: string;
  mandateRevision: number;
  mandateReadAt: string;
  amountCents: number;
  collectionDate: string;
  exportBatchId: string;
  exportFileName: string;
  exportFileFingerprint: string;
  releasedAt: string;
};

export type CareDirectDebitReturn = {
  directDebitReturnId: string;
  clientRequestId: string;
  tenantId: string;
  clientId: string;
  directDebitReleaseId: string;
  bankTransactionReference: string;
  returnCodeSystem: string;
  returnCode: string;
  returnedAmountCents: number;
  valueDate: string;
  receivedAt: string;
  paymentState: 'not_inferred';
};

export type CareDirectDebitStatus = {
  asOfDate: string;
  evaluatedAt: string;
  openItem: CareReceivableOpenItem;
  mandate: CareSepaMandate | null;
  orders: readonly CareDirectDebitOrder[];
  releases: readonly CareDirectDebitRelease[];
  returns: readonly CareDirectDebitReturn[];
  mandateState: 'missing' | 'not_yet_valid' | 'active' | 'expired' | 'revoked';
  currentOrderState: 'none' | 'prepared' | 'released' | 'returned';
  releaseEligibility: 'eligible' | 'missing_mandate' | 'invalid_mandate' | 'settled' | 'amount_changed' | 'already_released';
  amountChangedSinceOrder: boolean;
  paymentState: 'not_inferred';
  historyMode: 'append_only';
};

const dateOnly=/^\d{4}-\d{2}-\d{2}$/;
const exactUtcMicros=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(?:Z|\+00:00)$/;
const fingerprint=/^[0-9a-f]{32}$/;
function required(value:string,label:string){if(typeof value!=='string'||!value.trim())throw new Error(`${label} fehlt.`);return value.trim();}
function date(value:string,label:string){if(!dateOnly.test(value)||Number.isNaN(Date.parse(`${value}T00:00:00Z`)))throw new Error(`${label} ist ungültig.`);}
function micros(value:string,label:string){if(!exactUtcMicros.test(value)||Number.isNaN(Date.parse(value)))throw new Error(`${label} benötigt exakt sechs UTC-Mikrosekundenstellen.`);}
function cents(value:number,label:string){if(!Number.isSafeInteger(value)||value<0)throw new Error(`${label} ist ungültig.`);}

function validateMandate(value:CareSepaMandate):CareSepaMandate{
  for(const [field,label] of [[value.mandateVersionId,'Mandatsversion'],[value.mandateId,'Mandat'],[value.tenantId,'Mandatsmandant'],[value.clientId,'Mandatspflegefall'],[value.mandateReference,'Mandatsreferenz'],[value.creditorIdentifier,'Gläubiger-ID'],[value.authorizationEvidenceId,'Mandatsbeleg']] as const)required(field,label);
  if(!Number.isSafeInteger(value.revision)||value.revision<1)throw new Error('Mandatsrevision ist ungültig.');
  if(!fingerprint.test(value.debtorAccountFingerprint)||!fingerprint.test(value.authorizationFingerprint))throw new Error('Mandatskonto- oder Belegfingerprint ist ungültig.');
  micros(value.signedAt,'Mandatsunterschrift');micros(value.recordedAt,'Mandatserfassung');date(value.validFrom,'Mandatsbeginn');if(value.validUntil)date(value.validUntil,'Mandatsende');if(value.revokedAt)micros(value.revokedAt,'Mandatswiderruf');
  if(value.recordedAt<value.signedAt||value.validUntil&&value.validUntil<value.validFrom||value.revokedAt&&value.revokedAt<value.signedAt)throw new Error('Mandatszeiten sind widersprüchlich.');
  return Object.freeze({...value});
}

function mandateState(mandate:CareSepaMandate|null,collectionDate:string,evaluatedAt:string):CareDirectDebitStatus['mandateState']{
  if(!mandate)return'missing';
  if(mandate.revokedAt&&mandate.revokedAt<=evaluatedAt)return'revoked';
  if(collectionDate<mandate.validFrom)return'not_yet_valid';
  if(mandate.validUntil&&collectionDate>mandate.validUntil)return'expired';
  return'active';
}

function validateOrder(order:CareDirectDebitOrder,open:CareReceivableOpenItem,mandates:readonly CareSepaMandate[]):CareDirectDebitOrder{
  for(const [field,label] of [[order.directDebitOrderId,'Einzugsauftrag'],[order.clientRequestId,'Einzugs-Anforderungs-ID'],[order.tenantId,'Einzugsmandant'],[order.clientId,'Einzugspflegefall'],[order.openItemId,'Offener Posten'],[order.invoiceApprovalId,'Rechnungsfreigabe'],[order.claimLineageId,'Forderungshistorie'],[order.invoiceNumber,'Rechnungsnummer'],[order.mandateVersionId,'Mandatsversion'],[order.mandateId,'Mandat'],[order.mandateReference,'Mandatsreferenz']] as const)required(field,label);
  if(!fingerprint.test(order.documentFingerprint))throw new Error('Einzugs-Rechnungsfingerprint ist ungültig.');date(order.collectionDate,'Einzugsdatum');micros(order.preparedAt,'Einzugsvorbereitung');cents(order.amountCents,'Einzugsbetrag');if(order.amountCents<=0)throw new Error('Einzugsbetrag muss positiv sein.');
  if(order.orderState!=='prepared'||order.fileReleaseState!=='not_inferred'||order.paymentState!=='not_inferred')throw new Error('Vorbereitung darf Dateifreigabe oder Zahlung nicht ableiten.');
  if(order.tenantId!==open.tenantId||order.clientId!==open.clientId||order.openItemId!==open.openItemId||order.invoiceApprovalId!==open.invoiceApprovalId||order.claimLineageId!==open.claimLineageId||order.documentFingerprint!==open.documentFingerprint||order.invoiceNumber!==open.invoiceNumber)throw new Error('Einzugsauftrag ist nicht exakt an den offenen Posten gebunden.');
  const mandate=mandates.find(item=>item.mandateVersionId===order.mandateVersionId);if(!mandate||mandate.mandateId!==order.mandateId||mandate.mandateReference!==order.mandateReference||mandate.tenantId!==order.tenantId||mandate.clientId!==order.clientId)throw new Error('Einzugsauftrag ist nicht exakt an die Mandatsversion gebunden.');
  if(mandate.recordedAt>order.preparedAt)throw new Error('Einzugsauftrag liegt vor der belegten Mandatsversion.');
  return Object.freeze({...order});
}

export function buildCareDirectDebitStatus(sourceOpenItem:CareReceivableOpenItem,sourceMandates:readonly CareSepaMandate[],sourceOrders:readonly CareDirectDebitOrder[],sourceReleases:readonly CareDirectDebitRelease[],sourceReturns:readonly CareDirectDebitReturn[],asOfDate:string,evaluatedAt:string):CareDirectDebitStatus{
  date(asOfDate,'Einzugsstichtag');micros(evaluatedAt,'Einzugsauswertung');if(evaluatedAt.slice(0,10)!==asOfDate)throw new Error('Einzugsauswertung und Stichtag passen nicht zusammen.');
  const open=Object.freeze({...sourceOpenItem,appliedPaymentEventIds:Object.freeze([...sourceOpenItem.appliedPaymentEventIds])});
  const mandates=sourceMandates.map(validateMandate).sort((a,b)=>a.mandateId.localeCompare(b.mandateId)||a.revision-b.revision||a.recordedAt.localeCompare(b.recordedAt));
  const ids=new Set<string>();const priorRevisionByMandate=new Map<string,number>();for(const mandate of mandates){if(ids.has(mandate.mandateVersionId))throw new Error('Mandatsversion ist doppelt.');ids.add(mandate.mandateVersionId);const prior=priorRevisionByMandate.get(mandate.mandateId);if(prior!=null&&mandate.revision!==prior+1)throw new Error('Mandatsrevision ist nicht lückenlos.');if(prior==null&&mandate.revision!==1)throw new Error('Mandatsrevision ist nicht lückenlos.');priorRevisionByMandate.set(mandate.mandateId,mandate.revision);if(mandate.tenantId!==open.tenantId||mandate.clientId!==open.clientId)throw new Error('Mandat gehört zu einem anderen Scope.');}
  const orders=sourceOrders.map(order=>validateOrder(order,open,mandates)).sort((a,b)=>a.preparedAt.localeCompare(b.preparedAt));
  if(new Set(orders.map(item=>item.directDebitOrderId)).size!==orders.length||new Set(orders.map(item=>item.clientRequestId)).size!==orders.length)throw new Error('Einzugsaufträge enthalten doppelte Identitäten.');
  const releases=sourceReleases.map(release=>{for(const [field,label] of [[release.directDebitReleaseId,'Dateifreigabe'],[release.clientRequestId,'Freigabe-Anforderungs-ID'],[release.tenantId,'Freigabemandant'],[release.clientId,'Freigabepflegefall'],[release.directDebitOrderId,'Einzugsauftrag'],[release.mandateVersionId,'Freigabe-Mandatsversion'],[release.exportBatchId,'Exportcharge'],[release.exportFileName,'Exportdatei']] as const)required(field,label);if(!Number.isSafeInteger(release.mandateRevision)||release.mandateRevision<1)throw new Error('Freigabe-Mandatsrevision ist ungültig.');if(!fingerprint.test(release.exportFileFingerprint))throw new Error('Exportdateifingerprint ist ungültig.');cents(release.amountCents,'Freigabebetrag');date(release.collectionDate,'Freigabe-Einzugsdatum');micros(release.mandateReadAt,'Mandatslesezeit');micros(release.releasedAt,'Dateifreigabezeit');const order=orders.find(item=>item.directDebitOrderId===release.directDebitOrderId);const bound=mandates.find(item=>item.mandateVersionId===release.mandateVersionId);const latestAtRead=bound?mandates.filter(item=>item.mandateId===bound.mandateId&&item.recordedAt<=release.mandateReadAt).sort((a,b)=>a.revision-b.revision||a.recordedAt.localeCompare(b.recordedAt)).at(-1):null;if(!order||!bound||latestAtRead?.mandateVersionId!==bound.mandateVersionId||release.tenantId!==order.tenantId||release.clientId!==order.clientId||release.mandateVersionId!==order.mandateVersionId||release.mandateRevision!==bound.revision||release.amountCents!==order.amountCents||release.collectionDate!==order.collectionDate||release.mandateReadAt<=order.preparedAt||release.releasedAt<=release.mandateReadAt||mandateState(bound,release.collectionDate,release.mandateReadAt)!=='active')throw new Error('Dateifreigabe besitzt keine aktuelle gültige Mandatsgrundlage.');return Object.freeze({...release});}).sort((a,b)=>a.releasedAt.localeCompare(b.releasedAt));
  if(new Set(releases.map(item=>item.directDebitOrderId)).size!==releases.length)throw new Error('Einzugsauftrag wurde mehrfach freigegeben.');
  const returns=sourceReturns.map(item=>{for(const [field,label] of [[item.directDebitReturnId,'Rücklastschrift'],[item.clientRequestId,'Rücklastschrift-Anforderungs-ID'],[item.tenantId,'Rücklastschriftmandant'],[item.clientId,'Rücklastschriftpflegefall'],[item.directDebitReleaseId,'Dateifreigabe'],[item.bankTransactionReference,'Bankreferenz'],[item.returnCodeSystem,'Rückgabecodesystem'],[item.returnCode,'Rückgabecode']] as const)required(field,label);cents(item.returnedAmountCents,'Rücklastschriftbetrag');date(item.valueDate,'Rücklastschrift-Wertstellung');micros(item.receivedAt,'Rücklastschrift-Eingang');const release=releases.find(value=>value.directDebitReleaseId===item.directDebitReleaseId);if(!release||item.tenantId!==release.tenantId||item.clientId!==release.clientId||item.returnedAmountCents!==release.amountCents||item.receivedAt<=release.releasedAt||item.paymentState!=='not_inferred')throw new Error('Rücklastschrift ist nicht exakt an die Freigabe gebunden.');return Object.freeze({...item});}).sort((a,b)=>a.receivedAt.localeCompare(b.receivedAt));
  if(new Set(returns.map(item=>item.directDebitReleaseId)).size!==returns.length)throw new Error('Dateifreigabe besitzt mehrere Rücklastschriften.');
  const currentOrder=orders.at(-1)??null;const relevantMandates=mandates.filter(item=>item.recordedAt<=evaluatedAt&&(!currentOrder||item.mandateId===currentOrder.mandateId));const mandate=relevantMandates.sort((a,b)=>a.recordedAt.localeCompare(b.recordedAt)||a.revision-b.revision).at(-1)??null;const currentRelease=currentOrder?releases.find(item=>item.directDebitOrderId===currentOrder.directDebitOrderId)??null:null;const currentReturn=currentRelease?returns.find(item=>item.directDebitReleaseId===currentRelease.directDebitReleaseId)??null:null;const state=mandateState(mandate,currentOrder?.collectionDate??asOfDate,evaluatedAt);const amountChangedSinceOrder=Boolean(currentOrder&&currentOrder.amountCents!==open.remainingAmountCents);
  const releaseEligibility:CareDirectDebitStatus['releaseEligibility']=currentRelease?'already_released':open.remainingAmountCents===0?'settled':!mandate?'missing_mandate':state!=='active'?'invalid_mandate':amountChangedSinceOrder?'amount_changed':'eligible';
  return Object.freeze({asOfDate,evaluatedAt,openItem:open,mandate,orders:Object.freeze(orders),releases:Object.freeze(releases),returns:Object.freeze(returns),mandateState:state,currentOrderState:currentReturn?'returned':currentRelease?'released':currentOrder?'prepared':'none',releaseEligibility,amountChangedSinceOrder,paymentState:'not_inferred',historyMode:'append_only'});
}
