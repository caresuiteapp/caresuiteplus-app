import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { auroraGlass, lightLiquidGlass } from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { ensureGlassScrollbarsCss } from '@/design/web/ensureGlassScrollbarsCss';
import { useAuroraGlassActive } from '@/hooks/useshellhostsaurora';

const EDGE_EPSILON = 2;
const FADE_WIDTH = 28;

type GlassScrollViewProps = Omit<ScrollViewProps, 'horizontal'> & {
  children: ReactNode;
  horizontal?: boolean;
  /** Subtle edge fade hint when content overflows (web/tablet). Default true. */
  edgeFade?: boolean;
  style?: StyleProp<ViewStyle>;
};

type EdgeState = {
  start: boolean;
  end: boolean;
};

function resolveGlassScrollClass(isLightGlass: boolean, horizontal: boolean): string {
  return [
    'cs-glass-scroll',
    isLightGlass ? 'cs-glass-scroll--light' : 'cs-glass-scroll--dark',
    horizontal ? 'cs-glass-scroll--horizontal' : 'cs-glass-scroll--vertical',
  ].join(' ');
}

function edgeFadeBackground(isLightGlass: boolean, direction: 'left' | 'right' | 'top' | 'bottom'): string {
  const solid = isLightGlass ? 'rgba(247,250,255,0.92)' : 'rgba(7,10,31,0.88)';
  const transparent = 'transparent';
  if (direction === 'left') return `linear-gradient(to right, ${solid}, ${transparent})`;
  if (direction === 'right') return `linear-gradient(to left, ${solid}, ${transparent})`;
  if (direction === 'top') return `linear-gradient(to bottom, ${solid}, ${transparent})`;
  return `linear-gradient(to top, ${solid}, ${transparent})`;
}

