// Generated native presentation from src/hooks/useProofReviewWorkspace.web.ts. Update through scripts/port-native-workspaces.mjs.
import { useMemo } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core';
import { useLiveRefresh } from '@/hooks/core/useLiveRefresh';
import { loadProofReviewDataset } from "../lib/assist/proofReviewService.native.ts";
import { buildReviewEntries } from "../lib/assist/proofReviewModel.native.ts";
export function useProofReviewWorkspace(enabled: boolean) {
    const { profile } = useAuth();
    const tenantId = useServiceTenantId();
    const query = useAsyncQuery(() => loadProofReviewDataset(tenantId!), [tenantId, profile?.id], { enabled: enabled && Boolean(tenantId), queryKey: `proof-review:${tenantId}:${profile?.id}:${enabled}` });
    useLiveRefresh({ enabled: enabled && Boolean(tenantId), onRefresh: query.silentRefresh, pollMs: 30000 });
    const entries = useMemo(() => query.data ? buildReviewEntries(query.data) : [], [query.data]);
    return { ...query, entries, profile, tenantId };
}
