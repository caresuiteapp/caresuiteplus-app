import { getSupabaseClient } from '@/lib/supabase/client';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { createCaseHandoverRepository, type HandoverSdk } from './caseHandoverRepository.web';

export const caseHandoverRepository = createCaseHandoverRepository({
  getSdk: () => getSupabaseClient() as unknown as HandoverSdk | null,
  query: (request, operation) => withServiceQueryTimeout(Promise.resolve(request), operation, 20_000),
});
