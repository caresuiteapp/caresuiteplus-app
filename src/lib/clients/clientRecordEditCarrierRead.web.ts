import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { getServiceMode } from '@/lib/services/mode';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { ClientRecordEditController, type ClientEditReadLease } from './clientRecordEditController.web';
import { cloneClientNativeOriginal, freezeClientNativeOriginal } from './clientRecordNativeOriginal.web';
import { CLIENT_EDIT_CARRIER_POOLS, captureClientEditCarrierOriginals, captureClientEditCarrierPage, type ClientEditCarrierOriginals, type ClientEditCarrierPool } from './clientRecordEditCarrierOriginal.web';

export type ClientEditCarrierRead = Readonly<{
  originals: ClientEditCarrierOriginals;
  selectors: Readonly<Record<string, '*'> >;
  /** These three delivered full pools only; neither an atomic snapshot nor a write capability. */
  queriedPools: readonly string[];
}>;
type Entry = { controller: ClientRecordEditController; lease: ClientEditReadLease; valid: boolean; finished: boolean; db: unknown | null };
const generations = new WeakMap<ClientRecordEditController, Entry>();
const minted = new WeakMap<ClientEditCarrierRead, Entry>();
const denied = () => Error('Der aktuelle eigene vollständige Kostenträger-Lesestand ist nicht bestätigt.');
// Negative own provenance only. No controller method, permission callback or
// pending-state check here: the owning reader/controller can safely consult it.
function runtime(entry: Entry): void {
  try {
    if (!entry.valid || generations.get(entry.controller) !== entry
      || !(entry.controller instanceof ClientRecordEditController)
      || getServiceMode() !== 'supabase'
      || entry.db !== null && getSupabaseClient() !== entry.db
      || getServiceMode() !== 'supabase') throw denied();
  } catch (error) { entry.valid = false; throw error; }
}
function current(entry: Entry): void {
  try {
    runtime(entry); entry.controller.assertRead(entry.lease); runtime(entry);
    const status = entry.controller.status();
    if (entry.lease.original.scope.canSensitive !== true || status.pending || status.uncertainOwners !== 0) throw denied();
    entry.controller.assertRead(entry.lease); runtime(entry);
  } catch (error) { entry.valid = false; throw error; }
}
/** Exact minted generation/runtime only; neither current read rights nor a write grant. */
export function recognizesClientEditCarrierRuntime(controller: ClientRecordEditController, lease: ClientEditReadLease, result: ClientEditCarrierRead): boolean {
  const entry = minted.get(result);
  if (!entry || entry.controller !== controller || entry.lease !== lease || !entry.finished || entry.db === null) return false;
  try { runtime(entry); return true; } catch { return false; }
}
/** Permanently close on observed denial. A matching later grant never revives this receipt. */
export function assertClientEditCarrierRead(controller: ClientRecordEditController, lease: ClientEditReadLease, result: ClientEditCarrierRead): void {
  const entry = minted.get(result); if (!entry || entry.controller !== controller || entry.lease !== lease || !entry.finished) throw denied(); current(entry);
}
export function isOwnClientEditCarrierRead(controller: ClientRecordEditController, lease: ClientEditReadLease, result: ClientEditCarrierRead): boolean {
  try { assertClientEditCarrierRead(controller, lease, result); return true; } catch { return false; }
}
/** SELECT-only separate own lease receipt. Does not deliver new form fields, begin a save or call any write service. */
export async function fetchClientEditCarrierReadWeb(controller: ClientRecordEditController, lease: ClientEditReadLease): Promise<ServiceResult<ClientEditCarrierRead>> {
  const entry: Entry = { controller, lease, valid: true, finished: false, db: null };
  try {
    if (!(controller instanceof ClientRecordEditController)) throw denied();
    const previous = generations.get(controller); if (previous) previous.valid = false;
    generations.set(controller, entry); current(entry);
    if (getServiceMode() !== 'supabase') throw denied();
    const db = getSupabaseClient(); if (!db) throw denied(); entry.db = db; current(entry);
    const scope = Object.freeze({ tenantId: lease.original.scope.tenantId, clientId: lease.original.scope.clientId });
    const pools = {} as Record<ClientEditCarrierPool, unknown[]>;
    for (const pool of Object.keys(CLIENT_EDIT_CARRIER_POOLS) as ClientEditCarrierPool[]) {
      const table = CLIENT_EDIT_CARRIER_POOLS[pool], rows: unknown[] = [];
      // Override has no native client_id column. Only explicit IDs in this own
      // complete assignment history bind an override read to the care case.
      const targets: (string | null)[] = pool === 'overrides'
        ? [...new Map((pools.assignments as Record<string, unknown>[]).filter(row => row.tenant_override_id !== null)
          .map(row => [String(row.tenant_override_id).toLowerCase(), String(row.tenant_override_id)])).values()].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
        : [null];
      for (const target of targets) {
        let cursor: string | null = null;
        for (;;) {
          current(entry);
          let query = fromUnknownTable(db, table).select('*');
          if (pool !== 'templates') query = query.eq('tenant_id', scope.tenantId);
          if (pool === 'assignments') query = query.eq('client_id', scope.clientId);
          if (target !== null) query = query.eq('id', target);
          query = query.order('id', { ascending: true }).limit(200); if (cursor !== null) query = query.gt('id', cursor);
          const raw = await withServiceQueryTimeout(new Promise<unknown>((resolve, reject) => {
            try { const then = query?.then; current(entry); if (typeof then !== 'function') throw denied(); then.call(query, resolve, reject); }
            catch (error) { reject(error); }
          }));
          current(entry); const response = cloneClientNativeOriginal(raw); current(entry);
          if (!response || typeof response !== 'object' || Array.isArray(response)
            || !Object.hasOwn(response, 'error') || (response as Record<string, unknown>).error !== null
            || !Object.hasOwn(response, 'data')) throw denied();
          const page = captureClientEditCarrierPage((response as Record<string, unknown>).data, pool, scope, cursor); current(entry);
          if (target !== null && page.some(row => String(row.id).toLowerCase() !== target.toLowerCase())) throw denied();
          if (!page.length) break;
          rows.push(...page); cursor = String(page[page.length - 1].id).toLowerCase();
        }
      }
      pools[pool] = rows;
    }
    const originals = captureClientEditCarrierOriginals(pools, scope); current(entry);
    const queriedPools = Object.values(CLIENT_EDIT_CARRIER_POOLS).filter(table => table !== CLIENT_EDIT_CARRIER_POOLS.overrides
      || (pools.assignments as Record<string, unknown>[]).some(row => row.tenant_override_id !== null));
    const result = freezeClientNativeOriginal({ originals, selectors: Object.fromEntries(queriedPools.map(table => [table, '*' as const])), queriedPools });
    current(entry); entry.finished = true; minted.set(result, entry);
    return { ok: true, data: result };
  } catch (error) {
    entry.valid = false;
    return { ok: false, error: error instanceof Error ? error.message : 'Der native Kostenträgerbestand ist ungeklärt.' };
  }
}
