import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { careRadius } from '@/design/tokens/radius';

type CareSuiteIconProps = {
  emoji: string;
  accentColor?: string;
  size?: number;
  style?: ViewStyle;
};

export function CareSuiteIcon({
  emoji,
  accentColor = '#FF7A1A',
  size = 40,
  style,
}: CareSuiteIconProps) {
  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size * 0.25,
          backgroundColor: `${accentColor}22`,
          borderColor: `${accentColor}44`,
        },
        style,
      ]}
    >
      <Text style={[styles.emoji, { fontSize: size * 0.45 }]}>{emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  emoji: {
    textAlign: 'center',
  },
});
