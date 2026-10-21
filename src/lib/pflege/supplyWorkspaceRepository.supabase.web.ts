import { getSupabaseClient } from '@/lib/supabase/client';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import type { HandoverSdk } from './caseHandoverRepository.web';
import { createSupplyRepository } from './supplyWorkspaceRepository.web';
export const supplyRepository=createSupplyRepository({getSdk:()=>getSupabaseClient() as unknown as HandoverSdk|null,query:(request,operation)=>withServiceQueryTimeout(Promise.resolve(request),operation,20_000)});
