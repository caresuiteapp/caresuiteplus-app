import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { CareSuiteLogo } from '@/components/brand';
import { CARESUITE_LOGO_SIZES } from '@/components/brand/CareSuiteLogoMark';
import { useTenantBranding } from '@/hooks/useTenantDisplayName';
import type { ScreensaverLogoSize } from '@/lib/screensaver/screensaverTypes';
import { LOGO_SIZE_PX } from '@/lib/screensaver/screensaverTypes';

type ScreensaverLogoProps = {
  size: ScreensaverLogoSize;
};

export function ScreensaverLogo({ size }: ScreensaverLogoProps) {
  const { logoUrl, logoLoading } = useTenantBranding();
  const [logoFailed, setLogoFailed] = useState(false);
  const trimmed = logoUrl?.trim() ?? '';
  const dim = LOGO_SIZE_PX[size];

  useEffect(() => {
    setLogoFailed(false);
  }, [trimmed]);

  const showRemote = trimmed.length > 0 && !logoFailed;

  const fallbackScale = dim / CARESUITE_LOGO_SIZES.hero;

  return (
    <View style={[styles.wrap, { width: dim, height: dim }]}>
      {showRemote ? (
        <Image
          source={{ uri: trimmed }}
          style={{ width: dim, height: dim, maxWidth: dim, maxHeight: dim }}
          resizeMode="contain"
          accessibilityLabel="Mandantenlogo"
          onError={() => setLogoFailed(true)}
        />
      ) : !logoLoading ? (
        <CareSuiteLogo
          size="hero"
          style={{ transform: [{ scale: fallbackScale }] }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
