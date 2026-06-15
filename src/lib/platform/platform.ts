import { Platform } from 'react-native';
import {
  buildPlatformLayoutSnapshot,
  detectWebPlatformTarget,
  type PlatformTarget,
} from './layoutSnapshot';

export type {
  PlatformLayoutSnapshot,
  PlatformTarget,
  ShellVariant,
} from './layoutSnapshot';
export {
  buildPlatformLayoutSnapshot,
  detectWebPlatformTarget,
  isDesktopShell,
  resolveShellVariant,
} from './layoutSnapshot';

export function resolvePlatformTarget(): PlatformTarget {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined') {
      return detectWebPlatformTarget(navigator.userAgent);
    }
    return 'web';
  }
  return 'web';
}
