import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { PremiumButton, PremiumCard } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <ScreenShell title="Seite nicht gefunden" subtitle="Fehler 404">
      <PremiumCard accentColor={colors.cyan}>
        <Text style={styles.title}>Diese Route existiert nicht</Text>
        <Text style={styles.body}>
          Der angeforderte Bereich wurde nicht gefunden oder Sie haben keine Berechtigung dafür.
        </Text>
      </PremiumCard>
      <View style={styles.actions}>
        <PremiumButton title="Zum Start" fullWidth onPress={() => router.replace('/' as never)} />
        <PremiumButton
          title="Zurück"
          variant="secondary"
          fullWidth
          onPress={() => router.back()}
        />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h3, marginBottom: spacing.sm },
  body: { ...typography.body },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
