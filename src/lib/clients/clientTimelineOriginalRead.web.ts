import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import {
  assertClientNativeScope, captureClientNativeRoot, captureClientNativePage, freezeClientNativeOriginal,
  sameClientNativeOriginal, cloneClientNativeOriginal, type ClientNativeRow,
} from './clientRecordNativeOriginal.web.ts';
import {
  CLIENT_TIMELINE_ORIGINAL_POOLS, captureClientTimelineOriginals,
  type ClientTimelineOriginalCollection, type ClientTimelineOriginalKind,
} from './clientTimelineOriginals.web.ts';

export type ClientTimelineOriginalReadOptions = {
  canRead: boolean; canViewSensitive: boolean;
  /** Synchronous caller assertion: exact current native Parentreceipt/Actor/Read/Sensitive, ticket and mounted lifetime. */
  assertCurrentRead: () => void;
};
export type ClientTimelineOriginalReadReceipt = ClientTimelineOriginalCollection & {
  root: ClientNativeRow;
  selectors: Record<string, string>;
};

/** Private office Web metadata read. Full raw audit/document payload requires explicit supplied Sensitive read; no portal mode. */
export async function fetchClientTimelineOriginalReadWeb(
  tenantId: string, clientId: string, options: ClientTimelineOriginalReadOptions,
): Promise<ServiceResult<ClientTimelineOriginalReadReceipt>> {
  let closed = false;
  try {
    if (!options || Object.getPrototypeOf(options) !== Object.prototype) throw Error('Die aktuellen nativen Verlaufs-Lesegates fehlen.');
    const read = Object.getOwnPropertyDescriptor(options, 'assertCurrentRead');
    const view = Object.getOwnPropertyDescriptor(options, 'canRead');
    const sensitive = Object.getOwnPropertyDescriptor(options, 'canViewSensitive');
    if (!read || !('value' in read) || typeof read.value !== 'function'
      || !view || !('value' in view) || view.value !== true
      || !sensitive || !('value' in sensitive) || sensitive.value !== true) {
      throw Error('Der aktuelle Zugriff auf die unveränderten nativen Verlaufsmetadaten ist nicht bestätigt.');
    }
    const scope = Object.freeze({ tenantId, clientId });
    assertClientNativeScope(scope);
    const current = () => {
      if (closed) throw Error('Dieser native Verlaufsabruf ist bereits beendet.');
      const result = read.value();
      if (result !== undefined) {
        if (result instanceof Promise) void result.catch(() => {});
        throw Error('Der eigene native Verlaufs-Lesekontext ist nicht synchron bestätigt.');
      }
    };
    current();
    const sdk = getSupabaseClient();
    if (!sdk) throw Error('Die native Klientenakte ist nicht verbunden.');
    const select = async (query: PromiseLike<unknown>, label: string): Promise<unknown> => {
      current();
      const raw = await withServiceQueryTimeout(new Promise<unknown>((resolve, reject) => {
        // Native then-entry is the dispatch boundary; Promise.resolve(query) defers it to another microtask.
        current(); query.then(resolve, reject);
      }), label);
      current();
      const result = cloneClientNativeOriginal(raw);
      if (!result || typeof result !== 'object' || Array.isArray(result) || !Object.hasOwn(result, 'error')) throw Error('Der native Abfragestatus konnte nicht bestätigt werden.');
      const response = result as Record<string, unknown>;
      if (response.error !== null) {
        if (!response.error || typeof response.error !== 'object' || Array.isArray(response.error)) throw Error('Der native Abfragestatus konnte nicht bestätigt werden.');
        throw Error(toGermanSupabaseError(response.error));
      }
      if (!Object.hasOwn(response, 'data')) throw Error('Der native Abfragebestand fehlt.');
      return response.data;
    };
    const rootRead = async () => {
      current();
      const data = await select(fromUnknownTable(sdk, 'clients')
        .select('id,tenant_id').eq('tenant_id', tenantId).eq('id', clientId).single(), 'Klienten-Zuordnung');
      current();
      const row = captureClientNativeRoot(data, scope);
      if (Object.keys(row).some(key => key !== 'id' && key !== 'tenant_id')) throw Error('Nicht angeforderte Klientenfelder wurden im Verlaufsabruf geliefert.');
      return row;
    };
    const root = await rootRead();
    current();
    const poolRead = async (table: string) => {
      const rows: ClientNativeRow[] = [];
      let cursor: string | null = null;
      try {
        for (;;) {
          current();
          let query = fromUnknownTable(sdk, table).select('*').eq('tenant_id', tenantId).eq('client_id', clientId)
            .order('id', { ascending: true }).limit(250);
          if (cursor !== null) query = query.gt('id', cursor);
          const data = await select(query, 'Native Verlaufsquelle');
          current();
          const page = captureClientNativePage(data, scope, cursor);
          if (!page.length) return rows;
          rows.push(...page);
          cursor = (page[page.length - 1].id as string).toLowerCase();
        }
      } catch (error) { closed = true; throw error; }
    };
    const kinds = Object.keys(CLIENT_TIMELINE_ORIGINAL_POOLS) as ClientTimelineOriginalKind[];
    const pages = await Promise.all(kinds.map(kind => poolRead(CLIENT_TIMELINE_ORIGINAL_POOLS[kind])));
    current();
    const rootAfter = await rootRead();
    current();
    if (!sameClientNativeOriginal(root, rootAfter)) throw Error('Die native Klienten-Zuordnung hat sich während des Verlaufsabrufs geändert.');
    const collection = captureClientTimelineOriginals(Object.fromEntries(kinds.map((kind, index) => [kind, pages[index]])), scope);
    current();
    const data = freezeClientNativeOriginal({
      ...collection, root, selectors: { clients: 'id,tenant_id', ...Object.fromEntries(kinds.map(kind => [CLIENT_TIMELINE_ORIGINAL_POOLS[kind], '*'])) },
    });
    current();
    closed = true;
    return { ok: true, data };
  } catch (error) {
    closed = true;
    return { ok: false, error: error instanceof Error ? error.message : 'Die nativen Verlaufsoriginale konnten nicht bestätigt werden.' };
  }
}
