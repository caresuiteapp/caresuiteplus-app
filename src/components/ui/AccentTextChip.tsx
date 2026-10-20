import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { resolveAccentTextChipStyle } from '@/design/tokens/accentContrast';

type AccentTextChipProps = {
  label: string;
  accentColor: string;
  active?: boolean;
  dot?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

/** Colored label on a dark soft chip — readable on light orbital backgrounds. */
export function AccentTextChip({
  label,
  accentColor,
  active = false,
  dot = false,
  style,
  textStyle,
}: AccentTextChipProps) {
  const chip = resolveAccentTextChipStyle(accentColor, active);

  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: chip.backgroundColor,
          borderColor: chip.borderColor,
        },
        style,
      ]}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: chip.color }]} /> : null}
      <Text style={[styles.label, { color: chip.color }, textStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
    gap: 5,
    minWidth: 24,
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
});
