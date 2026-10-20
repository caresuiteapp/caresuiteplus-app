import { dispatchOnce } from '../../api/_lib/gkv-transport.ts';
import { billingDay, GKV_SPEC } from '../../src/lib/gkvExchange/model.ts';
import { classicSmtpProvider } from './classic-provider.mjs';

/** A single bounded worker cycle. Routes and the outbox are trusted server configuration.
 * The caller must already have authorized/reserved the canonical invoices before enqueue.
 * No timers, retries, lease expiry, KIM fallback to ordinary SMTP, or browser configuration.
 */
export async function dispatchPending({ outbox, tenantId, routes, limit = 20, now = () => new Date() }) {
  if (!Array.isArray(routes) || routes.length > 1000 || new Set(routes.map(r => `${r.id}:${r.version}`)).size !== routes.length) throw new Error('WORKER_ROUTES');
  const result = [];
  for (const id of outbox.pending(tenantId, limit)) {
    const job = outbox.read(tenantId, id), time = now(), day = billingDay(time);
    if (job.state !== 'queued') { result.push({ id, state: 'already_claimed' }); continue; }
    if (!day || day !== job.delivery.preparedDay || day < GKV_SPEC.validFrom || day > GKV_SPEC.validUntil) {
      result.push({ id, state: 'blocked', reason: 'CURRENT_RELEASE_REQUIRED' }); continue;
    }
    if (job.delivery.channel !== 'classic') { result.push({ id, state: 'blocked', reason: 'KIM_CLIENT_REQUIRED' }); continue; }
    const prior = outbox.dispatchBinding(tenantId, id);
    const matches = routes.filter(r => r.enabled === true && r.tenantId === tenantId && r.senderIk === job.delivery.senderIk && r.receiverIk === job.delivery.receiverIk
      && (!prior || (r.id === prior.routeId && r.version === prior.routeVersion)));
    if (matches.length !== 1) { result.push({ id, state: 'blocked', reason: matches.length ? 'ROUTE_AMBIGUOUS' : 'ROUTE_UNAVAILABLE' }); continue; }
    const route = matches[0]; let binding, provider;
    try {
      binding = outbox.bindDispatch(tenantId, id, { routeId: route.id, routeVersion: route.version, from: route.from, to: route.to, dsn: route.dsn ?? false, createdAt: time.toISOString() });
      provider = classicSmtpProvider({ ...route, binding });
    } catch {
      result.push({ id, state: 'blocked', reason: 'DISPATCH_BINDING_REJECTED' }); continue;
    }
    // A persistence failure is deliberately fatal to the cycle: no second send and no false success.
    result.push({ id, state: await dispatchOnce(id, job.delivery, outbox.journal(tenantId), provider, time) });
  }
  return result;
}
