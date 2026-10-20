import { getSupabaseClient } from '@/lib/supabase/client';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import type { HandoverSdk } from './caseHandoverRepository.web';
import { createVisitExecutionRepository } from './visitExecutionWorkspaceRepository.web.ts';

export const visitExecutionRepository = createVisitExecutionRepository({ getSdk: () => getSupabaseClient() as unknown as HandoverSdk | null, query: (request, operation) => withServiceQueryTimeout(Promise.resolve(request), operation, 30_000) });
