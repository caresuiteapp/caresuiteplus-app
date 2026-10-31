// Generated native presentation from src/lib/pflege/nativeCarePlanSourceRepository.supabase.web.ts. Update through scripts/port-native-workspaces.mjs.
import { getSupabaseClient } from "../supabase/client.ts";
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import type { HandoverSdk } from "./caseHandoverRepository.native.ts";
import { createNativeCarePlanSourceRepository } from "./nativeCarePlanSourceRepository.native.ts";
export const nativeCarePlanSourceRepository = createNativeCarePlanSourceRepository({
    getSdk: () => getSupabaseClient() as unknown as HandoverSdk | null,
    query: (request, operation) => withServiceQueryTimeout(Promise.resolve(request), operation, 20000),
    readNative: (db, table, filters) => {
        let query = fromUnknownTable(db as unknown as NonNullable<ReturnType<typeof getSupabaseClient>>, table).select('*');
        for (const [key, value] of Object.entries(filters))
            query = query.eq(key, value);
        return query.maybeSingle();
    },
});
