import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  label = 'Neuer Eintrag',
  floating = false,
}: CalendarCreateActionProps) {
  if (floating) {
    return (
      <Pressable
        onPress={onPress}
        style={[styles.fab, { backgroundColor: accentColor, shadowColor: accentColor }]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={styles.fabIcon}>＋</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Neuen Termin oder Einsatz planen"
    >
      <View style={styles.iconWrap}><Text style={styles.icon}>＋</Text></View>
      <View style={styles.copy}>
        <Text style={styles.title}>{label}</Text>
        <Text style={styles.subtitle}>Termin, Abwesenheit oder Einsatz planen</Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    minWidth: 310,
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(126,225,255,0.65)',
    backgroundColor: '#0A72D8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    shadowColor: '#1EA7FF',
    shadowOpacity: 0.32,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  pressed: { opacity: 0.84, transform: [{ scale: 0.99 }] },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { color: '#FFFFFF', fontSize: 23, lineHeight: 25, fontWeight: '800' },
  copy: { flex: 1, minWidth: 0 },
  title: { color: '#FFFFFF', fontSize: 15, lineHeight: 19, fontWeight: '900' },
  subtitle: { color: '#D7F2FF', fontSize: 11, lineHeight: 15, fontWeight: '600', marginTop: 2 },
  arrow: { color: '#FFFFFF', fontSize: 30, lineHeight: 32, fontWeight: '300' },
  fab: {
    position: 'absolute',
    right: careSpacing.lg,
    bottom: careSpacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  fabIcon: { color: '#041018', fontSize: 30, fontWeight: '800', lineHeight: 32 },
});
