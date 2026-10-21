import type { CareReceivableOpenItem } from './careReceivablesDomain';

export type CareDunningStage = 'payment_reminder' | 'first_notice' | 'second_notice' | 'final_notice';

export type CareDunningNotice = {
  dunningNoticeId: string;
  clientRequestId: string;
  tenantId: string;
  clientId: string;
  openItemId: string;
  invoiceApprovalId: string;
  claimLineageId: string;
  documentFingerprint: string;
  invoiceNumber: string;
  stage: CareDunningStage;
  predecessorNoticeId: string | null;
  dueDate: string;
  noticeAmountCents: number;
  paidAmountCents: number;
  remainingAmountCents: number;
  paymentRevision: number;
  latestPaymentAt: string | null;
  paymentReadAt: string;
  recordedAt: string;
  nextReviewDate: string;
  feeState: 'not_inferred';
  interestState: 'not_inferred';
  dispatchState: 'not_inferred';
};

export type CareDunningDispatch = {
  dunningDispatchId: string;
  clientRequestId: string;
  tenantId: string;
  clientId: string;
  dunningNoticeId: string;
  recipientId: string;
  recipientRole: 'debtor' | 'authorized_representative';
  authorizationEvidenceId: string;
  authorizationFingerprint: string;
  dispatchChannel: 'postal' | 'secure_portal';
  deliveryDestinationFingerprint: string;
  dispatchProofId: string;
  dispatchProofFingerprint: string;
  paymentRevision: number;
  latestPaymentAt: string | null;
  remainingAmountCents: number;
  paymentReadAt: string;
  dispatchedAt: string;
};

export type CareDunningStatus = {
  asOfDate: string;
  evaluatedAt: string;
  openItem: CareReceivableOpenItem;
  notices: readonly CareDunningNotice[];
  dispatches: readonly CareDunningDispatch[];
  currentPaymentRevision: number;
  latestPaymentEventAt: string | null;
  paymentChangedSinceLastNotice: boolean;
  currentState: 'eligible' | 'not_due' | 'awaiting_review_date' | 'settled' | 'maximum_stage_reached';
  nextStage: CareDunningStage | null;
  lastNoticeDispatchState: 'none' | 'not_dispatched' | 'dispatched';
  feeState: 'not_inferred';
  interestState: 'not_inferred';
  debtEnforcementState: 'not_inferred';
  historyMode: 'append_only';
};

const stages: readonly CareDunningStage[] = ['payment_reminder', 'first_notice', 'second_notice', 'final_notice'];
const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
const exactUtcMicros = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(?:Z|\+00:00)$/;
const fingerprint = /^[0-9a-f]{32}$/;

function required(value: string, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} fehlt.`);
  return value.trim();
}

function calendarDate(value: string, label: string): void {
  if (!dateOnly.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw new Error(`${label} ist ungültig.`);
}

function exactMicros(value: string, label: string): void {
  if (!exactUtcMicros.test(value) || Number.isNaN(Date.parse(value))) throw new Error(`${label} benötigt exakt sechs UTC-Mikrosekundenstellen.`);
}

function nonNegativeCents(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} ist ungültig.`);
}

function validateOpenItem(item: CareReceivableOpenItem, asOfDate: string): CareReceivableOpenItem {
  for (const [value, label] of [
    [item.openItemId, 'Offener-Posten-ID'], [item.invoiceApprovalId, 'Rechnungsfreigabe'],
    [item.invoiceNumber, 'Rechnungsnummer'], [item.tenantId, 'Mandant'], [item.clientId, 'Pflegefall'],
    [item.claimLineageId, 'Forderungshistorie'],
  ] as const) required(value, label);
  if (!fingerprint.test(item.documentFingerprint)) throw new Error('Rechnungsfingerprint ist ungültig.');
  exactMicros(item.approvedAt, 'Rechnungsfreigabezeit');
  calendarDate(item.dueDate, 'Fälligkeit');
  nonNegativeCents(item.receivableAmountCents, 'Forderungsbetrag');
  nonNegativeCents(item.paidAmountCents, 'Zahlungsbetrag');
  nonNegativeCents(item.remainingAmountCents, 'Restbetrag');
  if (item.receivableAmountCents <= 0 || item.paidAmountCents + item.remainingAmountCents !== item.receivableAmountCents) throw new Error('Forderung, Zahlung und Restbetrag sind nicht centgenau abgestimmt.');
  const expectedPayment = item.remainingAmountCents === 0 ? 'paid' : item.paidAmountCents > 0 ? 'partially_paid' : 'open';
  const expectedDue = item.remainingAmountCents === 0 ? 'settled' : item.dueDate < asOfDate ? 'overdue' : item.dueDate === asOfDate ? 'due_today' : 'not_due';
  if (item.paymentStatus !== expectedPayment || item.dueStatus !== expectedDue) throw new Error('Zahlungs- oder Fälligkeitsstatus ist widersprüchlich.');
  if (item.lastPaymentAt) exactMicros(item.lastPaymentAt, 'Letzte Zahlungszeit');
  return Object.freeze({ ...item, appliedPaymentEventIds: Object.freeze([...item.appliedPaymentEventIds]) });
}

