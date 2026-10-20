import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { systemLiquidGlass } from '@/design/tokens/systemLiquidGlass';
import { PremiumListRow } from '@/components/ui/PremiumListRow';

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
  const leading = icon ? (
    <View style={styles.iconWrap}>
      <Text style={styles.icon}>{icon}</Text>
    </View>
  ) : undefined;
  const combinedSubtitle = [subtitle, meta].filter(Boolean).join(' · ');

  return (
    <PremiumListRow
      title={title}
      subtitle={combinedSubtitle || undefined}
      leading={leading}
      onPress={onPress}
      showChevron={Boolean(onPress)}
      showDivider
      multiline
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: careRadius.sm,
    backgroundColor: systemLiquidGlass.chipActive,
    borderWidth: 1,
    borderColor: systemLiquidGlass.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: careSpacing.xs,
  },
  icon: {
    fontSize: 18,
  },
});
