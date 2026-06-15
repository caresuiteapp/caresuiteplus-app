import { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { careLightColors } from '@/design/tokens/lightTheme';

type CareSuiteLightBackgroundProps = {
  children: ReactNode;
  style?: ViewStyle;
};

/** Light premium page background — default demo view. */
export function CareSuiteLightBackground({ children, style }: CareSuiteLightBackgroundProps) {
  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={[careLightColors.page, careLightColors.surface, careLightColors.page]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.glow} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: careLightColors.page,
  },
  glow: {
    position: 'absolute',
    top: '8%',
    right: '-8%',
    width: '50%',
    height: '30%',
    borderRadius: 999,
    backgroundColor: `${careLightColors.cyan}14`,
  },
});
