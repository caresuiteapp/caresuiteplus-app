import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { liquidTokens } from '../tokens';

type Props = PropsWithChildren<{
  style?: ViewStyle | ViewStyle[];
  active?: boolean;
}>;

export function LiquidSurface({ children, style, active = false }: Props) {
  return (
    <View style={[styles.surface, active && styles.active, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    borderRadius: liquidTokens.radius.panel,
    borderWidth: 1,
    borderColor: liquidTokens.color.white12,
    backgroundColor: liquidTokens.color.white08,
    overflow: 'hidden',
  },
  active: {
    borderColor: liquidTokens.color.blue500,
    shadowColor: liquidTokens.color.blue500,
    shadowOpacity: 0.3,
    shadowRadius: 18,
  },
});

