// Generated native presentation from src/lib/pflege/supplyWorkspaceRepository.supabase.web.ts. Update through scripts/port-native-workspaces.mjs.
import { getSupabaseClient } from "../supabase/client.ts";
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import type { HandoverSdk } from "./caseHandoverRepository.native.ts";
import { createSupplyRepository } from "./supplyWorkspaceRepository.native.ts";
export const supplyRepository = createSupplyRepository({ getSdk: () => getSupabaseClient() as unknown as HandoverSdk | null, query: (request, operation) => withServiceQueryTimeout(Promise.resolve(request), operation, 20000) });
