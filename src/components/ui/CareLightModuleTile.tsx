import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { spatialCareColors } from '@/design/tokens/spatialCareSuite';
import { systemLiquidGlass } from '@/design/tokens/systemLiquidGlass';
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
  accentColor = spatialCareColors.cyanLight,
  isActive = false,
  preparedOnly = false,
  onPress,
  style,
}: CareLightModuleTileProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.tile,
        isActive && { borderColor: `${accentColor}55` },
        !onPress && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !onPress }}
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
    backgroundColor: systemLiquidGlass.card,
    borderRadius: careRadius.md,
    borderWidth: 1,
    borderColor: systemLiquidGlass.border,
    padding: careSpacing.md,
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.68,
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
    color: systemLiquidGlass.text.primary,
  },
  description: {
    ...careTypography.caption,
    color: systemLiquidGlass.text.secondary,
  },
  prepared: {
    ...careTypography.caption,
    color: spatialCareColors.cyanLight,
    fontWeight: '600',
    marginTop: 2,
  },
});
