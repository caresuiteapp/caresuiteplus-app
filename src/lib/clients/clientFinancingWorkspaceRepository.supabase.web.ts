import { getSupabaseClient } from '@/lib/supabase/client';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import type { HandoverSdk } from '@/lib/pflege/caseHandoverRepository.web';
import { createClientFinancingRepository } from './clientFinancingWorkspaceRepository.web';
export const clientFinancingRepository = createClientFinancingRepository({ getSdk: () => getSupabaseClient() as unknown as HandoverSdk | null, query: (request, operation) => withServiceQueryTimeout(Promise.resolve(request), operation, 20_000) });