function validateNotice(notice: CareDunningNotice): CareDunningNotice {
  for (const [value, label] of [
    [notice.dunningNoticeId, 'Mahnereignis'], [notice.clientRequestId, 'Anforderungs-ID'],
    [notice.tenantId, 'Mahnmandant'], [notice.clientId, 'Mahnpflegefall'], [notice.openItemId, 'Offener Posten'],
    [notice.invoiceApprovalId, 'Rechnungsfreigabe'], [notice.claimLineageId, 'Forderungshistorie'],
    [notice.invoiceNumber, 'Rechnungsnummer'],
  ] as const) required(value, label);
  if (!stages.includes(notice.stage)) throw new Error('Mahnstufe ist ungültig.');
  if (!fingerprint.test(notice.documentFingerprint)) throw new Error('Mahnungs-Rechnungsfingerprint ist ungültig.');
  calendarDate(notice.dueDate, 'Mahnungsfälligkeit');
  calendarDate(notice.nextReviewDate, 'Nächste Prüfung');
  exactMicros(notice.paymentReadAt, 'Zahlungslesezeit');
  exactMicros(notice.recordedAt, 'Mahnereigniszeit');
  if (notice.latestPaymentAt) exactMicros(notice.latestPaymentAt, 'Letzte gelesene Zahlungszeit');
  for (const [value, label] of [[notice.noticeAmountCents, 'Mahnbetrag'], [notice.paidAmountCents, 'Gelesener Zahlbetrag'], [notice.remainingAmountCents, 'Gelesener Restbetrag']] as const) nonNegativeCents(value, label);
  if (notice.noticeAmountCents <= 0 || notice.remainingAmountCents !== notice.noticeAmountCents) throw new Error('Mahnbetrag muss dem neu gelesenen positiven Restbetrag entsprechen.');
  if (!Number.isSafeInteger(notice.paymentRevision) || notice.paymentRevision < 0) throw new Error('Zahlungsrevision ist ungültig.');
  if ((notice.paymentRevision === 0) !== (notice.latestPaymentAt === null)) throw new Error('Zahlungsrevision und letzte Zahlungszeit sind widersprüchlich.');
  if (notice.latestPaymentAt && notice.paymentReadAt < notice.latestPaymentAt) throw new Error('Zahlungen wurden nicht bis zum Mahnschritt neu gelesen.');
  if (notice.recordedAt <= notice.paymentReadAt) throw new Error('Mahnschritt muss nach der erneuten Zahlungsprüfung liegen.');
  if (notice.nextReviewDate < notice.recordedAt.slice(0, 10)) throw new Error('Nächste Prüfung liegt vor dem Mahnschritt.');
  if (notice.feeState !== 'not_inferred' || notice.interestState !== 'not_inferred' || notice.dispatchState !== 'not_inferred') throw new Error('Gebühr, Zins oder Versand darf nicht aus der Mahnstufe abgeleitet werden.');
  return Object.freeze({ ...notice });
}

