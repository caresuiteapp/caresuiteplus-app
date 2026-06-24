import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useActiveGlassTokens } from '@/design/tokens/auroraGlass';
import { useInteractiveTextColor } from '@/design/tokens/carelightadaptive';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';

type CalendarCreateActionProps = {
  onPress: () => void;
  accentColor?: string;
  label?: string;
  floating?: boolean;
};

export function CalendarCreateAction({
  onPress,
  accentColor = '#62F3FF',
  label = 'Neu',
  floating = false,
}: CalendarCreateActionProps) {
  const labelColor = useInteractiveTextColor(accentColor);

  if (floating) {
    return (
      <Pressable
        onPress={onPress}
        style={[styles.fab, { backgroundColor: accentColor, shadowColor: accentColor }]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    );
  }

  const glass = useActiveGlassTokens();

  return (
    <Pressable
      onPress={onPress}
      style={[styles.button, { borderColor: accentColor, backgroundColor: glass.chip }]}
      accessibilityRole="button"
    >
      <Text style={[styles.buttonLabel, { color: labelColor }]}>+ {label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: careSpacing.md,
    paddingVertical: careSpacing.xs,
    borderRadius: careRadius.full,
    borderWidth: 1,
    marginBottom: careSpacing.sm,
  },
  buttonLabel: { fontSize: 13, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: careSpacing.lg,
    bottom: careSpacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  fabIcon: {
    color: '#041018',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 30,
  },
});
