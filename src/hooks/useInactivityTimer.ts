import { useCallback, useEffect, useRef } from 'react';

type UseInactivityTimerOptions = {
  enabled: boolean;
  timeoutMs: number;
  visible: boolean;
  onTimeout: () => void;
};

export function useInactivityTimer({
  enabled,
  timeoutMs,
  visible,
  onTimeout,
}: UseInactivityTimerOptions) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    clearTimer();
    if (!enabled || visible) return;
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      onTimeoutRef.current();
    }, timeoutMs);
  }, [clearTimer, enabled, timeoutMs, visible]);

  useEffect(() => {
    if (!enabled || visible) {
      clearTimer();
      return;
    }
    resetTimer();
    return clearTimer;
  }, [enabled, timeoutMs, visible, clearTimer, resetTimer]);

  return { resetTimer, clearTimer };
}
