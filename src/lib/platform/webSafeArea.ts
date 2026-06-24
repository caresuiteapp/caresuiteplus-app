import { Platform, type ViewStyle } from 'react-native';

/** Web Safari / iOS PWA — combine RN insets with env(safe-area-inset-*). */
export function webSafeAreaPadding(
  edge: 'top' | 'bottom' | 'left' | 'right',
  fallbackPx: number,
): number | string {
  if (Platform.OS !== 'web') return fallbackPx;
  return `max(${fallbackPx}px, env(safe-area-inset-${edge}))`;
}

export function webSafeAreaInsetsStyle(insets: {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}): ViewStyle {
  if (Platform.OS !== 'web') return {};
  const style: ViewStyle = {};
  if (insets.top != null) style.paddingTop = webSafeAreaPadding('top', insets.top) as number;
  if (insets.bottom != null) style.paddingBottom = webSafeAreaPadding('bottom', insets.bottom) as number;
  if (insets.left != null) style.paddingLeft = webSafeAreaPadding('left', insets.left) as number;
  if (insets.right != null) style.paddingRight = webSafeAreaPadding('right', insets.right) as number;
  return style;
}
