import type { RealtimeHandler } from '@/lib/realtime';

export type LiveRefreshQueryConfig = {
  enabled?: boolean;
  tenantId?: string | null;
  subscribe?: (tenantId: string, handler: RealtimeHandler) => () => void;
  pollMs?: number;
  refreshOnFocus?: boolean;
};
