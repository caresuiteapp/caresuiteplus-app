import { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { galaxyGradients, galaxyPalette } from '@/design/tokens/galaxy';

type SpaceBackgroundProps = {
  children: ReactNode;
  style?: ViewStyle;
};

/** Deep space gradient with subtle ambient orbs — no oversized light circles. */
export function SpaceBackground({ children, style }: SpaceBackgroundProps) {
  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={[...galaxyGradients.screen]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.orbCyan} />
      <View style={styles.orbViolet} />
      <View style={styles.orbOrange} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: galaxyPalette.deepSpace,
    overflow: 'hidden',
  },
  orbCyan: {
    position: 'absolute',
    top: '12%',
    left: '-6%',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: `${galaxyPalette.galaxyCyan}10`,
  },
  orbViolet: {
    position: 'absolute',
    bottom: '18%',
    right: '-4%',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${galaxyPalette.glowViolet}0C`,
  },
  orbOrange: {
    position: 'absolute',
    top: '42%',
    right: '12%',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${galaxyPalette.careOrange}08`,
  },
});
