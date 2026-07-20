import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

export type VisibilityAwarePollingOptions = {
  enabled?: boolean;
  intervalMs: number;
  onPoll: () => void;
  /** Run immediately when tab/app becomes visible. Default true. */
  pollOnVisible?: boolean;
};

function isDocumentHidden(): boolean {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return document.visibilityState === 'hidden';
  }
  return AppState.currentState !== 'active';
}

/**
 * PERF.1 — Polling that pauses when tab/app is hidden.
 * Prevents background thermal drain from setInterval loops.
 */
export function useVisibilityAwarePolling(options: VisibilityAwarePollingOptions): void {
  const { enabled = true, intervalMs, onPoll, pollOnVisible = true } = options;
  const onPollRef = useRef(onPoll);
  onPollRef.current = onPoll;

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        if (!isDocumentHidden()) {
          onPollRef.current();
        }
      }, intervalMs);
    };

    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (isDocumentHidden()) {
        stop();
      } else {
        if (pollOnVisible) onPollRef.current();
        start();
      }
    };

    if (!isDocumentHidden()) {
      start();
    }

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
      return () => {
        document.removeEventListener('visibilitychange', onVisibility);
        stop();
      };
    }

    const sub = AppState.addEventListener('change', onVisibility);
    return () => {
      sub.remove();
      stop();
    };
  }, [enabled, intervalMs, pollOnVisible]);
}

/** Non-hook scheduler for tests and channelManager integration. */
export function createVisibilityAwareInterval(
  callback: () => void,
  intervalMs: number,
): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;

  const tick = () => {
    if (!isDocumentHidden()) callback();
  };

  const start = () => {
    if (timer) return;
    timer = setInterval(tick, intervalMs);
  };

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const onVisibility = () => {
    if (isDocumentHidden()) stop();
    else {
      tick();
      start();
    }
  };

  if (!isDocumentHidden()) start();

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }

  const sub = AppState.addEventListener('change', onVisibility);
  return () => {
    sub?.remove?.();
    stop();
  };
}