function validateDispatch(dispatch: CareDunningDispatch): CareDunningDispatch {
  for (const [value, label] of [
    [dispatch.dunningDispatchId, 'Versandereignis'], [dispatch.clientRequestId, 'Versand-Anforderungs-ID'],
    [dispatch.tenantId, 'Versandmandant'], [dispatch.clientId, 'Versandpflegefall'], [dispatch.dunningNoticeId, 'Mahnereignis'],
    [dispatch.recipientId, 'Empfänger'], [dispatch.authorizationEvidenceId, 'Versandberechtigung'],
    [dispatch.dispatchProofId, 'Versandnachweis'],
  ] as const) required(value, label);
  if (!['debtor', 'authorized_representative'].includes(dispatch.recipientRole)) throw new Error('Empfängerrolle ist ungültig.');
  if (!['postal', 'secure_portal'].includes(dispatch.dispatchChannel)) throw new Error('Versandkanal ist ungültig.');
  for (const [value, label] of [
    [dispatch.authorizationFingerprint, 'Berechtigungsfingerprint'],
    [dispatch.deliveryDestinationFingerprint, 'Empfängerfingerprint'],
    [dispatch.dispatchProofFingerprint, 'Versandnachweisfingerprint'],
  ] as const) if (!fingerprint.test(value)) throw new Error(`${label} ist ungültig.`);
  if (!Number.isSafeInteger(dispatch.paymentRevision) || dispatch.paymentRevision < 0) throw new Error('Versand-Zahlungsrevision ist ungültig.');
  if ((dispatch.paymentRevision === 0) !== (dispatch.latestPaymentAt === null)) throw new Error('Versand-Zahlungsrevision und letzte Zahlungszeit sind widersprüchlich.');
  if (dispatch.latestPaymentAt) exactMicros(dispatch.latestPaymentAt, 'Letzte Versand-Zahlungszeit');
  nonNegativeCents(dispatch.remainingAmountCents, 'Versand-Restbetrag');
  if (dispatch.remainingAmountCents <= 0) throw new Error('Versand benötigt einen positiven Restbetrag.');
  exactMicros(dispatch.paymentReadAt, 'Versand-Zahlungslesezeit');
  exactMicros(dispatch.dispatchedAt, 'Versandzeit');
  if (dispatch.latestPaymentAt && dispatch.paymentReadAt < dispatch.latestPaymentAt) throw new Error('Zahlungen wurden nicht bis zum Versand neu gelesen.');
  if (dispatch.dispatchedAt <= dispatch.paymentReadAt) throw new Error('Versand muss nach der erneuten Zahlungsprüfung liegen.');
  return Object.freeze({ ...dispatch });
}

