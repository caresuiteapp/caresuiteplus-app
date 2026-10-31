// Generated native presentation from src/lib/clients/clientLifecycleWorkspaceRepository.supabase.web.ts. Update through scripts/port-native-workspaces.mjs.
import { getSupabaseClient } from "../supabase/client.ts";
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import type { HandoverSdk } from "../pflege/caseHandoverRepository.native.ts";
import { createClientLifecycleRepository } from "./clientLifecycleWorkspaceRepository.native.ts";
export const clientLifecycleWorkspaceRepository = createClientLifecycleRepository({ getSdk: () => getSupabaseClient() as unknown as HandoverSdk | null, query: (request, operation) => withServiceQueryTimeout(Promise.resolve(request), operation, 20000) });
