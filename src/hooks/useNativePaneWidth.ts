import { useCallback, useState } from 'react';
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native';

/** A tablet window can contain a much narrower list, dialog or split pane. */
export function useNativePaneWidth() {
  const window = useWindowDimensions();
  const [paneWidth, setPaneWidth] = useState<number | null>(null);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (Number.isFinite(width) && width > 0) setPaneWidth(previous => previous === width ? previous : width);
  }, []);
  return { width: paneWidth ?? window.width, fontScale: Math.max(1, window.fontScale || 1), onLayout };
}
