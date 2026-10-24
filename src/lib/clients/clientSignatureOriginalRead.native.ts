// Generated native presentation from src/lib/clients/clientSignatureOriginalRead.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { ServiceResult } from '@/types';
import { getSupabaseClient } from "../supabase/client.ts";
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { assertClientNativeScope, captureClientNativePage, cloneClientNativeOriginal, freezeClientNativeOriginal, type ClientNativeRow, } from "./clientRecordNativeOriginal.native.ts";
import { CLIENT_SIGNATURE_ORIGINAL_POOLS, captureClientSignatureOriginals, type ClientSignatureOriginalCollection, } from "./clientSignatureOriginals.native.ts";
export type ClientSignatureOriginalReadOptions = {
    canRead: boolean;
    canViewSensitive: boolean;
    /** Sync assertion bound by the caller to its current native Parentreceipt, Actor, Read/Sensitive, ticket and lifetime. */
    assertCurrentRead: () => void;
};
export type ClientSignatureOriginalReadReceipt = {
    state: 'not_requested';
    collection: null;
    selectors: Record<string, never>;
    queriedPools: [
    ];
} | {
    state: 'requested';
    collection: ClientSignatureOriginalCollection;
    selectors: Record<string, string>;
    queriedPools: string[];
};
/** Private SELECT-only receipt. Raw signature/HTML originals must never be attached to display DTOs, children or AI. */
export async function fetchClientSignatureOriginalReadWeb(tenantId: string, clientId: string, options: ClientSignatureOriginalReadOptions): Promise<ServiceResult<ClientSignatureOriginalReadReceipt>> {
    let closed = false;
    try {
        if (!options || Object.getPrototypeOf(options) !== Object.prototype)
            throw Error('Die aktuellen nativen Signatur-Lesegates fehlen.');
        const read = Object.getOwnPropertyDescriptor(options, 'assertCurrentRead');
        const view = Object.getOwnPropertyDescriptor(options, 'canRead');
        const sensitive = Object.getOwnPropertyDescriptor(options, 'canViewSensitive');
        if (!read || !('value' in read) || typeof read.value !== 'function'
            || !view || !('value' in view) || view.value !== true
            || !sensitive || !('value' in sensitive) || typeof sensitive.value !== 'boolean') {
            throw Error('Der aktuelle eigene Zugriff auf den nativen Signaturbestand ist nicht bestätigt.');
        }
        const scope = Object.freeze({ tenantId, clientId });
        assertClientNativeScope(scope);
        const current = () => {
            if (closed)
                throw Error('Dieser native Signaturabruf ist bereits beendet.');
            const result = read.value();
            if (result !== undefined) {
                if (result instanceof Promise)
                    void result.catch(() => { });
                throw Error('Der eigene native Signatur-Lesekontext ist nicht synchron bestätigt.');
            }
        };
        current();
        if (!sensitive.value) {
            const data = freezeClientNativeOriginal({ state: 'not_requested' as const, collection: null, selectors: {}, queriedPools: [] as [
                ] });
            current();
            closed = true;
            return { ok: true, data };
        }
        const sdk = getSupabaseClient();
        if (!sdk)
            throw Error('Der native Signaturbestand ist nicht verbunden.');
        const select = async (query: PromiseLike<unknown>): Promise<unknown> => {
            current();
            const raw = await withServiceQueryTimeout(new Promise<unknown>((resolve, reject) => {
                // Then-entry issues the native request now, without a Promise-assimilation microtask gap.
                current();
                query.then(resolve, reject);
            }), 'Native Signaturquelle');
            current();
            const result = cloneClientNativeOriginal(raw);
            current();
            if (!result || typeof result !== 'object' || Array.isArray(result) || !Object.hasOwn(result, 'error'))
                throw Error('Der native Signatur-Abfragestatus ist ungeklärt.');
            const response = result as Record<string, unknown>;
            if (response.error !== null) {
                if (!response.error || typeof response.error !== 'object' || Array.isArray(response.error))
                    throw Error('Der native Signatur-Abfragestatus ist ungeklärt.');
                throw Error(toGermanSupabaseError(response.error));
            }
            if (!Object.hasOwn(response, 'data'))
                throw Error('Der native Signaturbestand fehlt.');
            return response.data;
        };
        const poolRead = async (table: string) => {
            const rows: ClientNativeRow[] = [];
            let cursor: string | null = null;
            for (;;) {
                current();
                let query = fromUnknownTable(sdk, table).select('*').eq('tenant_id', tenantId).eq('client_id', clientId)
                    .order('id', { ascending: true }).limit(250);
                if (cursor !== null)
                    query = query.gt('id', cursor);
                const raw = await select(query);
                current();
                const page = captureClientNativePage(raw, scope, cursor);
                current();
                if (!page.length)
                    return rows;
                rows.push(...page);
                cursor = (page[page.length - 1].id as string).toLowerCase();
                // Server-capped short pages are not a complete pool. Only a real empty page finishes this query history.
            }
        };
        const documents = await poolRead(CLIENT_SIGNATURE_ORIGINAL_POOLS.documents);
        current();
        const signatures = await poolRead(CLIENT_SIGNATURE_ORIGINAL_POOLS.signatures);
        current();
        const collection = captureClientSignatureOriginals({ documents, signatures }, scope);
        current();
        const data = freezeClientNativeOriginal({
            state: 'requested' as const, collection,
            selectors: Object.fromEntries(Object.values(CLIENT_SIGNATURE_ORIGINAL_POOLS).map(table => [table, '*'])),
            queriedPools: Object.values(CLIENT_SIGNATURE_ORIGINAL_POOLS),
        });
        current();
        closed = true;
        return { ok: true, data };
    }
    catch (error) {
        closed = true;
        return { ok: false, error: error instanceof Error ? error.message : 'Die nativen Signaturoriginale konnten nicht bestätigt werden.' };
    }
}
