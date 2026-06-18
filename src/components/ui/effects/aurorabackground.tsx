import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type AuroraBackgroundProps = {
  animated?: boolean;
  style?: ViewStyle;
};

export function AuroraBackground({ style }: AuroraBackgroundProps) {
  return (
    <View style={[StyleSheet.absoluteFillObject, style]} pointerEvents="none">
      <LinearGradient
        colors={['#0B1024', '#080D1A', '#050816']}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.glowCyan} />
      <View style={styles.glowViolet} />
    </View>
  );
}

const styles = StyleSheet.create({
  glowCyan: {
    position: 'absolute',
    top: '8%',
    left: '-10%',
    width: '50%',
    height: '35%',
    borderRadius: 999,
    backgroundColor: 'rgba(6,182,212,0.12)',
  },
  glowViolet: {
    position: 'absolute',
    bottom: '10%',
    right: '-8%',
    width: '45%',
    height: '30%',
    borderRadius: 999,
    backgroundColor: 'rgba(139,92,246,0.10)',
  },
});
