import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { readWoundCatalog, type WoundRecordUserScope } from '@/lib/pflege/woundRecordService';

export function useWoundCatalog(scope: WoundRecordUserScope, enabled = true) {
  const { tenantId, actorId, role } = scope;
  return useAsyncQuery(() => readWoundCatalog(scope), [tenantId, actorId, role], {
    enabled: enabled && !!tenantId && !!actorId && !!role,
    queryKey: [tenantId, actorId, role, 'wound-catalog'].join(':'),
  });
}
