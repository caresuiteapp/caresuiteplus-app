import { nativeDesktopLayout } from '@/liquid-command/navigation/nativeDesktopLayout';

type Insets = { top: number; bottom: number; left: number; right: number };
export type NativeNeoPosition = { x: number; y: number };

/** Matches the reserved centre of the native desktop header; clamps after rotation. */
export function nativeNeoPosition(width: number, height: number, insets: Insets, moved: NativeNeoPosition | null = null) {
  const layout = nativeDesktopLayout(width - insets.left - insets.right);
  const initial = { x: insets.left + (width - insets.left - insets.right - 68) / 2, y: insets.top + layout.framePadding + 10 };
  const position = moved ?? initial;
  return {
    x: Math.max(insets.left + 8, Math.min(width - insets.right - 76, position.x)),
    y: Math.max(insets.top + 8, Math.min(height - insets.bottom - 82, position.y)),
  };
}
