import { ReactNode } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import { useShellGlassSurfaceStyle } from '@/design/tokens/auroraGlass';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { careEffects } from '@/design/tokens/effects';

type GlassSurfaceProps = {
  children: ReactNode;
  style?: ViewStyle;
  radius?: number;
  glowColor?: string;
  glowOpacity?: number;
  /** Modal / elevated overlay shell — opaque glass panel with subtle backdrop blur. */
  elevated?: boolean;
};

const webModalBlur = (blurPx: number) =>
  Platform.OS === 'web'
    ? ({
        backdropFilter: `blur(${blurPx}px)`,
        WebkitBackdropFilter: `blur(${blurPx}px)`,
      } as unknown as ViewStyle)
    : null;

export function GlassSurface({
  children,
  style,
  radius = 12,
  elevated = false,
}: GlassSurfaceProps) {
  const { isDark } = useCareLightPalette();
  const shellHostsAurora = useShellHostsAurora();
  const lightGlass = useShellGlassSurfaceStyle(
    elevated ? 'modal' : 'card',
    elevated ? { viewContext: 'form' } : {},
  );

  if (!isDark && shellHostsAurora) {
    return (
      <View style={[{ borderRadius: radius }, lightGlass, style]}>
        {children}
      </View>
    );
  }

  const backgroundColor = elevated
    ? isDark
      ? careEffects.glass.modalBackground
      : careEffects.glass.modalBackgroundLight
    : careEffects.glass.background;

  const borderColor = elevated
    ? isDark
      ? careEffects.glass.modalBorder
      : careEffects.glass.modalBorderLight
    : careEffects.glass.border;

  return (
    <View
      style={[
        {
          borderRadius: radius,
          borderWidth: 1,
          borderColor,
          backgroundColor,
          overflow: 'hidden',
          ...(elevated ? webModalBlur(careEffects.glass.blur.medium) : null),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
