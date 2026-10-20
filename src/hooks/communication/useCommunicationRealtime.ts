import { useEffect, useState } from 'react';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  subscribeToThread,
  subscribeToThreadList,
  type RealtimeEvent,
} from '@/features/communication/communication.realtime';

export function useCommunicationRealtime(threadId?: string, onEvent?: (event: RealtimeEvent) => void) {
  const tenantId = useServiceTenantId();
  const [isConnected, setIsConnected] = useState(false);
  const demoMode = !process.env.EXPO_PUBLIC_SUPABASE_URL;

  useEffect(() => {
    if (!tenantId) return;

    const handler = (event: RealtimeEvent) => {
      onEvent?.(event);
    };

    const unsubList = subscribeToThreadList(tenantId, handler);
    const unsubThread = threadId ? subscribeToThread(tenantId, threadId, handler) : () => {};
    setIsConnected(true);

    return () => {
      unsubList();
      unsubThread();
      setIsConnected(false);
    };
  }, [tenantId, threadId, onEvent]);

  return { isConnected, demoMode, isRealtimeConnected: isConnected };
}
