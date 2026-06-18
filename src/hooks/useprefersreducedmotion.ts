import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Respects system reduced-motion preference (iOS/Android accessibility + web
 * `prefers-reduced-motion`). Used by GlobalAnimatedBackground / AuroraBackground.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;

    const apply = (value: boolean) => {
      if (mounted) setReduced(value);
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'matchMedia' in window) {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      apply(mq.matches);
      const onChange = (event: MediaQueryListEvent) => apply(event.matches);
      mq.addEventListener('change', onChange);
      return () => {
        mounted = false;
        mq.removeEventListener('change', onChange);
      };
    }

    void AccessibilityInfo.isReduceMotionEnabled().then(apply);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      apply,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