export function buildCareDunningStatus(
  sourceOpenItem: CareReceivableOpenItem,
  sourceNotices: readonly CareDunningNotice[],
  sourceDispatches: readonly CareDunningDispatch[],
  asOfDate: string,
  evaluatedAt: string,
  currentPaymentRevision = sourceOpenItem.appliedPaymentEventIds.length,
  latestPaymentEventAt: string | null = sourceOpenItem.lastPaymentAt,
): CareDunningStatus {
  calendarDate(asOfDate, 'Mahnungsstichtag');
  exactMicros(evaluatedAt, 'Auswertungszeit');
  if (evaluatedAt.slice(0, 10) !== asOfDate) throw new Error('Auswertungszeit und Mahnungsstichtag passen nicht zusammen.');
  const openItem = validateOpenItem(sourceOpenItem, asOfDate);
  if (!Number.isSafeInteger(currentPaymentRevision) || currentPaymentRevision < 0) throw new Error('Aktuelle Zahlungsrevision ist ungültig.');
  if ((currentPaymentRevision === 0) !== (latestPaymentEventAt === null)) throw new Error('Aktuelle Zahlungsrevision und Ereigniszeit sind widersprüchlich.');
  if (latestPaymentEventAt) exactMicros(latestPaymentEventAt, 'Letzte Zahlungsereigniszeit');
  const notices = sourceNotices.map(validateNotice).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.dunningNoticeId.localeCompare(b.dunningNoticeId));
  const noticeIds = new Set<string>();
  const noticeRequestIds = new Set<string>();
  for (let index = 0; index < notices.length; index += 1) {
    const notice = notices[index];
    if (noticeIds.has(notice.dunningNoticeId) || noticeRequestIds.has(notice.clientRequestId)) throw new Error('Mahnhistorie enthält doppelte Ereignis- oder Anforderungsidentitäten.');
    noticeIds.add(notice.dunningNoticeId); noticeRequestIds.add(notice.clientRequestId);
    if (notice.tenantId !== openItem.tenantId || notice.clientId !== openItem.clientId || notice.openItemId !== openItem.openItemId || notice.invoiceApprovalId !== openItem.invoiceApprovalId || notice.claimLineageId !== openItem.claimLineageId || notice.documentFingerprint !== openItem.documentFingerprint || notice.invoiceNumber !== openItem.invoiceNumber || notice.dueDate !== openItem.dueDate) throw new Error('Mahnschritt ist nicht exakt an den offenen Posten gebunden.');
    if (notice.stage !== stages[index]) throw new Error('Mahnstufen dürfen weder übersprungen noch wiederholt werden.');
    const predecessor = index === 0 ? null : notices[index - 1].dunningNoticeId;
    if (notice.predecessorNoticeId !== predecessor) throw new Error('Mahnstufe ist nicht lückenlos an ihre Vorgängerin gebunden.');
    if (notice.paidAmountCents + notice.remainingAmountCents !== openItem.receivableAmountCents) throw new Error('Mahnungs-Zahlungsstand stimmt nicht mit der ursprünglichen Forderung überein.');
  }

  const dispatches = sourceDispatches.map(validateDispatch).sort((a, b) => a.dispatchedAt.localeCompare(b.dispatchedAt) || a.dunningDispatchId.localeCompare(b.dunningDispatchId));
  const dispatchIds = new Set<string>(); const dispatchRequestIds = new Set<string>(); const dispatchedNoticeIds = new Set<string>();
  for (const dispatch of dispatches) {
    if (dispatchIds.has(dispatch.dunningDispatchId) || dispatchRequestIds.has(dispatch.clientRequestId) || dispatchedNoticeIds.has(dispatch.dunningNoticeId)) throw new Error('Versandhistorie enthält doppelte Ereignis-, Anforderungs- oder Mahnidentitäten.');
    dispatchIds.add(dispatch.dunningDispatchId); dispatchRequestIds.add(dispatch.clientRequestId); dispatchedNoticeIds.add(dispatch.dunningNoticeId);
    const notice = notices.find((candidate) => candidate.dunningNoticeId === dispatch.dunningNoticeId);
    if (!notice || dispatch.tenantId !== notice.tenantId || dispatch.clientId !== notice.clientId || dispatch.paymentReadAt <= notice.recordedAt || dispatch.paymentRevision !== notice.paymentRevision || dispatch.latestPaymentAt !== notice.latestPaymentAt || dispatch.remainingAmountCents !== notice.remainingAmountCents) throw new Error('Versand ist nicht exakt, mit unverändertem Zahlungsstand und zeitlich nachgelagert an den Mahnschritt gebunden.');
  }

  const lastNotice = notices.at(-1) ?? null;
  const paymentChangedSinceLastNotice = Boolean(lastNotice && (
    lastNotice.paidAmountCents !== openItem.paidAmountCents ||
    lastNotice.remainingAmountCents !== openItem.remainingAmountCents ||
    lastNotice.paymentRevision !== currentPaymentRevision ||
    lastNotice.latestPaymentAt !== latestPaymentEventAt
  ));
  let currentState: CareDunningStatus['currentState'];
  let nextStage: CareDunningStage | null = null;
  if (openItem.remainingAmountCents === 0) currentState = 'settled';
  else if (openItem.dueDate >= asOfDate) currentState = 'not_due';
  else if (notices.length >= stages.length) currentState = 'maximum_stage_reached';
  else if (lastNotice && asOfDate < lastNotice.nextReviewDate) currentState = 'awaiting_review_date';
  else { currentState = 'eligible'; nextStage = stages[notices.length]; }
  const lastNoticeDispatchState = !lastNotice ? 'none' : dispatchedNoticeIds.has(lastNotice.dunningNoticeId) ? 'dispatched' : 'not_dispatched';
  return Object.freeze({
    asOfDate, evaluatedAt, openItem, notices: Object.freeze(notices), dispatches: Object.freeze(dispatches),
    currentPaymentRevision, latestPaymentEventAt, paymentChangedSinceLastNotice, currentState, nextStage, lastNoticeDispatchState,
    feeState: 'not_inferred', interestState: 'not_inferred', debtEnforcementState: 'not_inferred', historyMode: 'append_only',
  });
}
