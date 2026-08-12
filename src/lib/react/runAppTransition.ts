import { startTransition } from 'react';
import { Platform } from 'react-native';

/**
 * React Native 0.76's Fabric development renderer can expose no transition
 * collection while passive effects are reconnecting. Calling React's global
 * startTransition in that state crashes before the application can mount.
 * Native state/navigation updates used here are small and safe synchronously;
 * web keeps concurrent transitions for hydration and route changes.
 */
export function runAppTransition(update: () => void): void {
  if (Platform.OS === 'web') {
    startTransition(update);
    return;
  }

  update();
}
