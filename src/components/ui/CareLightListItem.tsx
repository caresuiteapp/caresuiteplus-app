import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';

type CareLightListItemProps = {
  title: string;
  subtitle?: string;
  meta?: string;
  icon?: string;
  onPress?: () => void;
  style?: ViewStyle;
};

export function CareLightListItem({
  title,
  subtitle,
  meta,
  icon,
  onPress,
  style,
}: CareLightListItemProps) {
  const inner = (
    <View style={[styles.row, style]}>
      {icon ? (
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
      ) : null}
      <View style={styles.textCol}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
    </View>
  );

  if (!onPress) return inner;

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => <View style={pressed ? styles.pressed : undefined}>{inner}</View>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: careSpacing.sm,
    paddingVertical: careSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: careLightColors.border,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: careRadius.sm,
    backgroundColor: `${careLightColors.cyan}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...careTypography.bodyStrong,
    color: careLightColors.text,
  },
  subtitle: {
    ...careTypography.caption,
    color: careLightColors.muted,
  },
  meta: {
    ...careTypography.caption,
    color: careLightColors.cyan,
  },
  pressed: {
    opacity: 0.85,
  },
});
