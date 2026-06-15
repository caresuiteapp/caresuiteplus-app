import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { DemoModeHintHero } from '@/components/auth';
import { ScreenShell } from '@/components/layout';
import { PremiumButton } from '@/components/ui';
import { spacing } from '@/theme';

export function DemoModeHintScreen() {
  const router = useRouter();

  return (
    <ScreenShell
      title="Demo mit Beispieldaten"
      subtitle="Demo-Modus ist derzeit deaktiviert"
      scroll
    >
      <DemoModeHintHero />
      <PremiumButton
        title="Zur Startseite"
        variant="secondary"
        onPress={() => router.replace('/' as never)}
        fullWidth
        style={styles.button}
      />
      <PremiumButton
        title="Unternehmen / Verwaltung"
        onPress={() => router.push('/auth/business-login' as never)}
        fullWidth
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  button: { marginBottom: spacing.sm },
});
