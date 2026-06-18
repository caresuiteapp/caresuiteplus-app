import { useMemo } from 'react';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { usePlatformLayout } from '@/hooks/usePlatformLayout';

/**
 * True when the desktop/web PlatformShell already paints GlobalAnimatedBackground
 * behind the main work column — page shells must stay transparent so dark
 * glass surfaces and typography remain readable (RN Web defaults Views to white).
 */
export function useShellHostsAurora(embedded?: boolean): boolean {
  const { isDark } = useCareLightPalette();
  const { adaptiveShell } = usePlatformLayout();

  return useMemo(
    () => embedded ?? (isDark && (adaptiveShell === 'desktop' || adaptiveShell === 'web')),
    [adaptiveShell, embedded, isDark],
  );
}
