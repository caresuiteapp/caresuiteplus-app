import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import {
  Pressable,
  ScrollView,
  View,
  type PressableProps,
  type ScrollViewProps,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

type WebDataSet = Record<string, string | number | boolean | null | undefined>;
type WebViewProps = ViewProps & { dataSet?: WebDataSet };

/**
 * Web-only aliases for the same React Native Web components. React Native's
 * declarations omit dataSet, which is supported by the web runtime.
 * Keep that difference at this boundary; native component types stay unchanged.
 */
export type WebView = View;
export const WebView = View as unknown as ForwardRefExoticComponent<
  WebViewProps & RefAttributes<View>
>;
export const WebScrollView = ScrollView as unknown as ForwardRefExoticComponent<
  ScrollViewProps & { dataSet?: WebDataSet } & RefAttributes<ScrollView>
>;
export const WebPressable = Pressable as unknown as ForwardRefExoticComponent<
  PressableProps & { dataSet?: WebDataSet } & RefAttributes<View>
>;

type FixedWebViewStyle = Omit<ViewStyle, 'position'> & { position: 'fixed' };

/** Preserve viewport anchoring on web without allowing fixed styles on native. */
export function fixedWebViewStyle(style: FixedWebViewStyle): ViewStyle {
  return style as unknown as ViewStyle;
}
