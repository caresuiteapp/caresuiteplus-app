import { useEffect, useRef, useState } from 'react';
import type { RealtimeHandler } from './channelManager';

type SubscribeFactory = (handler: RealtimeHandler) => () => void;

/**
 * React hook wrapper for deduped Supabase realtime subscriptions.
 * Pass `null` factory to disable.
 */
export function useSupabaseRealtime(
  subscribeFactory: SubscribeFactory | null,
  onEvent: () => void,
): { isConnected: boolean } {
  const [isConnected, setIsConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!subscribeFactory) {
      setIsConnected(false);
      return;
    }

    const unsubscribe = subscribeFactory(() => {
      onEventRef.current();
    });
    setIsConnected(true);

    return () => {
      unsubscribe();
      setIsConnected(false);
    };
  }, [subscribeFactory]);

  return { isConnected };
}
