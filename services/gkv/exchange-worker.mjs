import { dispatchPending } from './dispatch-worker.mjs';
import { pollMailbox } from './pop3-client.mjs';
import { classifyReceipt, classifyPending } from './receipt-worker.mjs';
import { isUuid } from './storage.mjs';

/** One bounded cycle of the own service. Scheduling, secret retrieval and durable volumes
 * belong to its host process. This module does not expose an API or enqueue office invoices.
 * Mailbox TLS/credentials authenticate the mailbox connection, not the origin of its contents.
 */
export async function runExchangeCycle({ outbox, inbox, tenantId, routes, mailboxes, limit = 20, now = () => new Date() }) {
  if (!isUuid(tenantId) || !Array.isArray(mailboxes) || mailboxes.length > 100 || mailboxes.some(m => !isUuid(m.id) || m.tenantId !== tenantId)
    || new Set(mailboxes.map(m => m.id)).size !== mailboxes.length) throw new Error('WORKER_MAILBOXES');
  const dispatch = await dispatchPending({ outbox, tenantId, routes, limit, now }), received = [];
  for (const mailbox of mailboxes) {
    const recovered = classifyPending({ inbox, outbox, tenantId, mailboxId: mailbox.id, limit });
    let quarantined = recovered.filter(r => r.analysis.state === 'quarantined').length;
    try {
      const result = await pollMailbox({ inbox, tenantId, mailboxId: mailbox.id, config: mailbox.config, limit,
        onStored: id => { if (classifyReceipt({ inbox, outbox, tenantId, id }).state === 'quarantined') quarantined++; } });
      received.push({ id: mailbox.id, state: 'received', ...result, recovered: recovered.length, quarantined });
    } catch (error) {
      // In particular, a failed QUIT never says "deleted". Stored originals stay recoverable.
      received.push({ id: mailbox.id, state: 'unavailable', reason: /^(?:POP3|INBOX|STORE|RECEIPT)_[A-Z_]+$/.test(error?.message ?? '') ? error.message : 'RECEIVE_FAILED',
        recovered: recovered.length, quarantined });
    }
  }
  return { dispatch, received };
}
