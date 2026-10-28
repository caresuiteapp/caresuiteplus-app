// Generated native presentation from src/lib/clients/clientFinancingWorkspaceRepository.supabase.web.ts. Update through scripts/port-native-workspaces.mjs.
import { getSupabaseClient } from "../supabase/client.ts";
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import type { HandoverSdk } from "../pflege/caseHandoverRepository.native.ts";
import { createClientFinancingRepository } from "./clientFinancingWorkspaceRepository.native.ts";
export const clientFinancingRepository = createClientFinancingRepository({ getSdk: () => getSupabaseClient() as unknown as HandoverSdk | null, query: (request, operation) => withServiceQueryTimeout(Promise.resolve(request), operation, 20000) });
