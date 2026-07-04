import { useWindowDimensions } from 'react-native';
import {
  resolveHydrationSafeHeight,
  resolveHydrationSafeWidth,
} from '@/lib/platform/ssrLayoutDefaults';
import { useHydrated } from '@/hooks/useHydrated';

/**
 * Returns stable SSR defaults until hydration, then live window dimensions.
 */
export function useHydrationSafeWindowDimensions() {
  const hydrated = useHydrated();
  const { width, height } = useWindowDimensions();

  return {
    width: resolveHydrationSafeWidth(width, hydrated),
    height: resolveHydrationSafeHeight(height, hydrated),
    hydrated,
  };
}
