import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LiquidModule } from '../types';
import { liquidTokens } from '../tokens';
import { LiquidSurface } from './LiquidSurface';

type Props = {
  module: LiquidModule;
  selected: boolean;
  onPress: () => void;
};

export function LiquidModuleCard({ module, selected, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${module.label}: ${module.description}`}
      onPress={onPress}
    >
      <LiquidSurface active={selected} style={styles.surface}>
        <View style={styles.icon}>
          <Text style={styles.iconText}>{module.label.slice(0, 1)}</Text>
        </View>
        <View style={styles.copy}>
          <Text style={styles.label}>{module.label}</Text>
          <Text style={styles.description}>{module.description}</Text>
          <Text style={styles.priority}>{module.priority}</Text>
        </View>
      </LiquidSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  surface: {
    minHeight: 126,
    padding: liquidTokens.space.lg,
    flexDirection: 'row',
    gap: liquidTokens.space.md,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: liquidTokens.color.blue500,
  },
  iconText: {
    color: liquidTokens.color.white,
    fontSize: 20,
    fontWeight: '800',
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  label: {
    color: liquidTokens.color.white,
    fontSize: liquidTokens.type.section,
    fontWeight: '800',
  },
  description: {
    color: liquidTokens.color.white64,
    fontSize: liquidTokens.type.meta,
    lineHeight: 20,
  },
  priority: {
    marginTop: 4,
    color: liquidTokens.color.blue300,
    fontSize: liquidTokens.type.meta,
    fontWeight: '700',
  },
});

