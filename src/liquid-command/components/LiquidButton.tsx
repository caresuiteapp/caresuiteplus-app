import { Pressable, StyleSheet, Text } from 'react-native';
import { liquidTokens } from '../tokens';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
};

export function LiquidButton({
  label,
  onPress,
  variant = 'primary',
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.secondary,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: liquidTokens.touch.primary,
    paddingHorizontal: liquidTokens.space.xl,
    borderRadius: liquidTokens.radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  primary: {
    backgroundColor: liquidTokens.color.blue500,
    borderColor: liquidTokens.color.blue300,
  },
  secondary: {
    backgroundColor: liquidTokens.color.white08,
    borderColor: liquidTokens.color.white18,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  label: {
    color: liquidTokens.color.white,
    fontSize: liquidTokens.type.body,
    fontWeight: '700',
  },
});
