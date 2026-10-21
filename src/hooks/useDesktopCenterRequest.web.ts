import { useEffect, useRef } from 'react';

/** Consume an explicit Apps request once, after the authenticated desktop is ready. */
export function useDesktopCenterRequest({
  requestedTab, ready, onOpen, onConsumed,
}: {
  requestedTab: string | string[] | undefined;
  ready: boolean;
  onOpen: () => void;
  onConsumed: () => void;
}) {
  const consumed = useRef(false);
  useEffect(() => {
    if (requestedTab !== 'apps') {
      consumed.current = false;
      return;
    }
    if (!ready || consumed.current) return;
    consumed.current = true;
    onOpen();
    onConsumed();
  }, [requestedTab, ready, onOpen, onConsumed]);
}
