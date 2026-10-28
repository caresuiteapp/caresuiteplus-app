// Generated native presentation from src/lib/clients/clientPhysicianCommunicationOriginalRead.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { ServiceResult } from '@/types';
import { getSupabaseClient } from "../supabase/client.ts";
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { assertClientNativeScope, captureClientNativePage, cloneClientNativeOriginal, freezeClientNativeOriginal, sameClientNativeOriginal, type ClientNativeRow, } from "./clientRecordNativeOriginal.native.ts";
import { CLIENT_PHYSICIAN_COMMUNICATION_POOLS, captureClientCommunicationThreadPageWeb, captureClientPhysicianCommunicationOriginalsWeb, type ClientPhysicianCommunicationOriginalsWeb, } from "./clientPhysicianCommunicationOriginals.native.ts";
export type ClientPhysicianCommunicationOriginalReadOptionsWeb = Readonly<{
    canRead: true;
    canViewSensitive: true;
    canViewCommunicationCenter: true;
    assertCurrentRead: () => void;
}>;
export type ClientPhysicianCommunicationOriginalReadReceiptWeb = Readonly<{
    state: 'requested';
    collection: ClientPhysicianCommunicationOriginalsWeb;
    selectors: Readonly<Record<string, '*'>>;
    queriedPools: readonly string[];
    snapshot: 'non_atomic_delivered_pools';
}>;
/** SELECT-only client communication read. It never interprets a reply, participant or document as a signed order. */
export async function fetchClientPhysicianCommunicationOriginalReadWeb(tenantId: string, clientId: string, options: ClientPhysicianCommunicationOriginalReadOptionsWeb): Promise<ServiceResult<ClientPhysicianCommunicationOriginalReadReceiptWeb>> {
    let closed = false;
    try {
        if (!options || Object.getPrototypeOf(options) !== Object.prototype)
            throw Error('Die aktuellen Lesegates für die Arztkommunikation fehlen.');
        const read = Object.getOwnPropertyDescriptor(options, 'assertCurrentRead');
        for (const key of ['canRead', 'canViewSensitive', 'canViewCommunicationCenter'] as const) {
            const descriptor = Object.getOwnPropertyDescriptor(options, key);
            if (!descriptor || !('value' in descriptor) || descriptor.value !== true) {
                throw Error('Der aktuelle eigene Zugriff auf sensible Kommunikationsoriginale ist nicht bestätigt.');
            }
        }
        if (!read || !('value' in read) || typeof read.value !== 'function')
            throw Error('Der aktuelle eigene Kommunikations-Lesekontext fehlt.');
        const scope = Object.freeze({ tenantId, clientId });
        assertClientNativeScope(scope);
        const current = () => {
            if (closed)
                throw Error('Dieser native Kommunikationsabruf ist bereits beendet.');
            const result = read.value();
            if (result !== undefined) {
                if (result instanceof Promise)
                    void result.catch(() => { });
                throw Error('Der eigene Kommunikations-Lesekontext ist nicht synchron bestätigt.');
            }
        };
        current();
        const sdk = getSupabaseClient();
        if (!sdk)
            throw Error('Der native Kommunikationsbestand ist nicht verbunden.');
        const select = async (query: PromiseLike<unknown>): Promise<unknown> => {
            current();
            const raw = await withServiceQueryTimeout(new Promise<unknown>((resolve, reject) => {
                current();
                query.then(resolve, reject);
            }), 'Native Arztkommunikation');
            current();
            const result = cloneClientNativeOriginal(raw);
            if (!result || typeof result !== 'object' || Array.isArray(result) || !Object.hasOwn(result, 'error')) {
                throw Error('Der native Kommunikations-Abfragestatus ist ungeklärt.');
            }
            const response = result as Record<string, unknown>;
            if (response.error !== null) {
                if (!response.error || typeof response.error !== 'object' || Array.isArray(response.error))
                    throw Error('Der native Kommunikations-Abfragestatus ist ungeklärt.');
                throw Error(toGermanSupabaseError(response.error));
            }
            if (!Object.hasOwn(response, 'data'))
                throw Error('Der native Kommunikationsbestand fehlt.');
            return response.data;
        };
        const threadRead = async (): Promise<ClientNativeRow[]> => {
            const rows: ClientNativeRow[] = [];
            let cursor: string | null = null;
            for (;;) {
                current();
                let query = fromUnknownTable(sdk, CLIENT_PHYSICIAN_COMMUNICATION_POOLS.threads).select('*')
                    .eq('tenant_id', tenantId).eq('client_id', clientId).order('id', { ascending: true }).limit(250);
                if (cursor !== null)
                    query = query.gt('id', cursor);
                const page = captureClientNativePage(await select(query), scope, cursor);
                current();
                if (!page.length)
                    return rows;
                rows.push(...page);
                cursor = page[page.length - 1].id as string;
            }
        };
        const childRead = async (table: string, threadId: string, requireClientId = false): Promise<ClientNativeRow[]> => {
            const rows: ClientNativeRow[] = [];
            let cursor: string | null = null;
            for (;;) {
                current();
                let query = fromUnknownTable(sdk, table).select('*').eq('tenant_id', tenantId).eq('thread_id', threadId);
                if (requireClientId)
                    query = query.eq('client_id', clientId);
                query = query.order('id', { ascending: true }).limit(250);
                if (cursor !== null)
                    query = query.gt('id', cursor);
                const page = captureClientCommunicationThreadPageWeb(await select(query), scope, threadId, cursor, requireClientId);
                current();
                if (!page.length)
                    return rows;
                rows.push(...page);
                cursor = page[page.length - 1].id as string;
            }
        };
        const threads = await threadRead();
        const histories = [];
        for (const thread of threads) {
            current();
            const threadId = thread.id as string;
            const [messages, participants, attachments, assignments, readReceipts, auditEvents] = await Promise.all([
                childRead(CLIENT_PHYSICIAN_COMMUNICATION_POOLS.messages, threadId),
                childRead(CLIENT_PHYSICIAN_COMMUNICATION_POOLS.participants, threadId),
                childRead(CLIENT_PHYSICIAN_COMMUNICATION_POOLS.attachments, threadId),
                childRead(CLIENT_PHYSICIAN_COMMUNICATION_POOLS.assignments, threadId),
                childRead(CLIENT_PHYSICIAN_COMMUNICATION_POOLS.readReceipts, threadId),
                childRead(CLIENT_PHYSICIAN_COMMUNICATION_POOLS.auditEvents, threadId, true),
            ]);
            current();
            histories.push({ thread, messages, participants, attachments, assignments, readReceipts, auditEvents });
        }
        const threadsAfter = await threadRead();
        current();
        if (!sameClientNativeOriginal(threads, threadsAfter))
            throw Error('Der native Threadbestand hat sich während des Kommunikationsabrufs geändert. Bitte erneut laden.');
        const collection = captureClientPhysicianCommunicationOriginalsWeb({ threads, histories }, scope);
        current();
        const queriedPools = Object.values(CLIENT_PHYSICIAN_COMMUNICATION_POOLS);
        const receipt = freezeClientNativeOriginal({
            state: 'requested' as const,
            collection,
            selectors: Object.fromEntries(queriedPools.map(table => [table, '*' as const])),
            queriedPools,
            snapshot: 'non_atomic_delivered_pools' as const,
        });
        current();
        closed = true;
        return { ok: true, data: receipt };
    }
    catch (error) {
        closed = true;
        return { ok: false, error: error instanceof Error ? error.message : 'Die nativen Kommunikationsoriginale konnten nicht bestätigt werden.' };
    }
}
