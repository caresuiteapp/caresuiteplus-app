import { ReactNode, useCallback, useState } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

const OVERFLOW_EPSILON = 2;

type AutoScrollViewProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
  /** Stretch content to at least the viewport height when everything fits on screen. */
  fillViewport?: boolean;
  /** Allow horizontal overflow on web (e.g. wide module KPI grid). */
  allowHorizontalOverflow?: boolean;
};

export function AutoScrollView({
  children,
  style,
  contentContainerStyle,
  testID,
  fillViewport = true,
  allowHorizontalOverflow = false,
}: AutoScrollViewProps) {
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  const onViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    setViewportHeight((prev) => (prev === next ? prev : next));
  }, []);

  const onContentLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    setContentHeight((prev) => (prev === next ? prev : next));
  }, []);

  const needsScroll = viewportHeight > 0 && contentHeight > viewportHeight + OVERFLOW_EPSILON;

  const webOverflowStyle =
    Platform.OS === 'web'
      ? ({
          overflowY: 'auto' as const,
          overflowX: allowHorizontalOverflow ? ('auto' as const) : ('hidden' as const),
        } as ViewStyle)
      : null;

  const fillStyle: ViewStyle | null =
    fillViewport && viewportHeight > 0 && !needsScroll
      ? { minHeight: viewportHeight }
      : fillViewport && Platform.OS === 'web'
        ? ({ minHeight: '100%' } as ViewStyle)
        : null;

  if (Platform.OS === 'web') {
    return (
      <View testID={testID} style={[styles.viewport, webOverflowStyle, style]} onLayout={onViewportLayout}>
        <View
          onLayout={onContentLayout}
          style={[styles.contentWidth, fillViewport ? styles.contentFill : null, contentContainerStyle, fillStyle]}
        >
          {children}
        </View>
      </View>
    );
  }

  if (!needsScroll) {
    return (
      <View testID={testID} style={[styles.viewport, style]} onLayout={onViewportLayout}>
        <View
          onLayout={onContentLayout}
          style={[
            styles.contentWidth,
            fillViewport ? styles.contentFill : null,
            contentContainerStyle,
            fillStyle,
          ]}
        >
          {children}
        </View>
      </View>
    );
  }

  return (
    <View testID={testID} style={[styles.viewport, style]} onLayout={onViewportLayout}>
      <ScrollView
        style={styles.scrollNative}
        contentContainerStyle={[styles.contentWidth, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        scrollEnabled
        bounces
        showsVerticalScrollIndicator
        onContentSizeChange={(_, height) => {
          const next = Math.round(height);
          setContentHeight((prev) => (prev === next ? prev : next));
        }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
  },
  scrollNative: {
    flex: 1,
  },
  contentWidth: {
    width: '100%',
  },
  contentFill: {
    flexGrow: 1,
  },
});
