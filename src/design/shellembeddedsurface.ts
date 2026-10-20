import { StyleSheet, type ViewStyle } from 'react-native';

/** Transparent surfaces for content rendered inside dark PlatformShell. */
export const shellEmbeddedSurface = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  surface: {
    backgroundColor: 'transparent',
  },
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export function shellEmbeddedSurfaceStyle(enabled: boolean): ViewStyle | undefined {
  return enabled ? shellEmbeddedSurface.surface : undefined;
}

export function shellEmbeddedScrollStyle(enabled: boolean): ViewStyle | undefined {
  return enabled ? shellEmbeddedSurface.scroll : undefined;
}
