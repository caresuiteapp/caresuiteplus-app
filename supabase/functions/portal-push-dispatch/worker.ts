export type PushWork = { id: string; lease_token: string; event_kind: string; expires_at: string };
export type PushTarget = { expo_push_token: string; route: string; account_id: string; tenant_id: string };
export type ReceiptWork = { id: string; expo_ticket_id: string; updated_at: string };
export type ExpoResult = { status: 'ok' | 'error'; id?: string; details?: { error?: string } };
export type DeliveryOutcome = 'accepted' | 'retry' | 'failed' | 'cancelled';
export interface PushQueue {
  claim(): Promise<PushWork[]>;
  target(work: PushWork): Promise<PushTarget | null>;
  finish(work: PushWork, outcome: DeliveryOutcome, ticket: string | null, error: string | null): Promise<void>;
  receipts(): Promise<ReceiptWork[]>;
  receipt(work: ReceiptWork, status: 'ok' | 'error', error: string | null): Promise<void>;
}
export interface PushTransport {
  send(messages: Record<string, unknown>[]): Promise<ExpoResult[]>;
  receipts(ids: string[]): Promise<Record<string, ExpoResult>>;
}
const TITLES: Record<string, string> = { visit: 'Ihr Einsatzplan wurde aktualisiert', message: 'Neue CareSuite-Nachricht', proof: 'Ein Leistungsnachweis ist verfügbar', proof_signed: 'Eine Unterschrift ist eingegangen', document: 'Ein Dokument wartet auf Sie', notice: 'Neue CareSuite-Mitteilung', update: 'CareSuite-Update verfügbar' };
export function notificationFor(work: PushWork, target: PushTarget, now = Date.now()): Record<string, unknown> {
  return { to: target.expo_push_token, title: TITLES[work.event_kind] ?? 'Neue CareSuite-Mitteilung', body: 'Öffnen Sie CareSuite, um die Informationen in Ihrem Portal anzusehen.', sound: 'default', channelId: 'caresuite-important', priority: 'high', ttl: Math.max(0, Math.min(86400, Math.floor((Date.parse(work.expires_at) - now) / 1000))),
    data: { notificationId: work.id, route: target.route, accountId: target.account_id, tenantId: target.tenant_id } };
}
export async function processPortalPush(queue: PushQueue, transport: PushTransport, now = Date.now()) {
  const summary = { accepted: 0, retry: 0, failed: 0, cancelled: 0, receipts: 0 };
  const pendingReceipts = await queue.receipts();
  if (pendingReceipts.length) {
    try {
      const receipts = await transport.receipts(pendingReceipts.map(item => item.expo_ticket_id));
      for (const item of pendingReceipts) {
        const receipt = receipts[item.expo_ticket_id];
        if (receipt?.status) { await queue.receipt(item, receipt.status, receipt.details?.error ?? null); summary.receipts++; }
        else if (now - Date.parse(item.updated_at) > 23 * 3600_000) await queue.receipt(item, 'error', 'ReceiptUnavailable');
      }
    } catch { /* Accepted tickets are never resent because receipt lookup failed. */ }
  }
  const work = await queue.claim();
  const ready: { work: PushWork; target: PushTarget }[] = [];
  for (const item of work) {
    try {
      const target = await queue.target(item);
      if (!target || !(Date.parse(item.expires_at) > now)) { await queue.finish(item, 'cancelled', null, 'no_longer_accessible'); summary.cancelled++; }
      else ready.push({ work: item, target });
    } catch { await queue.finish(item, 'retry', null, 'target_check_failed'); summary.retry++; }
  }
  if (!ready.length) return summary;
  let tickets: ExpoResult[];
  try { tickets = await transport.send(ready.map(({work,target}) => notificationFor(work,target,now))); }
  catch { for (const { work: item } of ready) { await queue.finish(item,'retry',null,'transport_unavailable'); summary.retry++; } return summary; }
  for (let i=0; i<ready.length; i++) {
    const item=ready[i].work; const result=tickets[i];
    if (result?.status === 'ok' && result.id) { await queue.finish(item,'accepted',result.id,null); summary.accepted++; continue; }
    const error=result?.details?.error ?? 'MissingTicket';
    const outcome: DeliveryOutcome = ['DeviceNotRegistered','MessageTooBig','InvalidCredentials','MismatchSenderId'].includes(error) ? 'failed' : 'retry';
    await queue.finish(item,outcome,null,error); summary[outcome]++;
  }
  return summary;
}
