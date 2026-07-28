import { Platform, useWindowDimensions } from 'react-native';
import { liquidBreakpoints } from './tokens';

export type LiquidFormFactor =
  | 'phone-portrait'
  | 'phone-landscape-blocked'
  | 'tablet-portrait'
  | 'tablet-landscape'
  | 'compact-web'
  | 'desktop';

export type LiquidLayout = {
  formFactor: LiquidFormFactor;
  width: number;
  height: number;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isPortrait: boolean;
  showDock: boolean;
  showCommandLabels: boolean;
  contentPadding: number;
  panelCount: 1 | 2 | 3 | 4;
};

export function resolveLiquidFormFactor(
  width: number,
  height: number,
  platform: typeof Platform.OS = Platform.OS,
): LiquidFormFactor {
  const shortest = Math.min(width, height);
  const portrait = height >= width;
  const phoneLike = shortest <= liquidBreakpoints.phoneMax;

  if (phoneLike && !portrait) return 'phone-landscape-blocked';
  if (phoneLike) return 'phone-portrait';
  if (portrait && width <= liquidBreakpoints.tabletPortraitMax) return 'tablet-portrait';
  if (
    platform === 'web' &&
    width >= liquidBreakpoints.compactWebMin &&
    width <= liquidBreakpoints.compactWebMax
  ) {
    return 'compact-web';
  }
  if (platform !== 'web' || width < liquidBreakpoints.desktopMin) return 'tablet-landscape';
  return 'desktop';
}

export function useLiquidLayout(): LiquidLayout {
  const { width, height } = useWindowDimensions();
  const formFactor = resolveLiquidFormFactor(width, height);
  const isPhone =
    formFactor === 'phone-portrait' || formFactor === 'phone-landscape-blocked';
  const isTablet =
    formFactor === 'tablet-portrait' || formFactor === 'tablet-landscape';
  const isDesktop = formFactor === 'compact-web' || formFactor === 'desktop';
  const isPortrait = height >= width;

  return {
    formFactor,
    width,
    height,
    isPhone,
    isTablet,
    isDesktop,
    isPortrait,
    showDock: isDesktop,
    showCommandLabels: formFactor === 'desktop' || formFactor === 'tablet-landscape',
    contentPadding: isPhone ? 16 : formFactor === 'tablet-portrait' ? 20 : 24,
    panelCount:
      formFactor === 'desktop'
        ? 4
        : formFactor === 'compact-web' || formFactor === 'tablet-landscape'
          ? 3
          : formFactor === 'tablet-portrait'
            ? 2
            : 1,
  };
}
