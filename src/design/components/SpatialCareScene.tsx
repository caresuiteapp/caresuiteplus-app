import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { spatialCare, spatialCareColors } from '@/design/tokens/spatialCareSuite';

/** Abstract spatial care-home scene inspired by the supplied visual reference. */
export function SpatialCareScene() {
  return (
    <View style={styles.scene} accessibilityElementsHidden>
      <View style={styles.statusRow}><Text style={styles.status}>CARESUITE HEALTHOS</Text><Text style={styles.status}>● LIVE</Text></View>
      <View style={styles.platformShadow} />
      <LinearGradient colors={['#24304F', '#15172F']} style={styles.platform}>
        <View style={styles.homeRoof} />
        <View style={styles.home}><View style={styles.door} /><View style={styles.window} /></View>
        <View style={[styles.tree, styles.treeLeft]}><View style={styles.treeTop} /></View>
        <View style={[styles.tree, styles.treeRight]}><View style={styles.treeTop} /></View>
        <View style={styles.carePulse}><Text style={styles.carePulseText}>+</Text></View>
      </LinearGradient>
      <Text style={styles.title}>Versorgung. Planung. Sicherheit.</Text>
      <Text style={styles.copy}>Eine ruhige Oberfläche für alle Rollen, Module und Portale.</Text>
      <View style={styles.metrics}><View><Text style={styles.metric}>24/7</Text><Text style={styles.metricLabel}>verfügbar</Text></View><View><Text style={styles.metric}>1</Text><Text style={styles.metricLabel}>Designsystem</Text></View></View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { flex: 1, minHeight: 430, borderRadius: spatialCare.radius.stage, padding: 28, overflow: 'hidden', backgroundColor: 'rgba(17,19,38,0.82)', borderWidth: 1, borderColor: spatialCare.border, justifyContent: 'space-between' },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between' },
  status: { color: spatialCare.textOnNightMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  platformShadow: { position: 'absolute', alignSelf: 'center', top: 118, width: 250, height: 250, borderRadius: 70, backgroundColor: 'rgba(105,232,255,0.13)', transform: [{ rotate: '45deg' }] },
  platform: { width: 238, height: 238, borderRadius: 64, alignSelf: 'center', marginTop: 34, transform: [{ rotate: '45deg' }], borderWidth: 2, borderColor: 'rgba(105,232,255,0.62)', alignItems: 'center', justifyContent: 'center' },
  home: { width: 88, height: 74, backgroundColor: '#EDE3EA', borderRadius: 8, transform: [{ rotate: '-45deg' }], alignItems: 'center', justifyContent: 'flex-end' },
  homeRoof: { position: 'absolute', width: 78, height: 78, backgroundColor: '#5D7198', transform: [{ rotate: '45deg' }], top: 56, zIndex: 2, borderRadius: 6 },
  door: { width: 22, height: 38, backgroundColor: '#283150', borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  window: { position: 'absolute', width: 18, height: 18, backgroundColor: spatialCareColors.cyanLight, right: 12, top: 28, borderRadius: 3 },
  tree: { position: 'absolute', width: 12, height: 45, backgroundColor: '#3E6474', borderRadius: 8 },
  treeLeft: { left: 36, bottom: 48 },
  treeRight: { right: 38, top: 46 },
  treeTop: { width: 34, height: 34, borderRadius: 18, backgroundColor: '#4A92A1', marginLeft: -11, marginTop: -12 },
  carePulse: { position: 'absolute', right: 18, bottom: 18, width: 42, height: 42, borderRadius: 21, backgroundColor: spatialCareColors.cyanLight, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-45deg' }] },
  carePulseText: { color: spatialCareColors.night, fontSize: 26, fontWeight: '900' },
  title: { color: spatialCare.textOnNight, fontSize: 24, lineHeight: 29, fontWeight: '800', marginTop: 24 },
  copy: { color: spatialCare.textOnNightMuted, fontSize: 14, lineHeight: 21, maxWidth: 360 },
  metrics: { flexDirection: 'row', gap: 36, borderTopWidth: 1, borderTopColor: spatialCare.border, paddingTop: 18 },
  metric: { color: spatialCareColors.cyanLight, fontSize: 22, fontWeight: '800' },
  metricLabel: { color: spatialCare.textOnNightMuted, fontSize: 11 },
});
