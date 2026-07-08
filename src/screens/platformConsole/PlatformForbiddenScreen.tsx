import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PlatformShellLayout, PLATFORM_COLORS } from '@/components/platformConsole';
import { PremiumButton } from '@/components/ui';
import { spacing } from '@/theme';

export function PlatformForbiddenScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.code}>403</Text>
        <Text style={styles.title}>Kein Zugriff auf die CareSuite+ Platform Console.</Text>
        <Text style={styles.message}>
          Dieser Bereich ist ausschließlich für autorisierte Plattformadministratoren vorgesehen.
        </Text>
        <PremiumButton
          title="Zur Anmeldung"
          onPress={() => router.replace('/auth/business-login' as never)}
        />
        <PremiumButton
          title="Zum Business-Bereich"
          variant="secondary"
          onPress={() => router.replace('/business' as never)}
        />
      </View>
    </View>
  );
}

export function PlatformIndexRedirect() {
  return (
    <PlatformShellLayout>
      <Text style={{ color: PLATFORM_COLORS.muted }}>Weiterleitung…</Text>
    </PlatformShellLayout>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PLATFORM_COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    maxWidth: 480,
    width: '100%',
    backgroundColor: PLATFORM_COLORS.panel,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 12,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  code: { color: PLATFORM_COLORS.danger, fontSize: 48, fontWeight: '800' },
  title: { color: PLATFORM_COLORS.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  message: { color: PLATFORM_COLORS.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
