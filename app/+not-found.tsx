import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { ErrorState, PremiumButton } from '@/components/ui';
import { resolveSessionHomeRoute } from '@/lib/navigation/sessionRouting';
import { useAuth } from '@/lib/auth/context';
import { spacing, typography } from '@/theme';

export default function NotFoundScreen() {
  const router = useRouter();
  const { isAuthenticated, profile, portalSession } = useAuth();
  const dashboardRoute = isAuthenticated
    ? String(resolveSessionHomeRoute(profile?.roleKey ?? null, portalSession))
    : null;

  return (
    <ScreenShell title="Seite nicht gefunden" subtitle="Fehler 404">
      <ErrorState
        title="Diese Route existiert nicht"
        message="Der angeforderte Bereich wurde nicht gefunden oder Sie haben keine Berechtigung dafür."
      />
      <View style={styles.actions}>
        {dashboardRoute ? (
          <PremiumButton
            title="Zum Dashboard"
            fullWidth
            onPress={() => router.replace(dashboardRoute as never)}
          />
        ) : null}
        <PremiumButton title="Zum Start" fullWidth onPress={() => router.replace('/' as never)} />
        <PremiumButton
          title="Zurück"
          variant="secondary"
          fullWidth
          onPress={() => router.back()}
        />
      </View>
      <Text style={styles.hint}>
        Tipp: Nutzen Sie die Navigation oder kehren Sie zum Start zurück.
      </Text>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm, marginTop: spacing.md },
  hint: { ...typography.caption, marginTop: spacing.md, textAlign: 'center' },
});
