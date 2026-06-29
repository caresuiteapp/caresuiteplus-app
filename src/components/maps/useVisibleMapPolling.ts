import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

export type VisibleMapPollingOptions = {
  enabled?: boolean;
  intervalMs: number;
  onPoll: () => void;
};

/**
 * PERF.1 — Poll map-related data only while map container is visible in viewport.
 */
export function useVisibleMapPolling(options: VisibleMapPollingOptions): {
  containerRef: React.RefObject<HTMLDivElement | null>;
  isVisible: boolean;
} {
  const { enabled = true, intervalMs, onPoll } = options;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const onPollRef = useRef(onPoll);
  onPollRef.current = onPoll;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof IntersectionObserver === 'undefined') return;

    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry?.isIntersecting ?? true),
      { root: null, threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const docVisible =
      Platform.OS !== 'web' ||
      typeof document === 'undefined' ||
      document.visibilityState === 'visible';
    const appActive = AppState.currentState === 'active';

    if (isVisible && docVisible && appActive) {
      timer = setInterval(() => onPollRef.current(), intervalMs);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [enabled, intervalMs, isVisible]);

  return { containerRef, isVisible };
}
