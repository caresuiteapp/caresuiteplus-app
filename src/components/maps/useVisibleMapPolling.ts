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
  const [appActive, setAppActive] = useState(
    () => Platform.OS !== 'web' || typeof document === 'undefined' || document.visibilityState === 'visible',
  );
  const onPollRef = useRef(onPoll);
  onPollRef.current = onPoll;

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const onVisibility = () => setAppActive(document.visibilityState === 'visible');
      document.addEventListener('visibilitychange', onVisibility);
      return () => document.removeEventListener('visibilitychange', onVisibility);
    }

    const sub = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
    });
    return () => sub.remove();
  }, []);

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

    const nativeActive = Platform.OS !== 'web' ? AppState.currentState === 'active' : true;

    if (isVisible && appActive && nativeActive) {
      timer = setInterval(() => onPollRef.current(), intervalMs);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [enabled, intervalMs, isVisible, appActive]);

  return { containerRef, isVisible };
}
