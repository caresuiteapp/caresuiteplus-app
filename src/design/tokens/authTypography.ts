import { useMemo } from 'react';
import type { TextStyle } from 'react-native';
import { useAuroraAdaptiveText, useAuroraGlassActive } from '@/design/tokens/auroraGlass';
import { galaxyPalette } from '@/design/tokens/galaxy';
import { llgsTypography } from '@/design/tokens/lightLiquidGlassSpace';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { resolveGalaxyTypography } from './responsiveTypography';

/** Auth / login typography — LLGAN light text on aurora shell, galaxy palette on dark auth backdrop. */
export function useAuthFlowTypography() {
  const { width } = useDeviceClass();
  const text = useAuroraAdaptiveText();
  const auroraActive = useAuroraGlassActive();

  return useMemo(() => {
    const sizes = resolveGalaxyTypography(width);

    if (!auroraActive) {
      return sizes;
    }

    const accentEyebrow: TextStyle = {
      ...sizes.eyebrow,
      color: '#0284C7',
    };

    return {
      h1: { ...sizes.h1, color: text.primary },
      h2: { ...sizes.h2, color: text.primary },
      cardTitle: { ...sizes.cardTitle, color: text.primary },
      body: { ...sizes.body, color: text.secondary },
      label: { ...sizes.label, color: text.primary, fontWeight: '600' as const },
      button: { ...sizes.button, color: text.primary },
      caption: { ...sizes.caption, color: text.muted },
      eyebrow: accentEyebrow,
      backLink: {
        color: '#0284C7',
        fontSize: sizes.body.fontSize,
        fontWeight: '600' as const,
      } as TextStyle,
      inputPlaceholder: llgsTypography.secondary,
      inputText: text.primary,
    };
  }, [auroraActive, text.muted, text.primary, text.secondary, width]);
}

export function authBackLinkColor(auroraActive: boolean): string {
  return auroraActive ? '#0284C7' : galaxyPalette.galaxyCyan;
}