export function GlassScrollView({
  children,
  horizontal = false,
  edgeFade = true,
  style,
  contentContainerStyle,
  onScroll,
  onContentSizeChange,
  onLayout,
  showsHorizontalScrollIndicator,
  showsVerticalScrollIndicator,
  ...rest
}: GlassScrollViewProps) {
  const auroraActive = useAuroraGlassActive();
  const { isLight } = useLegacyTheme();
  const isLightGlass = auroraActive && isLight;

  const [edges, setEdges] = useState<EdgeState>({ start: false, end: false });
  const metricsRef = useRef({ viewport: 0, content: 0, offset: 0 });

  const scrollRef = useRef<ScrollView | View>(null);

  const applyWebScrollClasses = useCallback(() => {
    if (Platform.OS !== 'web') return;
    const node = scrollRef.current as unknown as HTMLElement | null;
    if (!node?.classList) return;
    node.classList.remove(
      'cs-glass-scroll',
      'cs-glass-scroll--light',
      'cs-glass-scroll--dark',
      'cs-glass-scroll--horizontal',
      'cs-glass-scroll--vertical',
    );
    resolveGlassScrollClass(isLightGlass, horizontal)
      .split(' ')
      .forEach((className) => node.classList.add(className));
  }, [horizontal, isLightGlass]);

  useEffect(() => {
    ensureGlassScrollbarsCss();
    applyWebScrollClasses();
  }, [applyWebScrollClasses]);

  const updateEdges = useCallback(
    (offset: number, viewport: number, content: number) => {
      if (viewport <= 0 || content <= viewport + EDGE_EPSILON) {
        setEdges({ start: false, end: false });
        return;
      }
      setEdges({
        start: offset > EDGE_EPSILON,
        end: offset + viewport < content - EDGE_EPSILON,
      });
    },
    [],
  );

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const viewport = horizontal
        ? Math.round(event.nativeEvent.layout.width)
        : Math.round(event.nativeEvent.layout.height);
      metricsRef.current.viewport = viewport;
      updateEdges(metricsRef.current.offset, viewport, metricsRef.current.content);
      onLayout?.(event);
    },
    [horizontal, onLayout, updateEdges],
  );

  const handleContentSizeChange = useCallback(
    (width: number, height: number) => {
      const content = Math.round(horizontal ? width : height);
      metricsRef.current.content = content;
      updateEdges(metricsRef.current.offset, metricsRef.current.viewport, content);
      onContentSizeChange?.(width, height);
    },
    [horizontal, onContentSizeChange, updateEdges],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
      const offset = Math.round(horizontal ? contentOffset.x : contentOffset.y);
      const viewport = Math.round(horizontal ? layoutMeasurement.width : layoutMeasurement.height);
      const content = Math.round(horizontal ? contentSize.width : contentSize.height);
      metricsRef.current = { offset, viewport, content };
      updateEdges(offset, viewport, content);
      onScroll?.(event);
    },
    [horizontal, onScroll, updateEdges],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        shell: {
          position: 'relative',
          maxWidth: '100%',
          minWidth: 0,
        },
        webScroll: {
          maxWidth: '100%',
          minWidth: 0,
        },
        fadeEdge: {
          position: 'absolute',
          zIndex: 2,
          pointerEvents: 'none',
        },
        fadeHorizontal: {
          top: 0,
          bottom: 12,
          width: FADE_WIDTH,
        },
        fadeLeft: {
          left: 0,
        },
        fadeRight: {
          right: 0,
        },
        fadeVertical: {
          left: 0,
          right: 10,
          height: FADE_WIDTH,
        },
        fadeTop: {
          top: 0,
        },
        fadeBottom: {
          bottom: 12,
        },
      }),
    [],
  );

  const webOverflowStyle =
    Platform.OS === 'web'
      ? ({
          overflowX: horizontal ? ('auto' as const) : ('hidden' as const),
          overflowY: horizontal ? ('hidden' as const) : ('auto' as const),
        } as ViewStyle)
      : null;

  const contentInnerStyle =
    Platform.OS === 'web' && horizontal ? ({ flexShrink: 0 } as ViewStyle) : null;
  const nativeShowsHorizontal = showsHorizontalScrollIndicator ?? Platform.OS !== 'web';
  const nativeShowsVertical = showsVerticalScrollIndicator ?? Platform.OS !== 'web';

  const fadeOverlays =
    edgeFade && Platform.OS === 'web' ? (
      <>
        {horizontal && edges.start ? (
          <View
            style={[
              styles.fadeEdge,
              styles.fadeHorizontal,
              styles.fadeLeft,
              { backgroundImage: edgeFadeBackground(isLightGlass, 'left') } as ViewStyle,
            ]}
            pointerEvents="none"
          />
        ) : null}
        {horizontal && edges.end ? (
          <View
            style={[
              styles.fadeEdge,
              styles.fadeHorizontal,
              styles.fadeRight,
              { backgroundImage: edgeFadeBackground(isLightGlass, 'right') } as ViewStyle,
            ]}
            pointerEvents="none"
          />
        ) : null}
        {!horizontal && edges.start ? (
          <View
            style={[
              styles.fadeEdge,
              styles.fadeVertical,
              styles.fadeTop,
              { backgroundImage: edgeFadeBackground(isLightGlass, 'top') } as ViewStyle,
            ]}
            pointerEvents="none"
          />
        ) : null}
        {!horizontal && edges.end ? (
          <View
            style={[
              styles.fadeEdge,
              styles.fadeVertical,
              styles.fadeBottom,
              { backgroundImage: edgeFadeBackground(isLightGlass, 'bottom') } as ViewStyle,
            ]}
            pointerEvents="none"
          />
        ) : null}
      </>
    ) : null;

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.shell, style]}>
        {fadeOverlays}
        <ScrollView
          ref={scrollRef}
          horizontal={horizontal}
          // RN Web: dataSet + ref classList scopes glass scrollbar CSS over global invisible scrollbars.
          dataSet={{
            csGlassScroll: 'true',
            csGlassScrollTheme: isLightGlass ? 'light' : 'dark',
            csGlassScrollAxis: horizontal ? 'horizontal' : 'vertical',
          }}
          style={[styles.webScroll, webOverflowStyle]}
          contentContainerStyle={[contentContainerStyle, contentInnerStyle]}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          onLayout={handleLayout}
          onContentSizeChange={handleContentSizeChange}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          {...rest}
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.shell, style]}>
      <ScrollView
        horizontal={horizontal}
        style={styles.webScroll}
        contentContainerStyle={contentContainerStyle}
        showsHorizontalScrollIndicator={nativeShowsHorizontal}
        showsVerticalScrollIndicator={nativeShowsVertical}
        onLayout={handleLayout}
        onContentSizeChange={handleContentSizeChange}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        {...rest}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/** Surface tint used by edge fades — exported for tests. */
export function glassScrollSurfaceColor(isLightGlass: boolean): string {
  return isLightGlass ? lightLiquidGlass.table : auroraGlass.table;
}
