import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

const THROTTLE_MS = 250;
const THROTTLED_EVENTS = new Set(['mousemove', 'pointermove']);

type UseScreensaverActivityEventsOptions = {
  enabled: boolean;
  onActivity: () => void;
};

export function useScreensaverActivityEvents({
  enabled,
  onActivity,
}: UseScreensaverActivityEventsOptions) {
  const onActivityRef = useRef(onActivity);
  onActivityRef.current = onActivity;
  const lastThrottleRef = useRef(0);

  useEffect(() => {
    if (!enabled) return undefined;

    const fire = (eventName?: string) => {
      const now = Date.now();
      if (eventName && THROTTLED_EVENTS.has(eventName)) {
        if (now - lastThrottleRef.current < THROTTLE_MS) return;
        lastThrottleRef.current = now;
      }
      onActivityRef.current();
    };

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const events = [
        'mousemove',
        'mousedown',
        'mouseup',
        'click',
        'keydown',
        'keyup',
        'wheel',
        'scroll',
        'touchstart',
        'touchmove',
        'pointermove',
        'pointerdown',
        'focus',
      ] as const;

      const handler = (e: Event) => fire(e.type);
      const onVisibility = () => {
        if (!document.hidden) fire('visibilitychange');
      };

      for (const name of events) {
        document.addEventListener(name, handler, { passive: true });
      }
      document.addEventListener('visibilitychange', onVisibility);

      return () => {
        for (const name of events) {
          document.removeEventListener(name, handler);
        }
        document.removeEventListener('visibilitychange', onVisibility);
      };
    }

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') fire('appstate');
    });

    return () => sub.remove();
  }, [enabled]);
}
