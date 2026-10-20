import { parseReceipt, ReceiptFormatError, normalizedAddress } from './receipt-parser.mjs';
import { classicReceiptKey } from './outbox.mjs';

/** Correlation is information, not proof of origin. Never calls finish/applyReceipt,
 * changes invoice state, releases a reservation or triggers a retransmission.
 */
export function classifyReceipt({ inbox, outbox, tenantId, id }) {
  const message = inbox.get(tenantId, id);
  if (!message) throw new Error('RECEIPT_NOT_FOUND');
  if (message.state !== 'received') return message.analysis;
  const quarantine = reason => inbox.classify(tenantId, id, { state: 'quarantined', authenticity: 'unverified', reason });
  let receipt;
  try { receipt = parseReceipt(message.bytes); }
  catch (error) { if (error instanceof ReceiptFormatError) return quarantine(error.message); throw error; }
  const classicKey = receipt.type === 'classic' ? classicReceiptKey(receipt) : undefined;
  const candidates = outbox.receiptCandidates(tenantId, { messageId: receipt.originalMessageId, envelopeId: receipt.envelopeId, classicKey });
  if (!candidates.length) return quarantine('RECEIPT_NO_MATCH');
  if (candidates.length !== 1) return quarantine('RECEIPT_AMBIGUOUS');
  const job = candidates[0], binding = job.binding;
  if ((receipt.originalMessageId && receipt.originalMessageId !== binding.messageId) || (receipt.envelopeId && receipt.envelopeId !== binding.envelopeId)
    || (classicKey && classicKey !== binding.classicKey)) return quarantine('RECEIPT_BINDING_CONFLICT');
  if (!['sending', 'sent', 'delivery_unknown'].includes(job.state)) return quarantine('RECEIPT_JOB_NOT_SENT');
  let outcome = receipt.outcome;
  if (receipt.type === 'dsn') {
    if (receipt.recipients.length !== 1) return quarantine('RECEIPT_RECIPIENT_COUNT');
    const recipient = receipt.recipients[0], to = normalizedAddress(binding.to);
    if (recipient.address !== to || (recipient.originalAddress && recipient.originalAddress !== to)) return quarantine('RECEIPT_RECIPIENT_CONFLICT');
    outcome = { delivered: 'transport_delivered', failed: 'transport_failed', delayed: 'transport_delayed', relayed: 'transport_relayed', expanded: 'transport_expanded' }[recipient.action];
  }
  return inbox.classify(tenantId, id, { state: 'classified', authenticity: 'unverified', reason: 'ORIGIN_VERIFICATION_REQUIRED',
    jobId: job.id, manifestSha256: binding.manifestSha256, receiptSha256: message.sha256, outcome, receipt });
}

/** Recovers durable but not yet classified messages, including crashes before POP3 QUIT. */
export function classifyPending({ inbox, outbox, tenantId, mailboxId, limit = 100 }) {
  return inbox.pending(tenantId, mailboxId, limit).map(id => ({ id, analysis: classifyReceipt({ inbox, outbox, tenantId, id }) }));
}
