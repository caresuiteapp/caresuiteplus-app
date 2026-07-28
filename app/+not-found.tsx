import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { liquidColors, liquidRadius, liquidSpace } from '@/liquid-command/foundation/tokens';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <View style={styles.page}>
      <View style={styles.glow} pointerEvents="none" />
      <View style={styles.card}>
        <Text style={styles.eyebrow}>CARESUITE HEALTHOS · 404</Text>
        <Text style={styles.title}>Dieser Arbeitsbereich existiert nicht.</Text>
        <Text style={styles.body}>
          Die Route wurde entfernt, verschoben oder ist für Ihre Rolle nicht freigegeben.
        </Text>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/' as never)}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryLabel}>Zum Command Center</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryLabel}>Zurück</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: 560,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: liquidSpace.xl,
    backgroundColor: liquidColors.navy950,
  },
  glow: {
    position: 'absolute',
    width: 640,
    height: 640,
    top: -320,
    right: -240,
    borderRadius: 320,
    backgroundColor: 'rgba(20,120,255,0.18)',
  },
  card: {
    width: '100%',
    maxWidth: 620,
    gap: liquidSpace.md,
    padding: liquidSpace.xxl,
    borderRadius: liquidRadius.panel,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    backgroundColor: 'rgba(10,35,66,0.88)',
  },
  eyebrow: {
    color: liquidColors.blue200,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  title: {
    color: liquidColors.white,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
  },
  body: {
    color: liquidColors.white64,
    fontSize: 16,
    lineHeight: 24,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: liquidSpace.sm,
    marginTop: liquidSpace.sm,
  },
  primary: {
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: liquidSpace.lg,
    borderRadius: liquidRadius.control,
    backgroundColor: liquidColors.blue500,
  },
  secondary: {
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: liquidSpace.lg,
    borderRadius: liquidRadius.control,
    borderWidth: 1,
    borderColor: liquidColors.white18,
    backgroundColor: liquidColors.white08,
  },
  pressed: {
    opacity: 0.78,
  },
  primaryLabel: {
    color: liquidColors.white,
    fontWeight: '800',
  },
  secondaryLabel: {
    color: liquidColors.white88,
    fontWeight: '700',
  },
});
