import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { useTenantDisplayName } from '@/hooks/useTenantDisplayName';
import type { ScreensaverLogoSize } from '@/lib/screensaver/screensaverTypes';
import { ScreensaverLogo } from '@/components/screensaver/ScreensaverLogo';

type ScreensaverLogoStaticProps = {
  logoSize: ScreensaverLogoSize;
};

export function ScreensaverLogoStatic({ logoSize }: ScreensaverLogoStaticProps) {
  const text = useAuroraAdaptiveText();
  const tenantName = useTenantDisplayName();
  const glow = useRef(new Animated.Value(0.72)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.72,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glow]);

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.glassCard, { opacity: glow }]}>
        <ScreensaverLogo size={logoSize} />
      </Animated.View>
      {tenantName ? <Text style={[styles.tenant, { color: text.secondary }]}>{tenantName}</Text> : null}
      <Text style={[styles.brand, { color: text.muted }]}>CareSuite+</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: 12,
  },
  glassCard: {
    padding: 28,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#94a3b8',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
  tenant: {
    fontSize: 18,
    fontWeight: '500',
  },
  brand: {
    fontSize: 14,
    letterSpacing: 0.4,
  },
});
