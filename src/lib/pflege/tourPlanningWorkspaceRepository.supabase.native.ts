// Generated native presentation from src/lib/pflege/tourPlanningWorkspaceRepository.supabase.web.ts. Update through scripts/port-native-workspaces.mjs.
import { getSupabaseClient } from "../supabase/client.ts";
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import type { HandoverSdk } from "./caseHandoverRepository.native.ts";
import { createTourPlanningRepository } from "./tourPlanningWorkspaceRepository.native.ts";
export const tourPlanningRepository = createTourPlanningRepository({
    getSdk: () => getSupabaseClient() as unknown as HandoverSdk | null,
    query: (request, operation) => withServiceQueryTimeout(Promise.resolve(request), operation, 20000),
});
