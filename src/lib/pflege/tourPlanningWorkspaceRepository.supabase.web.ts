import { getSupabaseClient } from '@/lib/supabase/client';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import type { HandoverSdk } from './caseHandoverRepository.web.ts';
import { createTourPlanningRepository } from './tourPlanningWorkspaceRepository.web';

export const tourPlanningRepository = createTourPlanningRepository({
  getSdk: () => getSupabaseClient() as unknown as HandoverSdk | null,
  query: (request, operation) => withServiceQueryTimeout(Promise.resolve(request), operation, 20_000),
});
