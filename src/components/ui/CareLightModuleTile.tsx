import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';

type CareLightModuleTileProps = {
  icon: string;
  title: string;
  description?: string;
  accentColor?: string;
  isActive?: boolean;
  preparedOnly?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

export function CareLightModuleTile({
  icon,
  title,
  description,
  accentColor = careLightColors.orange,
  isActive = false,
  preparedOnly = false,
  onPress,
  style,
}: CareLightModuleTileProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        isActive && { borderColor: `${accentColor}55` },
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
    >
      <View style={[styles.iconBadge, { backgroundColor: `${accentColor}14` }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.textCol}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
        {preparedOnly ? <Text style={styles.prepared}>In Vorbereitung</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: careSpacing.sm,
    backgroundColor: careLightColors.surface,
    borderRadius: careRadius.md,
    borderWidth: 1,
    borderColor: careLightColors.border,
    padding: careSpacing.md,
  },
  pressed: {
    opacity: 0.9,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: careRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 22,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...careTypography.bodyStrong,
    color: careLightColors.navy,
  },
  description: {
    ...careTypography.caption,
    color: careLightColors.muted,
  },
  prepared: {
    ...careTypography.caption,
    color: careLightColors.gold,
    fontWeight: '600',
    marginTop: 2,
  },
});
