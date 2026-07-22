import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { spatialCareColors, spatialCareGradients } from '@/design/tokens/spatialCareSuite';
import { SpatialScene } from '@/components/ui/SpatialScene';

type SpatialCareBackgroundProps = { dimmed?: boolean };

/** Code-rendered spatial scene derived from the supplied reference artwork. */
export function SpatialCareBackground({ dimmed = false }: SpatialCareBackgroundProps) {
  return (
    <View style={styles.root} pointerEvents="none" testID="spatial-care-background">
      <LinearGradient
        colors={[...spatialCareGradients.background]}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[styles.glow, styles.glowCyan]} />
      <View style={[styles.glow, styles.glowWarm]} />
      <View style={[styles.orbit, styles.orbitLarge]} />
      <View style={[styles.orbit, styles.orbitSmall]} />
      <SpatialScene style={styles.scene} />
      <View style={styles.horizon} />
      {dimmed ? <View style={styles.dim} /> : null}
    </View>
  );
}

const blurFx = Platform.OS === 'web'
  ? ({ filter: 'blur(44px)' } as unknown as ViewStyle)
  : null;

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', backgroundColor: spatialCareColors.night },
  glow: { position: 'absolute', borderRadius: 999, opacity: 0.38, ...blurFx },
  glowCyan: { width: 520, height: 520, right: '-8%', top: '-18%', backgroundColor: '#207A94' },
  glowWarm: { width: 420, height: 420, left: '18%', bottom: '-24%', backgroundColor: '#9B7B85', opacity: 0.24 },
  orbit: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(105,232,255,0.13)', transform: [{ rotate: '-18deg' }] },
  orbitLarge: { width: '76%', height: '82%', right: '-22%', top: '8%', borderRadius: 260 },
  orbitSmall: { width: 320, height: 320, left: '8%', top: '14%', borderRadius: 96 },
  horizon: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '34%', backgroundColor: 'rgba(235,226,239,0.07)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.09)' },
  scene: { position: 'absolute', right: '5%', top: '8%', opacity: 0.16, transform: [{ scale: 1.7 }] },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,10,24,0.34)' },
});
