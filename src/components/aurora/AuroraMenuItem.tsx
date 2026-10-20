import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { careSpacing } from '@/design/tokens/spacing';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';

type Props = {
  title: string;
  description?: string;
  icon?: string;
  onPress?: () => void;
  active?: boolean;
  style?: ViewStyle;
};

export function AuroraMenuItem({ title, description, icon, onPress, active = false, style }: Props) {
  const { typography } = useLegacyTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        active && styles.active,
        pressed && styles.pressed,
        style,
      ]}
    >
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <View style={styles.textCol}>
        <Text style={[typography.bodyStrong, styles.title]}>{title}</Text>
        {description ? <Text style={[typography.caption, styles.description]}>{description}</Text> : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.md,
    padding: careSpacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: careSuiteAuroraTheme.glass.border,
    backgroundColor: careSuiteAuroraTheme.glass.background,
    marginBottom: careSpacing.sm,
  },
  active: {
    borderColor: careSuiteAuroraTheme.accent.violet,
    backgroundColor: 'rgba(139, 92, 246, 0.14)',
  },
  pressed: { opacity: 0.88 },
  icon: { fontSize: 22 },
  textCol: { flex: 1, gap: 2 },
  title: { color: careSuiteAuroraTheme.text.primary },
  description: { color: careSuiteAuroraTheme.text.secondary },
  chevron: { fontSize: 22, color: careSuiteAuroraTheme.accent.cyan, fontWeight: '700' },
});
