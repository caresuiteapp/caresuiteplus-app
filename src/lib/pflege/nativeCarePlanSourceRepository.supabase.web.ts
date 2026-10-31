import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import type { HandoverSdk } from './caseHandoverRepository.web';
import { createNativeCarePlanSourceRepository } from './nativeCarePlanSourceRepository.web';

export const nativeCarePlanSourceRepository = createNativeCarePlanSourceRepository({
  getSdk: () => getSupabaseClient() as unknown as HandoverSdk | null,
  query: (request, operation) => withServiceQueryTimeout(Promise.resolve(request), operation, 20_000),
  readNative: (db, table, filters) => {
    let query = fromUnknownTable(db as unknown as NonNullable<ReturnType<typeof getSupabaseClient>>, table).select('*');
    for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
    return query.maybeSingle();
  },
});
