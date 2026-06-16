import { StyleSheet, Text, View, Platform, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { careRadius } from '@/design/tokens/radius';
import { galaxyPalette } from '@/design/tokens/galaxy';

type CareSuiteIconProps = {
  emoji: string;
  accentColor?: string;
  size?: number;
  style?: ViewStyle;
};

/** Glass icon container for premium surfaces. */
export function CareSuiteIcon({
  emoji,
  accentColor = galaxyPalette.careOrange,
  size = 40,
  style,
}: CareSuiteIconProps) {
  const inner = (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size * 0.28,
          backgroundColor: `${accentColor}18`,
          borderColor: `${accentColor}40`,
        },
        style,
      ]}
    >
      <Text style={[styles.emoji, { fontSize: size * 0.42 }]}>{emoji}</Text>
    </View>
  );

  if (Platform.OS === 'web') {
    return inner;
  }

  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size * 0.28 }]}>
      <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFillObject} />
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  emoji: {
    textAlign: 'center',
  },
});
