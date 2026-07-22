import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type SpatialSceneProps = {
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
};

/**
 * Zentrales räumliches CareSuite-Motiv.
 * Rein in Code aufgebaut, damit es auf Web, iOS und Android scharf bleibt.
 */
export function SpatialScene({ style, compact = false }: SpatialSceneProps) {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.root, compact && styles.rootCompact, style]}
      testID="spatial-scene"
    >
      <View style={styles.aura} />
      <View style={styles.platformShadow} />
      <LinearGradient
        colors={['rgba(238,229,242,0.98)', 'rgba(164,166,204,0.96)', 'rgba(65,70,112,0.98)']}
        start={{ x: 0.12, y: 0 }}
        end={{ x: 0.92, y: 1 }}
        style={styles.platform}
      >
        <View style={styles.platformInner}>
          <LinearGradient
            colors={['rgba(105,232,255,0.7)', 'rgba(71,116,178,0.16)']}
            style={styles.ground}
          />
          <View style={[styles.tree, styles.treeLeft]}><View style={styles.treeTop} /><View style={styles.treeStem} /></View>
          <View style={[styles.tree, styles.treeRight]}><View style={styles.treeTop} /><View style={styles.treeStem} /></View>
          <View style={styles.buildingShadow} />
          <LinearGradient
            colors={['#77E8F5', '#4973B4', '#272C59']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.building}
          >
            <View style={styles.roof} />
            <View style={styles.windowRow}>
              <View style={styles.window} />
              <View style={styles.window} />
            </View>
            <View style={styles.door} />
          </LinearGradient>
        </View>
      </LinearGradient>
      <View style={styles.lightLine} />
    </View>
  );
}

const blur = Platform.OS === 'web'
  ? ({ filter: 'blur(22px)' } as unknown as ViewStyle)
  : undefined;

const styles = StyleSheet.create({
  root: { width: 260, height: 190, alignItems: 'center', justifyContent: 'center' },
  rootCompact: { transform: [{ scale: 0.72 }] },
  aura: { position: 'absolute', width: 220, height: 130, borderRadius: 999, backgroundColor: 'rgba(78,218,255,0.34)', ...blur },
  platformShadow: { position: 'absolute', width: 188, height: 96, borderRadius: 40, bottom: 25, backgroundColor: 'rgba(2,7,25,0.72)', transform: [{ rotate: '-3deg' }], ...blur },
  platform: { width: 196, height: 132, borderRadius: 38, padding: 10, transform: [{ rotate: '-2deg' }], borderWidth: 1, borderColor: 'rgba(255,255,255,0.76)' },
  platformInner: { flex: 1, borderRadius: 29, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(105,232,255,0.75)', backgroundColor: '#1E315B' },
  ground: { ...StyleSheet.absoluteFillObject },
  buildingShadow: { position: 'absolute', width: 80, height: 54, left: 50, top: 35, borderRadius: 16, backgroundColor: 'rgba(4,10,31,0.38)', transform: [{ rotate: '8deg' }] },
  building: { position: 'absolute', width: 76, height: 66, left: 58, top: 24, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.52)', alignItems: 'center', paddingTop: 22 },
  roof: { position: 'absolute', top: -14, width: 58, height: 58, borderRadius: 9, backgroundColor: '#334B85', borderWidth: 2, borderColor: '#87ECF7', transform: [{ rotate: '45deg' }] },
  windowRow: { flexDirection: 'row', gap: 12, zIndex: 2 },
  window: { width: 9, height: 11, borderRadius: 3, backgroundColor: '#FFE080', shadowColor: '#FFE080', shadowOpacity: 0.9, shadowRadius: 8 },
  door: { width: 13, height: 19, borderRadius: 4, marginTop: 7, backgroundColor: '#182343', zIndex: 2 },
  tree: { position: 'absolute', alignItems: 'center' },
  treeLeft: { left: 20, bottom: 14 },
  treeRight: { right: 20, top: 23 },
  treeTop: { width: 19, height: 29, borderRadius: 12, backgroundColor: '#3C7895', borderWidth: 1, borderColor: 'rgba(105,232,255,0.45)' },
  treeStem: { width: 4, height: 12, backgroundColor: '#1B2948' },
  lightLine: { position: 'absolute', width: 212, height: 126, borderRadius: 42, borderWidth: 2, borderColor: 'rgba(105,232,255,0.64)', shadowColor: '#69E8FF', shadowOpacity: 0.9, shadowRadius: 14 },
});
