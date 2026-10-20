import { useMemo } from 'react';
import { useThemeMode } from '@/design/ThemeModeProvider';
import {
  resolveCareSuitePalette,
  resolveCareTypography,
  type ColorMode,
} from '@/design/tokens';

export function useCareTheme(overrideMode?: ColorMode) {
  const { mode } = useThemeMode();
  const activeMode = overrideMode ?? mode;

  return useMemo(
    () => ({
      mode: activeMode,
      palette: resolveCareSuitePalette(activeMode),
      typography: resolveCareTypography(activeMode),
      isLight: activeMode === 'light',
      isDark: activeMode === 'dark',
    }),
    [activeMode],
  );
}
